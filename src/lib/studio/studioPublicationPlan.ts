import {
  fromProtocolConnectorPayload,
  toProtocolConnectorPayload,
} from "$lib/chain/connectorContractAdapter";
import type {
  RawChainConditionResponse,
  RawChainConnectorResponse,
  RawChainTransformationResponse,
} from "$lib/chain/registryApi";
import type { EntityKind } from "decentralised-art";
import { isOwnedLocalEntity, isPublishedChainAddress } from "./studioEntityOrigin";
import type { PublicationRecord } from "./studioPublication";

export type PublicationEntity = { kind: EntityKind; name: string };

export type PublicationPayload = (
  | RawChainConnectorResponse
  | RawChainTransformationResponse
  | RawChainConditionResponse
) & { content_hash?: string };

export type PublicationPlanEntry = PublicationEntity & {
  key: string;
  payload: PublicationPayload;
  dependencies: string[];
  state: "published" | PublicationRecord["stage"];
  address?: string;
  txHash?: string;
  chainId?: string;
  verifyReceipt?: true;
};

export type StudioPublicationPlan = {
  root: PublicationEntity;
  owner: string;
  entries: PublicationPlanEntry[];
};

type PublicationPlanInput = {
  root: PublicationEntity;
  owner: string;
  lookup(entity: PublicationEntity): Promise<PublicationPayload>;
  getRecord?(kind: EntityKind, name: string): PublicationRecord | undefined;
  signal?: AbortSignal;
  onProgress?(discovered: number, entity: PublicationEntity): void;
};

export const publicationEntityKey = ({ kind, name }: PublicationEntity) => `${kind}:${name}`;

const describe = ({ kind, name }: PublicationEntity) => `${kind} '${name}'`;

const normalizeAddress = (address: unknown) =>
  typeof address === "string" ? `0x${address.trim().toLowerCase().replace(/^0x/, "")}` : "";

const isHash = (value: unknown): value is string =>
  typeof value === "string" && /^0x[0-9a-f]{64}$/i.test(value);

function connectorDependencies(payload: RawChainConnectorResponse): PublicationEntity[] {
  const connector = fromProtocolConnectorPayload(payload);
  const dependencies: PublicationEntity[] = [];
  if (connector.conditionName)
    dependencies.push({ kind: "condition", name: connector.conditionName });
  for (const dimension of connector.dimensions) {
    for (const transformation of dimension.transformations)
      dependencies.push({ kind: "transformation", name: transformation.name });
    if (dimension.composite) dependencies.push({ kind: "connector", name: dimension.composite });
    for (const name of Object.values(dimension.bindings ?? {}))
      dependencies.push({ kind: "connector", name });
  }
  return dependencies;
}

function normalizedDefinition(kind: EntityKind, payload: PublicationPayload): string {
  if (kind === "connector")
    return JSON.stringify(toProtocolConnectorPayload(fromProtocolConnectorPayload(payload)));
  const { name, sol_src } = payload as RawChainConditionResponse | RawChainTransformationResponse;
  if (typeof sol_src !== "string") throw new Error("saved Solidity source is unavailable");
  return JSON.stringify({ name, sol_src });
}

function assertSavedPublication(
  entity: PublicationEntity,
  payload: PublicationPayload,
  record: PublicationRecord,
  owner: string,
): boolean {
  if (normalizeAddress(record.owner) !== owner || !isHash(record.content_hash))
    throw new Error(
      `The saved publication of ${describe(entity)} has an invalid owner or content hash.`,
    );

  if (isPublishedChainAddress(payload.address)) {
    if (
      (record.address && normalizeAddress(record.address) !== normalizeAddress(payload.address)) ||
      (payload.owner && normalizeAddress(payload.owner) !== owner) ||
      (payload.content_hash !== undefined &&
        (!isHash(payload.content_hash) ||
          payload.content_hash.toLowerCase() !== record.content_hash.toLowerCase()))
    )
      throw new Error(`Published ${describe(entity)} differs from the saved publication.`);
    return false;
  }

  if (payload.content_hash !== undefined) {
    if (
      isHash(payload.content_hash) &&
      payload.content_hash.toLowerCase() === record.content_hash.toLowerCase()
    )
      return false;
    throw new Error(
      `The registry content hash of ${describe(entity)} differs from its saved publication.`,
    );
  }
  if (entity.kind !== "connector") {
    const { sol_src } = payload as RawChainConditionResponse | RawChainTransformationResponse;
    // Primitive lookup omits source. Evidence from confirm or prepare is required before skipping.
    if (!sol_src) return record.stage === "mined";
  }
  try {
    const saved: PublicationPayload = JSON.parse(record.fingerprint);
    if (
      saved.name === entity.name &&
      normalizedDefinition(entity.kind, saved) === normalizedDefinition(entity.kind, payload)
    )
      return false;
  } catch {
    // The saved transaction must be reconciled before a different definition could be used.
  }
  throw new Error(
    `The draft definition of ${describe(entity)} differs from its saved publication. Resolve the saved transaction before continuing.`,
  );
}

/** Resolves the current tree before any wallet request. Public entities are immutable boundaries. */
export async function buildStudioPublicationPlan({
  root,
  owner,
  lookup,
  getRecord,
  signal,
  onProgress,
}: PublicationPlanInput): Promise<StudioPublicationPlan> {
  const normalizedOwner = normalizeAddress(owner);
  if (!isPublishedChainAddress(normalizedOwner))
    throw new Error("Select a valid wallet account before reviewing publication.");

  const entries: PublicationPlanEntry[] = [];
  const resolved = new Set<string>();
  const visiting = new Set<string>();
  const prefetched = new Map<
    string,
    Promise<{ payload: PublicationPayload } | { error: unknown }>
  >();
  let activePrefetches = 0;
  let discovered = 0;

  // Read siblings in parallel while keeping dependency traversal and validation in order.
  function prefetch(references: PublicationEntity[], start: number): number {
    let next = start;
    while (next < references.length && activePrefetches < 5) {
      const reference = references[next++];
      const key = publicationEntityKey(reference);
      if (resolved.has(key) || visiting.has(key) || prefetched.has(key)) continue;
      activePrefetches++;
      prefetched.set(
        key,
        Promise.resolve()
          .then(() => {
            signal?.throwIfAborted();
            return lookup(reference);
          })
          .then(
            (payload) => ({ payload }),
            (error: unknown) => ({ error }),
          )
          .finally(() => {
            activePrefetches--;
          }),
      );
    }
    return next;
  }

  async function visit(entity: PublicationEntity, parent?: PublicationEntity): Promise<void> {
    signal?.throwIfAborted();
    const key = publicationEntityKey(entity);
    if (resolved.has(key)) return;
    if (visiting.has(key))
      throw new Error(`Cyclic publication dependency: ${[...visiting, key].join(" → ")}.`);
    visiting.add(key);

    let payload: PublicationPayload;
    try {
      const prepared = prefetched.get(key);
      if (prepared) {
        const result = await prepared;
        prefetched.delete(key);
        if ("error" in result) throw result.error;
        payload = result.payload;
      } else {
        payload = await lookup(entity);
      }
    } catch (error) {
      signal?.throwIfAborted();
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Could not look up ${describe(entity)}${parent ? ` required by ${describe(parent)}` : ""}. ${detail}`,
        { cause: error },
      );
    }
    signal?.throwIfAborted();
    if (payload?.name !== entity.name)
      throw new Error(`The registry returned a different entity for ${describe(entity)}.`);

    const indexedAddress = isPublishedChainAddress(payload.address) ? payload.address : undefined;
    if (!indexedAddress && !isOwnedLocalEntity(payload, normalizedOwner)) {
      throw new Error(
        `${describe(entity)}${parent ? ` required by ${describe(parent)}` : ""} is neither published nor a draft owned by the selected wallet.`,
      );
    }

    const record = getRecord?.(entity.kind, entity.name);
    const active = record?.stage === "sending" || record?.stage === "pending";
    const mined = record?.stage === "mined";
    const verifyReceipt =
      record && (active || (mined && !indexedAddress))
        ? assertSavedPublication(entity, payload, record, normalizedOwner)
        : false;
    if (record?.stage === "pending" && !isHash(record.tx_hash))
      throw new Error(`The saved transaction hash of ${describe(entity)} is missing or invalid.`);
    if (mined && !indexedAddress && !isPublishedChainAddress(record.address))
      throw new Error(`The saved mined publication of ${describe(entity)} has no valid address.`);

    const matchedMined =
      mined &&
      (!indexedAddress ||
        (normalizeAddress(indexedAddress) === normalizeAddress(record.address) &&
          normalizeAddress(record.owner) === normalizedOwner));
    const state = active
      ? record.stage
      : matchedMined
        ? "mined"
        : indexedAddress
          ? "published"
          : "draft";
    const address = indexedAddress ?? (mined ? record.address : undefined);
    const dependencies = new Set<string>();
    onProgress?.(++discovered, entity);
    if (!indexedAddress && !mined && entity.kind === "connector") {
      let references: PublicationEntity[];
      try {
        references = connectorDependencies(payload as RawChainConnectorResponse);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid definition for ${describe(entity)}. ${detail}`, { cause: error });
      }
      let prefetchedThrough = 0;
      for (const dependency of references) {
        prefetchedThrough = prefetch(references, prefetchedThrough);
        dependencies.add(publicationEntityKey(dependency));
        await visit(dependency, entity);
      }
    }
    entries.push({
      ...entity,
      key,
      payload,
      state,
      dependencies: [...dependencies],
      address,
      txHash: active || matchedMined ? record.tx_hash : undefined,
      chainId: active || matchedMined ? record.chainId : undefined,
      ...(verifyReceipt ? { verifyReceipt: true } : {}),
    });
    visiting.delete(key);
    resolved.add(key);
  }

  await visit(root);
  return { root, owner: normalizedOwner, entries };
}
