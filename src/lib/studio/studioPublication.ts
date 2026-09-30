import type { BrowserEthereumProvider } from "$lib/auth/api";
import type {
  ConfirmRequest,
  ConfirmResponse,
  EntityKind,
  PrepareResponse,
  PublishError,
} from "dcn";

export type PublicationRecord = {
  fingerprint: string;
  kind: EntityKind;
  name: string;
  stage: "draft" | "sending" | "pending" | "mined";
  content_hash?: string;
  tx_hash?: string;
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
    tx_history: [
      ...new Set([...(record.tx_history ?? []), ...(record.tx_hash ? [record.tx_hash] : [])]),
    ],
    stage: "pending",
  });
};

/** Only API callbacks may retry auth. Never wrap this whole operation in auth retry. */
type PublicationInput = {
  expectedOwner: string;
  kind: EntityKind;
  name: string;
  body: unknown;
  api: PublicationApi;
  provider: BrowserEthereumProvider;
  store: PublicationStore;
  onStatus?: (message: string) => void;
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
  const key = `${input.kind}:${input.name}`;
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

const runPublication = async (input: PublicationInput): Promise<void> => {
  const { api, store, provider, onStatus = () => {} } = input;
  onStatus(`Creating local ${input.kind} draft '${input.name}'...`);
  let record = await createPublicationDraft({ ...input, createDraft: api.createDraft });
  if (record.owner && record.owner.toLowerCase() !== input.expectedOwner.toLowerCase())
    throw new Error("Saved publication belongs to a different wallet owner.");
  if (record.owner && record.chainId) await assertWallet(provider, record.owner, record.chainId);
  if (record.stage === "mined") {
    onStatus(
      `'${input.name}' is already mined. Safe-block execution and indexing may still be catching up.`,
    );
    return;
  }
  const unresolved = store
    .list()
    .find(
      (record) =>
        ["sending", "pending"].includes(record.stage) &&
        (record.kind !== input.kind || record.name !== input.name),
    );
  if (unresolved)
    throw new Error(
      `Complete or recover pending publication '${unresolved.name}' before publishing another entity from this wallet.`,
    );
  if (record.stage === "sending") {
    throw new Error(
      `The wallet may have sent '${record.name}'. Check wallet activity and recover its transaction hash below before retrying. No second transaction was sent.`,
    );
  }
  if (record.stage !== "pending") {
    onStatus(`Preparing ${input.kind} '${input.name}' for publication...`);
    const prepared = await api.prepare();
    if (prepared.kind !== input.kind || prepared.name !== input.name)
      throw new Error("Publication preparation returned a different entity.");
    if (record.content_hash && record.content_hash !== prepared.content_hash)
      throw new Error(
        "Prepared artifact changed since the previous publication attempt. Use a new name.",
      );
    const preparedOwner =
      prepared.status === "published" ? prepared.owner : prepared.transaction.from;
    if (preparedOwner.toLowerCase() !== input.expectedOwner.toLowerCase())
      throw new Error(
        "Publication owner changed during authentication. Retry from the correct wallet account.",
      );
    if (prepared.status === "published") {
      store.put({
        ...record,
        content_hash: prepared.content_hash,
        address: prepared.address,
        stage: "mined",
      });
      onStatus(`'${input.name}' is already published.`);
      return;
    }
    const transaction = prepared.transaction;
    if (
      !/^0x[0-9a-f]{40}$/i.test(transaction.from) ||
      !/^0x[0-9a-f]{40}$/i.test(transaction.to) ||
      !/^0x[0-9a-f]+$/i.test(transaction.chainId) ||
      !/^0x[0-9a-f]+$/i.test(transaction.gas) ||
      !/^0x(?:[0-9a-f]{2})+$/i.test(transaction.data) ||
      !/^0x[0-9a-f]{64}$/i.test(prepared.content_hash)
    ) {
      throw new Error("The server returned an invalid publication transaction.");
    }
    if (
      !Number.isSafeInteger(prepared.deadline) ||
      prepared.deadline <= 0 ||
      prepared.deadline * 1000 <= Date.now()
    )
      throw new Error(
        "Publication preparation has an invalid or expired deadline. Retry Publish to prepare again.",
      );
    await assertWallet(provider, transaction.from, transaction.chainId);
    record = {
      ...record,
      content_hash: prepared.content_hash,
      owner: transaction.from,
      chainId: transaction.chainId,
      stage: "sending",
    };
    store.put(record);
    onStatus(
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
    if (typeof hash !== "string" || !/^0x[0-9a-f]{64}$/i.test(hash))
      throw new Error(
        "Wallet returned an invalid transaction hash. Check wallet activity and recover it below.",
      );
    record = { ...record, tx_hash: hash, stage: "pending" };
    store.put(record);
  }
  if (!record.tx_hash || !record.content_hash)
    throw new Error("Saved publication lacks its transaction or content hash.");
  for (let attempt = 0; attempt < (input.maxConfirmAttempts ?? 12); attempt += 1) {
    onStatus(`Confirming '${input.name}' — ${record.tx_hash} (check ${attempt + 1})...`);
    const result = await api.confirm({
      name: input.name,
      content_hash: record.content_hash,
      tx_hash: record.tx_hash,
    });
    if (result.status === "mined") {
      if (
        result.name !== input.name ||
        result.kind !== input.kind ||
        result.tx_hash.toLowerCase() !== record.tx_hash.toLowerCase() ||
        result.content_hash !== record.content_hash ||
        result.owner.toLowerCase() !== input.expectedOwner.toLowerCase()
      )
        throw new Error("Confirmation does not match the saved publication.");
      store.put({ ...record, address: result.address, stage: "mined" });
      onStatus(`Published '${input.name}' in block ${result.block_number}.`);
      return;
    }
    if (result.status !== "pending")
      throw new Error(result.message || "Unexpected publication confirmation.");
    if (attempt + 1 < (input.maxConfirmAttempts ?? 12))
      await (input.wait?.() ?? new Promise((resolve) => setTimeout(resolve, 3000)));
  }
  throw new PublicationPendingError(record);
};
