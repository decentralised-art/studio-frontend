import { fromProtocolConnectorPayload } from "$lib/chain/connectorContractAdapter";
import type { ChainFeedItem } from "$lib/chain/eventFeedApi";
import {
  getChainCondition,
  getChainConnector,
  getChainTransformation,
  type RawChainConditionResponse,
  type RawChainConnectorResponse,
  type RawChainTransformationResponse,
} from "$lib/chain/registryApi";
import { inferArgsCountFromSnippet } from "$lib/components/solidity-editor/templates/inferArgsCount";
import type { SoliditySnippet } from "$lib/components/solidity-editor/templates/types";
import type { NetworkFeedEvent, ParticleRecord } from "$lib/feed/particlePostData";
import type { StudioConnectorDef } from "$lib/studio/domain/connectorModel";

export type ChainEventHydrationKind = "connector" | "transformation" | "condition";

export type ChainEventHydrationTarget =
  | { type: "connector"; name: string; owner?: string }
  | { type: "transformation"; name: string; owner?: string }
  | { type: "condition"; name: string; owner?: string };

export type HydratedChainConnectorDetail = {
  type: "connector";
  name: string;
  owner: string;
  raw: RawChainConnectorResponse;
  connector: StudioConnectorDef;
  dependencies: string[];
  formatHash?: string;
  transformationArgCounts: Record<string, number>;
  conditionArgCounts: Record<string, number>;
  particleRecord: ParticleRecord;
};

export type HydratedChainRuntimeCodeDetail = {
  type: "transformation" | "condition";
  name: string;
  owner: string;
  raw: RawChainTransformationResponse | RawChainConditionResponse;
  solSrc: string;
  runtimeSnippet: string;
  argsCount: number;
  address?: string;
};

export type HydratedChainEventDetail =
  | HydratedChainConnectorDetail
  | HydratedChainRuntimeCodeDetail;

export class ChainEventHydrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChainEventHydrationError";
  }
}

const CHAIN_ADDRESS_RE = /^0x[a-f0-9]{40}$/i;
const BARE_CHAIN_ADDRESS_RE = /^[a-f0-9]{40}$/i;

const EVENT_KIND_BY_EVENT_TYPE: Record<string, ChainEventHydrationKind> = {
  connector_added: "connector",
  transformation_added: "transformation",
  condition_added: "condition",
};

const normalizeName = (value: unknown, field: string): string => {
  if (typeof value !== "string") {
    throw new ChainEventHydrationError(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ChainEventHydrationError(`${field} must not be empty.`);
  }
  return trimmed;
};

const normalizeOptionalOwner = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (CHAIN_ADDRESS_RE.test(normalized)) return normalized;
  if (BARE_CHAIN_ADDRESS_RE.test(normalized)) return `0x${normalized}`;
  return null;
};

const resolveOwner = (detailOwner: unknown, targetOwner: unknown): string => {
  const owner = normalizeOptionalOwner(detailOwner) ?? normalizeOptionalOwner(targetOwner);
  if (!owner) {
    throw new ChainEventHydrationError("Hydrated chain entity must include a valid owner address.");
  }
  return owner;
};

const normalizeOptionalString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const extractRuntimeSnippet = (solSrc: string): string => {
  const trimmed = solSrc.trim();
  if (!trimmed) return "";
  const returnMatch = trimmed.match(/\breturn\b[\s\S]*?;/i);
  if (returnMatch) return returnMatch[0].replace(/\s+/g, " ").trim();
  const firstLine = trimmed
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine ?? "";
};

const uniqueOrdered = (values: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  values.forEach((value) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  });
  return out;
};

const extractConnectorDependencies = (connector: StudioConnectorDef): string[] =>
  uniqueOrdered(
    connector.dimensions
      .flatMap((dimension) => [
        dimension.composite ?? "",
        ...Object.values(dimension.bindings ?? {}),
      ])
      .filter((value) => value.trim().length > 0),
  );

const extractConnectorTransformationArgCounts = (
  connector: StudioConnectorDef,
): Record<string, number> => {
  const counts: Record<string, number> = {};
  connector.dimensions.forEach((dimension) => {
    dimension.transformations.forEach((tx) => {
      counts[tx.name] = Math.max(counts[tx.name] ?? 0, tx.args.length);
    });
  });
  return counts;
};

const extractConnectorConditionArgCounts = (
  connector: StudioConnectorDef,
): Record<string, number> => {
  if (!connector.conditionName) return {};
  return {
    [connector.conditionName]: connector.conditionArgs?.length ?? 0,
  };
};

const resolveFeedItemKind = (item: ChainFeedItem): ChainEventHydrationKind | null => {
  const payloadType = item.payload.type.trim().toLowerCase();
  if (
    payloadType === "connector" ||
    payloadType === "transformation" ||
    payloadType === "condition"
  ) {
    return payloadType;
  }
  return EVENT_KIND_BY_EVENT_TYPE[item.eventType.trim().toLowerCase()] ?? null;
};

export const getChainFeedItemHydrationTarget = (
  item: ChainFeedItem,
): ChainEventHydrationTarget | null => {
  if (!item.visible || item.status === "removed") return null;
  const type = resolveFeedItemKind(item);
  if (!type) return null;
  return {
    type,
    name: normalizeName(item.payload.name, "payload.name"),
    owner: item.payload.owner,
  };
};

export const getNetworkFeedEventHydrationTarget = (
  event: NetworkFeedEvent,
): ChainEventHydrationTarget | null => {
  if (event.type === "connector") {
    return {
      type: "connector",
      name: normalizeName(event.particleId, "particleId"),
      owner: event.authorId,
    };
  }
  if (event.type === "transformation" || event.type === "condition") {
    return {
      type: event.type,
      name: normalizeName(event.elementId, "elementId"),
      owner: event.authorId,
    };
  }
  return null;
};

const hydrateConnectorDetail = async (
  target: ChainEventHydrationTarget,
): Promise<HydratedChainConnectorDetail> => {
  const raw = await getChainConnector(target.name);
  let connector: StudioConnectorDef;
  try {
    connector = fromProtocolConnectorPayload(raw);
  } catch (error) {
    throw new ChainEventHydrationError(
      error instanceof Error ? error.message : "Invalid connector detail payload.",
    );
  }

  const owner = resolveOwner(raw.owner, target.owner);
  const dependencies = extractConnectorDependencies(connector);
  const formatHash = connector.formatHash;
  const particleRecord: ParticleRecord = {
    id: connector.name,
    name: connector.name,
    summary: "",
    authorId: owner,
    createdAt: 0,
    createdLabel: "",
    dependencies,
    ...(formatHash ? { formatHash } : {}),
  };

  return {
    type: "connector",
    name: connector.name,
    owner,
    raw,
    connector,
    dependencies,
    ...(formatHash ? { formatHash } : {}),
    transformationArgCounts: extractConnectorTransformationArgCounts(connector),
    conditionArgCounts: extractConnectorConditionArgCounts(connector),
    particleRecord,
  };
};

const hydrateRuntimeCodeDetail = async (
  target: Extract<ChainEventHydrationTarget, { type: "transformation" | "condition" }>,
): Promise<HydratedChainRuntimeCodeDetail> => {
  const raw =
    target.type === "transformation"
      ? await getChainTransformation(target.name)
      : await getChainCondition(target.name);
  const name = normalizeName(raw.name ?? target.name, "name");
  const owner = resolveOwner(raw.owner, target.owner);
  const solSrc = normalizeOptionalString(raw.sol_src);
  const runtimeSnippet = extractRuntimeSnippet(solSrc);
  const argsCount = inferArgsCountFromSnippet(solSrc as SoliditySnippet).minArgsCount;
  const address = normalizeOptionalString(raw.address);

  return {
    type: target.type,
    name,
    owner,
    raw,
    solSrc,
    runtimeSnippet,
    argsCount,
    ...(address ? { address } : {}),
  };
};

export const hydrateChainEventDetail = async (
  target: ChainEventHydrationTarget,
): Promise<HydratedChainEventDetail> => {
  switch (target.type) {
    case "connector":
      return hydrateConnectorDetail(target);
    case "transformation":
      return hydrateRuntimeCodeDetail(target);
    case "condition":
      return hydrateRuntimeCodeDetail(target);
  }
  throw new ChainEventHydrationError("Unsupported chain event hydration target.");
};

export const hydrateChainFeedItemDetail = async (
  item: ChainFeedItem,
): Promise<HydratedChainEventDetail | null> => {
  const target = getChainFeedItemHydrationTarget(item);
  return target ? hydrateChainEventDetail(target) : null;
};

export const hydrateNetworkFeedEventDetail = async (
  event: NetworkFeedEvent,
): Promise<HydratedChainEventDetail | null> => {
  const target = getNetworkFeedEventHydrationTarget(event);
  return target ? hydrateChainEventDetail(target) : null;
};
