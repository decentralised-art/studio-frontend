import type { BrowserEthereumProvider } from "$lib/auth/api";
import { ChainApiRequestError } from "$lib/chain/registryApi";
import type {
  ConfirmRequest,
  ConfirmResponse,
  EntityKind,
  PreparedPublication,
  PrepareResponse,
  PublishError,
} from "decentralised-art";

export type PublicationRecord = {
  fingerprint: string;
  kind: EntityKind;
  name: string;
  stage: "draft" | "sending" | "pending" | "mined";
  content_hash?: string;
  tx_hash?: string;
  tx_source?: "wallet" | "recovered";
  block_number?: number;
  address?: string;
  owner?: string;
  chainId?: string;
  tx_history?: string[];
};

export type PublicationStore = {
  readonly scope: string;
  get(kind: EntityKind, name: string): PublicationRecord | undefined;
  put(record: PublicationRecord): void;
  list(): PublicationRecord[];
};

// Scope by API endpoint AND wallet: a draft/receipt from another server/account
// must never cause this server's creation or publication step to be skipped.
export const createPublicationStore = (
  scope: string,
  storage?: Pick<Storage, "getItem" | "setItem">,
): PublicationStore => {
  const key = `dcn.studio.publications.v1:${scope}`;
  let records: PublicationRecord[] = [];
  const refresh = () => {
    if (!storage) return;
    try {
      const saved: unknown = JSON.parse(storage?.getItem(key) ?? "[]");
      if (Array.isArray(saved))
        records = saved.filter((value): value is PublicationRecord =>
          Boolean(
            value &&
            typeof value === "object" &&
            typeof value.name === "string" &&
            typeof value.fingerprint === "string" &&
            ["connector", "condition", "transformation"].includes(value.kind) &&
            ["draft", "sending", "pending", "mined"].includes(value.stage),
          ),
        );
    } catch {
      /* Reads may be unavailable; writes fail before a wallet send. */
    }
  };
  refresh();
  return {
    scope,
    get: (kind, name) => {
      refresh();
      return records.find((record) => record.kind === kind && record.name === name);
    },
    list: () => {
      refresh();
      return records.map((record) => ({ ...record }));
    },
    put: (record) => {
      refresh();
      records = [
        ...records.filter(
          (previous) => previous.kind !== record.kind || previous.name !== record.name,
        ),
        { ...record },
      ];
      // Fail BEFORE sending if persistent storage is unavailable. Recovery hashes must survive reloads.
      storage?.setItem(key, JSON.stringify(records));
    },
  };
};

export type PublicationApi = {
  createDraft(): Promise<unknown>;
  prepare(): Promise<PrepareResponse>;
  confirm(request: ConfirmRequest): Promise<ConfirmResponse | PublishError>;
};

export type PublicationProgress = {
  kind: EntityKind;
  name: string;
  phase: "creating" | "preparing" | "reconciling" | "wallet" | "confirming" | "mined";
  message: string;
  txHash?: string;
};

export const createPublicationDraft = async (input: {
  kind: EntityKind;
  name: string;
  body: unknown;
  store: PublicationStore;
  createDraft: () => Promise<unknown>;
}): Promise<PublicationRecord> => {
  const fingerprint = JSON.stringify(input.body);
  const existing = input.store.get(input.kind, input.name);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new Error(
        `'${input.name}' already has a saved draft or publication with different content. Created entities are immutable; create a new entity to use different content.`,
      );
    }
    return existing;
  }
  await input.createDraft();
  // Creation in another tab may have started before the publisher acquired
  // its lock. Never replace a newer pending/mined record with a draft marker.
  const concurrent = input.store.get(input.kind, input.name);
  if (concurrent) {
    if (concurrent.fingerprint !== fingerprint)
      throw new Error(`'${input.name}' changed in another Studio session. Use a new name.`);
    return concurrent;
  }
  const record: PublicationRecord = {
    kind: input.kind,
    name: input.name,
    fingerprint,
    stage: "draft",
  };
  input.store.put(record);
  return record;
};

const assertWallet = async (provider: BrowserEthereumProvider, owner: string, chainId: string) => {
  const accounts = await provider.request<unknown>({ method: "eth_accounts" });
  if (
    !Array.isArray(accounts) ||
    typeof accounts[0] !== "string" ||
    accounts[0].toLowerCase() !== owner.toLowerCase()
  ) {
    throw new Error(`Select the entity owner's wallet account ${owner} before publishing.`);
  }
  const activeChain = await provider.request<unknown>({ method: "eth_chainId" });
  if (
    typeof activeChain !== "string" ||
    !/^0x[0-9a-f]+$/i.test(activeChain) ||
    BigInt(activeChain) !== BigInt(chainId)
  ) {
    const label = BigInt(chainId) === 11155111n ? "Sepolia" : `chain ${BigInt(chainId)}`;
    throw new Error(`Switch your wallet to ${label} (${chainId}) before publishing.`);
  }
};

export class PublicationPendingError extends Error {
  constructor(public readonly record: PublicationRecord) {
    super(
      `Publication '${record.name}' is still pending: ${record.tx_hash}. Retry Publish to check this transaction without sending it again.`,
    );
    this.name = "PublicationPendingError";
  }
}

export const recoverPublicationHash = (
  store: PublicationStore,
  record: PublicationRecord,
  hash: string,
): void => {
  if (!/^0x[0-9a-f]{64}$/i.test(hash.trim()))
    throw new Error("Enter the 32-byte transaction hash from your wallet.");
  if (!["sending", "pending"].includes(record.stage) || !record.content_hash)
    throw new Error("This publication does not need transaction recovery.");
  store.put({
    ...record,
    tx_hash: hash.trim(),
    tx_source: "recovered",
    tx_history: [
      ...new Set([...(record.tx_history ?? []), ...(record.tx_hash ? [record.tx_hash] : [])]),
    ],
    stage: "pending",
  });
};

/** Only API callbacks may retry auth. Never wrap this whole operation in auth retry. */
export type PublicationInput = {
  expectedOwner: string;
  kind: EntityKind;
  name: string;
  body: unknown;
  api: PublicationApi;
  provider: BrowserEthereumProvider;
  store: PublicationStore;
  /** Recover through reads and receipt checks without a wallet submission. */
  mode?: "publish" | "recover";
  onPrepared?: (prepared: PreparedPublication) => void | Promise<void>;
  onStatus?: (message: string) => void;
  onProgress?: (progress: PublicationProgress) => void;
  maxConfirmAttempts?: number;
  wait?: () => Promise<void>;
  /** Test hook for a lock manager. Browsers use owner/API-scoped Web Locks. */
  withLock?: (scope: string, operation: () => Promise<void>) => Promise<void>;
};

const inFlightPublications = new WeakMap<PublicationStore, Map<string, Promise<void>>>();

export const publishStudioEntity = (input: PublicationInput): Promise<void> => {
  let publications = inFlightPublications.get(input.store);
  if (!publications) {
    publications = new Map();
    inFlightPublications.set(input.store, publications);
  }
  const key = `${input.kind}:${input.name}:${input.mode ?? "publish"}`;
  const active = publications.get(key);
  if (active) return active;
  const withLock =
    input.withLock ??
    (async (scope: string, operation: () => Promise<void>) => {
      if (typeof navigator === "undefined" || !navigator.locks) {
        throw new Error(
          "Safe publication requires a browser with Web Locks on HTTPS or localhost. Open Studio in a supported browser before publishing.",
        );
      }
      return navigator.locks.request(`dcn.studio.publisher:${scope}`, operation);
    });
  // One registry nonce per owner: serialize different entities, editors and tabs.
  const operation = withLock(input.store.scope, () => runPublication(input)).finally(() =>
    publications.delete(key),
  );
  publications.set(key, operation);
  return operation;
};

const isAddress = (address: unknown): address is string =>
  typeof address === "string" && /^0x[0-9a-f]{40}$/i.test(address) && !/^0x0{40}$/i.test(address);

const isHash = (hash: unknown): hash is string =>
  typeof hash === "string" && /^0x[0-9a-f]{64}$/i.test(hash);

const hasConfirmedWalletRevert = (record: PublicationRecord, txHash: string, error: unknown) => {
  // Older automatic sends had no provenance field. Earlier recovery always filled tx_history,
  // even when replacing a hashless attempt, so an existing array is not proof of a wallet send.
  const fromWallet =
    record.tx_source === "wallet" ||
    (record.tx_source === undefined && record.tx_history === undefined);
  if (
    record.stage !== "pending" ||
    !fromWallet ||
    !(error instanceof ChainApiRequestError) ||
    error.status !== 400 ||
    !error.responseBody ||
    typeof error.responseBody !== "object"
  )
    return false;
  const { message, tx_hash: rejectedHash } = error.responseBody as Record<string, unknown>;
  return (
    message === "transaction reverted" &&
    isHash(rejectedHash) &&
    rejectedHash.toLowerCase() === txHash.toLowerCase()
  );
};

const validatePreparation = (
  input: PublicationInput,
  record: PublicationRecord,
  prepared: PrepareResponse,
) => {
  if (prepared.kind !== input.kind || prepared.name !== input.name)
    throw new Error("Publication preparation returned a different entity.");
  if (!isHash(prepared.content_hash) || !isAddress(prepared.address))
    throw new Error("Publication preparation returned invalid artifact details.");
  if (
    record.content_hash &&
    record.content_hash.toLowerCase() !== prepared.content_hash.toLowerCase()
  )
    throw new Error(
      "Prepared artifact changed since the previous publication attempt. Use a new name.",
    );
  const preparedOwner =
    prepared.status === "published" ? prepared.owner : prepared.transaction.from;
  if (
    !isAddress(preparedOwner) ||
    preparedOwner.toLowerCase() !== input.expectedOwner.toLowerCase()
  )
    throw new Error(
      "Publication owner changed during authentication. Retry from the correct wallet account.",
    );
};

const assertValidDeadline = (deadline: number) => {
  if (!Number.isSafeInteger(deadline) || deadline <= 0 || deadline * 1000 <= Date.now())
    throw new Error(
      "Publication preparation has an invalid or expired deadline. Retry Publish to prepare again.",
    );
};

const runPublication = async (input: PublicationInput): Promise<void> => {
  const { api, store, provider } = input;
  const recover = input.mode === "recover";
  const report = (phase: PublicationProgress["phase"], message: string, txHash?: string) => {
    input.onStatus?.(message);
    input.onProgress?.({ kind: input.kind, name: input.name, phase, message, txHash });
  };
  report(
    recover ? "reconciling" : "creating",
    recover
      ? `Checking saved publication for '${input.name}'…`
      : `Checking local ${input.kind} draft '${input.name}'…`,
  );
  let record = recover
    ? store.get(input.kind, input.name)
    : await createPublicationDraft({ ...input, createDraft: api.createDraft });
  if (!record || (recover && record.stage === "draft"))
    throw new Error(`'${input.name}' has no saved transaction to recover.`);
  if (record.owner && record.owner.toLowerCase() !== input.expectedOwner.toLowerCase())
    throw new Error("Saved publication belongs to a different wallet owner.");
  if (record.stage === "mined" && !recover) {
    report(
      "mined",
      `'${input.name}' is already mined. Safe-block execution and indexing may still be catching up.`,
      record.tx_hash,
    );
    return;
  }
  if (record.owner && record.chainId) await assertWallet(provider, record.owner, record.chainId);
  if (record.stage === "sending" || (record.stage === "mined" && !isHash(record.tx_hash))) {
    if (recover && isHash(record.content_hash)) {
      // The prepare endpoint checks the exact artifact directly against the chain registry.
      // A by-name lookup can lag. A prepared transaction is insufficient proof of publication.
      const prepared = await api.prepare();
      validatePreparation(input, record, prepared);
      if (prepared.status === "published") {
        store.put({ ...record, owner: prepared.owner, address: prepared.address, stage: "mined" });
        report("mined", `Verified '${input.name}' on the network.`, record.tx_hash);
        return;
      }
    }
    if (record.stage === "sending")
      throw new Error(
        `The wallet may have sent '${record.name}'. Check wallet activity and recover its transaction hash below before retrying. No second transaction was sent.`,
      );
    throw new Error(`The registry could not verify the saved publication '${record.name}'.`);
  }
  if (record.stage === "draft") {
    const unresolved = store
      .list()
      .find((saved) => saved.stage === "sending" || saved.stage === "pending");
    if (unresolved)
      throw new Error(
        `Complete or recover pending publication '${unresolved.name}' before publishing another entity from this wallet.`,
      );
    report("preparing", `Preparing ${input.kind} '${input.name}' for publication…`);
    const prepared = await api.prepare();
    validatePreparation(input, record, prepared);
    if (prepared.status === "published") {
      store.put({
        ...record,
        content_hash: prepared.content_hash,
        owner: prepared.owner,
        address: prepared.address,
        stage: "mined",
      });
      report("mined", `'${input.name}' is already published.`, record.tx_hash);
      return;
    }
    const transaction = prepared.transaction;
    if (
      !isAddress(transaction.to) ||
      !/^0x[0-9a-f]+$/i.test(transaction.chainId) ||
      !/^0x[0-9a-f]+$/i.test(transaction.gas) ||
      BigInt(transaction.gas) <= 0n ||
      !/^0x(?:[0-9a-f]{2})+$/i.test(transaction.data)
    ) {
      throw new Error("The server returned an invalid publication transaction.");
    }
    assertValidDeadline(prepared.deadline);
    await input.onPrepared?.(prepared);
    await assertWallet(provider, transaction.from, transaction.chainId);
    assertValidDeadline(prepared.deadline);
    record = {
      ...record,
      content_hash: prepared.content_hash,
      owner: transaction.from,
      chainId: transaction.chainId,
      stage: "sending",
    };
    store.put(record);
    report(
      "wallet",
      `Approve publication of '${input.name}' in your wallet (${BigInt(transaction.chainId) === 11155111n ? "Sepolia" : `chain ${BigInt(transaction.chainId)}`}). Your wallet pays gas.`,
    );
    let hash: unknown;
    try {
      // The allowlist excludes any value or extra fields from a server response.
      hash = await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: transaction.from,
            to: transaction.to,
            data: transaction.data,
            chainId: transaction.chainId,
            gas: transaction.gas,
            value: "0x0",
          },
        ],
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 4001) {
        store.put({ ...record, stage: "draft" });
        throw new Error(
          "Wallet publication was rejected. The local draft is saved; retry Publish when ready.",
        );
      }
      throw new Error(
        `Wallet submission could not be verified for '${input.name}'. Check wallet activity and recover the transaction hash before retrying. ${error instanceof Error ? error.message : ""}`,
      );
    }
    if (!isHash(hash))
      throw new Error(
        "Wallet returned an invalid transaction hash. Check wallet activity and recover it below.",
      );
    record = { ...record, tx_hash: hash, tx_source: "wallet", stage: "pending" };
    try {
      store.put(record);
    } catch (error) {
      throw new Error(
        `Studio could not save the transaction for '${input.name}'. Keep ${hash} for recovery.`,
        { cause: error },
      );
    }
  }
  if (!isHash(record.tx_hash) || !isHash(record.content_hash))
    throw new Error("Saved publication lacks its transaction or content hash.");
  const txHash = record.tx_hash;
  for (let attempt = 0; attempt < (input.maxConfirmAttempts ?? 12); attempt += 1) {
    report(
      "confirming",
      `Confirming '${input.name}' — ${record.tx_hash} (check ${attempt + 1})…`,
      record.tx_hash,
    );
    const result = await api
      .confirm({
        name: input.name,
        content_hash: record.content_hash,
        tx_hash: txHash,
      })
      .catch((error: unknown) => {
        if (!hasConfirmedWalletRevert(record, txHash, error)) throw error;
        store.put({
          ...record,
          stage: "draft",
          tx_hash: undefined,
          tx_source: undefined,
          tx_history: [...new Set([...(record.tx_history ?? []), txHash])],
        });
        throw new Error(
          `Publication '${input.name}' reverted on-chain. Review the publication before retrying.`,
          { cause: error },
        );
      });
    if (result.status === "mined") {
      if (
        result.name !== input.name ||
        result.kind !== input.kind ||
        !isHash(result.tx_hash) ||
        result.tx_hash.toLowerCase() !== record.tx_hash.toLowerCase() ||
        !isHash(result.content_hash) ||
        result.content_hash.toLowerCase() !== record.content_hash.toLowerCase() ||
        !isAddress(result.owner) ||
        result.owner.toLowerCase() !== input.expectedOwner.toLowerCase() ||
        !isAddress(result.address) ||
        !Number.isSafeInteger(result.block_number) ||
        result.block_number < 0
      )
        throw new Error("Confirmation does not match the saved publication.");
      store.put({
        ...record,
        owner: result.owner,
        address: result.address,
        block_number: result.block_number,
        stage: "mined",
      });
      report("mined", `Published '${input.name}' in block ${result.block_number}.`, record.tx_hash);
      return;
    }
    if (result.status !== "pending")
      throw new Error(result.message || "Unexpected publication confirmation.");
    if (attempt + 1 < (input.maxConfirmAttempts ?? 12))
      await (input.wait?.() ?? new Promise((resolve) => setTimeout(resolve, 3000)));
  }
  throw new PublicationPendingError(record);
};
