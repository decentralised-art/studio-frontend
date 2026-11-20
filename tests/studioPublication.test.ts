import type { PreparedPublication } from "decentralised-art";
import { describe, expect, it, vi } from "vitest";
import type { BrowserEthereumProvider } from "../src/lib/auth/api";
import { ChainApiRequestError } from "../src/lib/chain/registryApi";
import {
  createPublicationDraft,
  createPublicationStore,
  publishStudioEntity,
  recoverPublicationHash,
} from "../src/lib/studio/studioPublication";

const owner = `0x${"12".repeat(20)}`;
const txHash = `0x${"ab".repeat(32)}`;
const contentHash = `0x${"cd".repeat(32)}`;
const prepared: PreparedPublication = {
  kind: "connector",
  name: "demo",
  status: "prepared",
  address: owner,
  content_hash: contentHash,
  publication_nonce: 0,
  deadline: 4_000_000_000,
  transaction: {
    from: owner,
    to: `0x${"34".repeat(20)}`,
    chainId: "0xaa36a7",
    gas: "0x10000",
    data: "0xabcd",
  },
};
const mined = {
  status: "mined" as const,
  kind: "connector" as const,
  name: "demo",
  tx_hash: txHash,
  content_hash: contentHash,
  block_number: 42,
  owner,
  address: owner,
};

const fixture = () => {
  const storage = new Map<string, string>();
  const backing = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
  };
  const request = vi.fn(async ({ method }: { method: string }) => {
    if (method === "eth_accounts") return [owner];
    if (method === "eth_chainId") return "0xaa36a7";
    if (method === "eth_sendTransaction") return txHash;
    throw new Error(`Unexpected wallet method ${method}`);
  });
  const api = {
    createDraft: vi.fn(async () => ({ address: "0x0" })),
    prepare: vi.fn(async () => prepared),
    confirm: vi.fn(async () => mined),
  };
  return {
    kind: "connector" as const,
    name: "demo",
    body: { name: "demo", dimensions: [] },
    expectedOwner: owner,
    store: createPublicationStore("server:owner", backing),
    backing,
    request,
    api,
    provider: { request } as BrowserEthereumProvider,
    maxConfirmAttempts: 2,
    wait: vi.fn(async () => {}),
    withLock: async (_scope: string, operation: () => Promise<void>) => operation(),
  };
};

describe("Studio publication lifecycle", () => {
  it("deduplicates simultaneous publish calls while preparation is unresolved", async () => {
    const input = fixture();
    let resolvePrepare!: (value: PreparedPublication) => void;
    input.api.prepare.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePrepare = resolve;
        }),
    );
    const first = publishStudioEntity(input);
    const second = publishStudioEntity(input);
    await vi.waitFor(() => expect(input.api.prepare).toHaveBeenCalledOnce());
    resolvePrepare(prepared);
    await Promise.all([first, second]);
    expect(input.api.createDraft).toHaveBeenCalledOnce();
    expect(
      input.request.mock.calls.filter(([call]) => call.method === "eth_sendTransaction"),
    ).toHaveLength(1);
  });

  it("serializes two tabs using fresh owner-scoped storage, including different entity names", async () => {
    const first = fixture();
    let queue: Promise<void> = Promise.resolve();
    const withLock = (_scope: string, operation: () => Promise<void>) => {
      const next = queue.then(operation);
      queue = next.catch(() => {});
      return next;
    };
    // Both tabs load before either sends: the second must re-read under the lock.
    const secondStore = createPublicationStore("server:owner", first.backing);
    first.api.confirm.mockResolvedValue({ status: "pending", message: "waiting" } as never);
    const operationA = publishStudioEntity({ ...first, withLock });
    const operationB = publishStudioEntity({ ...first, store: secondStore, withLock });
    await expect(operationA).rejects.toThrow(/pending/);
    await expect(operationB).rejects.toThrow(/pending/);
    expect(
      first.request.mock.calls.filter(([call]) => call.method === "eth_sendTransaction"),
    ).toHaveLength(1);
    await expect(
      publishStudioEntity({
        ...first,
        name: "other",
        body: { name: "other" },
        store: secondStore,
        withLock,
      }),
    ).rejects.toThrow(/Complete or recover/);
    expect(first.api.prepare).toHaveBeenCalledOnce();
  });

  it("recovers a speed-up transaction hash and validates its receipt before marking mined", async () => {
    const input = fixture();
    input.api.confirm.mockResolvedValue({ status: "pending", message: "waiting" } as never);
    await expect(publishStudioEntity(input)).rejects.toThrow(/pending/);
    const replacement = `0x${"ef".repeat(32)}`;
    recoverPublicationHash(input.store, input.store.get("connector", "demo")!, replacement);
    input.api.confirm.mockResolvedValue({ ...mined, tx_hash: replacement });
    await publishStudioEntity(input);
    expect(input.store.get("connector", "demo")).toMatchObject({
      stage: "mined",
      tx_hash: replacement,
      tx_history: [txHash],
    });
    expect(
      input.request.mock.calls.filter(([call]) => call.method === "eth_sendTransaction"),
    ).toHaveLength(1);
  });

  it("resumes mined A → pending B → parent in dependency order without resending either child", async () => {
    const input = fixture();
    const parentHash = `0x${"89".repeat(32)}`;
    input.store.put({
      kind: "connector",
      name: "A",
      fingerprint: JSON.stringify({ name: "A" }),
      stage: "mined",
      owner,
      chainId: "0xaa36a7",
      content_hash: contentHash,
      tx_hash: txHash,
    });
    input.store.put({
      kind: "connector",
      name: "B",
      fingerprint: JSON.stringify({ name: "B" }),
      stage: "pending",
      owner,
      chainId: "0xaa36a7",
      content_hash: contentHash,
      tx_hash: txHash,
    });
    const operations: string[] = [];
    for (const name of ["A", "B", "parent"]) {
      await publishStudioEntity({
        ...input,
        name,
        body: { name },
        api: {
          createDraft: async () => {
            operations.push(`create:${name}`);
          },
          prepare: async () => {
            operations.push(`prepare:${name}`);
            return { ...prepared, name };
          },
          confirm: async (request) => {
            operations.push(`confirm:${name}`);
            return { ...mined, name, tx_hash: request.tx_hash };
          },
        },
        provider: {
          request: async ({ method }) => {
            if (method === "eth_accounts") return [owner];
            if (method === "eth_chainId") return "0xaa36a7";
            operations.push(`send:${name}`);
            return parentHash;
          },
        } as BrowserEthereumProvider,
      });
    }
    expect(operations).toEqual([
      "confirm:B",
      "create:parent",
      "prepare:parent",
      "send:parent",
      "confirm:parent",
    ]);
    expect(input.store.list().every((record) => record.stage === "mined")).toBe(true);
  });

  it.each([undefined, NaN, 0, -1])(
    "rejects malformed deadline %s before sending",
    async (deadline) => {
      const input = fixture();
      input.api.prepare.mockResolvedValue({ ...prepared, deadline } as PreparedPublication);
      await expect(publishStudioEntity(input)).rejects.toThrow(/deadline/);
      expect(input.request).not.toHaveBeenCalled();
    },
  );

  it("rejects a preparation owned by a different authenticated session", async () => {
    const input = fixture();
    await expect(
      publishStudioEntity({ ...input, expectedOwner: `0x${"ff".repeat(20)}` }),
    ).rejects.toThrow(/owner changed/);
    expect(input.request).not.toHaveBeenCalled();
  });
  it("creates a local draft, prepares, checks the wallet, sends once and confirms", async () => {
    const input = fixture();
    await publishStudioEntity(input);
    expect(input.api.createDraft).toHaveBeenCalledOnce();
    expect(input.request.mock.calls.map(([call]) => call.method)).toEqual([
      "eth_accounts",
      "eth_chainId",
      "eth_sendTransaction",
    ]);
    expect(input.api.confirm).toHaveBeenCalledWith({
      name: "demo",
      content_hash: contentHash,
      tx_hash: txHash,
    });
    expect(input.store.get("connector", "demo")).toMatchObject({
      stage: "mined",
      address: owner,
      tx_hash: txHash,
      chainId: "0xaa36a7",
    });
  });

  it("keeps draft creation separate from signing or chain publication", async () => {
    const input = fixture();
    await createPublicationDraft({ ...input, createDraft: input.api.createDraft });
    expect(input.store.get("connector", "demo")?.stage).toBe("draft");
    expect(input.api.prepare).not.toHaveBeenCalled();
    expect(input.request).not.toHaveBeenCalled();
    await publishStudioEntity(input);
    expect(input.api.createDraft).toHaveBeenCalledOnce();
  });

  it("polls pending receipts without repeating wallet submission", async () => {
    const input = fixture();
    input.api.confirm.mockResolvedValueOnce({
      status: "pending",
      message: "waiting",
      tx_hash: txHash,
    } as never);
    await publishStudioEntity(input);
    expect(input.wait).toHaveBeenCalledOnce();
    expect(input.api.confirm).toHaveBeenCalledTimes(2);
    expect(
      input.request.mock.calls.filter(([call]) => call.method === "eth_sendTransaction"),
    ).toHaveLength(1);
  });

  it("resumes a persisted pending hash after reload, without create/prepare/send", async () => {
    const input = fixture();
    input.api.confirm.mockResolvedValue({ status: "pending", message: "waiting" } as never);
    await expect(publishStudioEntity(input)).rejects.toThrow(/still pending/);
    input.api.confirm.mockResolvedValue(mined);
    input.store = createPublicationStore("server:owner", input.backing);
    await publishStudioEntity(input);
    expect(input.api.createDraft).toHaveBeenCalledOnce();
    expect(input.api.prepare).toHaveBeenCalledOnce();
    expect(
      input.request.mock.calls.filter(([call]) => call.method === "eth_sendTransaction"),
    ).toHaveLength(1);
  });

  it("reconciles an existing hash independently of the current draft or registry projection", async () => {
    const input = fixture();
    const onProgress = vi.fn();
    input.store.put({
      kind: "connector",
      name: "demo",
      fingerprint: JSON.stringify(input.body),
      owner,
      chainId: "0xaa36a7",
      stage: "pending",
      content_hash: contentHash,
      tx_hash: txHash,
    });
    await publishStudioEntity({
      ...input,
      mode: "recover",
      body: { address: owner },
      onProgress,
    });
    expect(input.api.createDraft).not.toHaveBeenCalled();
    expect(input.api.prepare).not.toHaveBeenCalled();
    expect(input.request.mock.calls.some(([call]) => call.method === "eth_sendTransaction")).toBe(
      false,
    );
    expect(onProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "connector", name: "demo", phase: "mined", txHash }),
    );
    expect(input.store.get("connector", "demo")).toMatchObject({
      stage: "mined",
      block_number: 42,
      tx_hash: txHash,
    });
  });

  it("verifies a hashless wallet submission through the already-published response", async () => {
    const input = fixture();
    input.store.put({
      kind: "connector",
      name: "demo",
      fingerprint: JSON.stringify(input.body),
      owner,
      chainId: "0xaa36a7",
      stage: "sending",
      content_hash: contentHash,
      tx_history: [txHash],
    });
    await expect(publishStudioEntity({ ...input, mode: "recover" })).rejects.toThrow(
      /recover its transaction hash/,
    );
    expect(input.store.get("connector", "demo")?.stage).toBe("sending");
    input.api.prepare.mockResolvedValueOnce({
      ...prepared,
      status: "published",
      owner,
      content_hash: `0x${"ee".repeat(32)}`,
    } as never);
    await expect(publishStudioEntity({ ...input, mode: "recover" })).rejects.toThrow(
      /artifact changed/,
    );
    expect(input.store.get("connector", "demo")?.stage).toBe("sending");
    input.api.prepare.mockResolvedValueOnce({ ...prepared, status: "published", owner } as never);
    await publishStudioEntity({ ...input, mode: "recover" });
    expect(input.store.get("connector", "demo")).toMatchObject({
      stage: "mined",
      address: owner,
      tx_history: [txHash],
    });
    expect(input.api.confirm).not.toHaveBeenCalled();
    expect(input.request.mock.calls.some(([call]) => call.method === "eth_sendTransaction")).toBe(
      false,
    );
  });

  it("allows receipt inspection for one entity while another wallet entry is unresolved", async () => {
    const input = fixture();
    for (const name of ["demo", "other"]) {
      input.store.put({
        kind: "connector",
        name,
        fingerprint: JSON.stringify({ name }),
        owner,
        chainId: "0xaa36a7",
        stage: "pending",
        content_hash: contentHash,
        tx_hash: txHash,
      });
    }
    await publishStudioEntity({ ...input, mode: "recover" });
    expect(input.store.get("connector", "demo")?.stage).toBe("mined");
    await expect(
      publishStudioEntity({ ...input, name: "new", body: { name: "new" } }),
    ).rejects.toThrow(/pending publication 'other'/);
    expect(input.api.prepare).not.toHaveBeenCalled();
  });

  it("rechecks a mined journal receipt when the caller explicitly requests proof", async () => {
    const input = fixture();
    await publishStudioEntity(input);
    await publishStudioEntity({ ...input, mode: "recover" });
    expect(input.api.prepare).toHaveBeenCalledOnce();
    expect(input.api.confirm).toHaveBeenCalledTimes(2);
    expect(
      input.request.mock.calls.filter(([call]) => call.method === "eth_sendTransaction"),
    ).toHaveLength(1);
  });

  it("stops before opening the wallet when the fresh preparation is outside the review", async () => {
    const input = fixture();
    const onPrepared = vi.fn(async () => {
      throw new Error("New fee estimate needs review.");
    });
    await expect(publishStudioEntity({ ...input, onPrepared })).rejects.toThrow(/needs review/);
    expect(onPrepared).toHaveBeenCalledWith(prepared);
    expect(input.store.get("connector", "demo")?.stage).toBe("draft");
    expect(input.request).not.toHaveBeenCalled();
    expect(input.api.confirm).not.toHaveBeenCalled();
  });

  it("does not republish mined entities while the safe block/indexer catches up", async () => {
    const input = fixture();
    await publishStudioEntity(input);
    await publishStudioEntity(input);
    expect(input.api.prepare).toHaveBeenCalledOnce();
    expect(input.api.confirm).toHaveBeenCalledOnce();
  });

  it("does not resend after an authorization or transport failure during confirmation", async () => {
    const input = fixture();
    input.api.confirm.mockRejectedValueOnce({ status: 401, message: "expired" });
    await expect(publishStudioEntity(input)).rejects.toMatchObject({ status: 401 });
    await publishStudioEntity(input);
    expect(input.api.confirm).toHaveBeenCalledTimes(2);
    expect(
      input.request.mock.calls.filter(([call]) => call.method === "eth_sendTransaction"),
    ).toHaveLength(1);
  });

  it("requires a fresh review after a confirmed wallet transaction reverts", async () => {
    const input = fixture();
    input.api.confirm.mockRejectedValueOnce(
      new ChainApiRequestError("transaction reverted", 400, {
        message: "transaction reverted",
        tx_hash: txHash,
      }),
    );
    await expect(publishStudioEntity(input)).rejects.toThrow(/reverted on-chain.*review/i);
    expect(input.store.get("connector", "demo")).toMatchObject({
      stage: "draft",
      tx_history: [txHash],
    });
    expect(input.store.get("connector", "demo")?.tx_hash).toBeUndefined();
    expect(
      input.request.mock.calls.filter(([call]) => call.method === "eth_sendTransaction"),
    ).toHaveLength(1);
    expect(input.api.prepare).toHaveBeenCalledOnce();
    await publishStudioEntity(input);
    expect(input.api.prepare).toHaveBeenCalledTimes(2);
    expect(input.store.get("connector", "demo")?.stage).toBe("mined");
  });

  it.each([
    { label: "legacy wallet hash", history: undefined, source: undefined, releases: true },
    { label: "legacy recovered hash", history: [], source: undefined, releases: false },
    { label: "recovered hash", history: [txHash], source: "recovered" as const, releases: false },
  ])("uses the recorded provenance of a $label", async ({ history, source, releases }) => {
    const input = fixture();
    input.store.put({
      kind: "connector",
      name: "demo",
      fingerprint: JSON.stringify(input.body),
      owner,
      chainId: "0xaa36a7",
      stage: "pending",
      content_hash: contentHash,
      tx_hash: txHash,
      tx_source: source,
      tx_history: history,
    });
    const error = new ChainApiRequestError("transaction reverted", 400, {
      message: "transaction reverted",
      tx_hash: txHash,
    });
    input.api.confirm.mockRejectedValueOnce(error);
    const result = publishStudioEntity({ ...input, mode: "recover" });
    if (releases) await expect(result).rejects.toThrow(/reverted on-chain/);
    else await expect(result).rejects.toBe(error);
    expect(input.store.get("connector", "demo")?.stage).toBe(releases ? "draft" : "pending");
    expect(input.request.mock.calls.some(([call]) => call.method === "eth_sendTransaction")).toBe(
      false,
    );
  });

  it.each([
    { status: 503, message: "transaction reverted", hash: txHash },
    { status: 400, message: "transaction reverted on estimate", hash: txHash },
    { status: 400, message: "transaction reverted", hash: `0x${"ef".repeat(32)}` },
  ])(
    "keeps the wallet hash pending for non-verifying confirmation errors",
    async ({ status, message, hash }) => {
      const input = fixture();
      const error = new ChainApiRequestError(message, status, { message, tx_hash: hash });
      input.api.confirm.mockRejectedValueOnce(error);
      await expect(publishStudioEntity(input)).rejects.toBe(error);
      expect(input.store.get("connector", "demo")).toMatchObject({
        stage: "pending",
        tx_hash: txHash,
        tx_source: "wallet",
      });
    },
  );

  it.each(["account", "network"])("blocks %s mismatches before sending", async (mismatch) => {
    const input = fixture();
    input.request.mockImplementation(async ({ method }) =>
      method === "eth_accounts" ? [mismatch === "account" ? `0x${"ff".repeat(20)}` : owner] : "0x1",
    );
    await expect(publishStudioEntity(input)).rejects.toThrow(
      mismatch === "account" ? /owner/ : /Sepolia/,
    );
    expect(input.request.mock.calls.some(([call]) => call.method === "eth_sendTransaction")).toBe(
      false,
    );
    expect(input.api.confirm).not.toHaveBeenCalled();
  });

  it("handles explicit wallet rejection as a saved draft", async () => {
    const input = fixture();
    input.request.mockImplementation(async ({ method }) => {
      if (method === "eth_accounts") return [owner];
      if (method === "eth_chainId") return "0xaa36a7";
      throw { code: 4001 };
    });
    await expect(publishStudioEntity(input)).rejects.toThrow(/rejected/);
    expect(input.store.get("connector", "demo")?.stage).toBe("draft");
  });

  it("blocks ambiguous wallet retries until a transaction hash is recovered", async () => {
    const input = fixture();
    input.request.mockImplementation(async ({ method }) => {
      if (method === "eth_accounts") return [owner];
      if (method === "eth_chainId") return "0xaa36a7";
      throw new Error("disconnected");
    });
    await expect(publishStudioEntity(input)).rejects.toThrow(/could not be verified/);
    await expect(publishStudioEntity(input)).rejects.toThrow(/No second transaction/);
    recoverPublicationHash(input.store, input.store.get("connector", "demo")!, txHash);
    await publishStudioEntity(input);
    expect(
      input.request.mock.calls.filter(([call]) => call.method === "eth_sendTransaction"),
    ).toHaveLength(1);
  });

  it("surfaces the wallet hash when the browser cannot save it", async () => {
    const input = fixture();
    const store = createPublicationStore("server:owner", {
      ...input.backing,
      setItem: (key, value) => {
        if (value.includes('"stage":"pending"')) throw new Error("Storage unavailable");
        input.backing.setItem(key, value);
      },
    });
    await expect(publishStudioEntity({ ...input, store })).rejects.toThrow(txHash);
    expect(store.get("connector", "demo")?.stage).toBe("sending");
    await expect(publishStudioEntity({ ...input, store })).rejects.toThrow(
      /recover its transaction/,
    );
    expect(input.api.confirm).not.toHaveBeenCalled();
    expect(
      input.request.mock.calls.filter(([call]) => call.method === "eth_sendTransaction"),
    ).toHaveLength(1);
  });

  it("rejects content edits under a saved publication name", async () => {
    const input = fixture();
    await publishStudioEntity(input);
    await expect(
      publishStudioEntity({ ...input, body: { name: "demo", dimensions: [1] } }),
    ).rejects.toThrow(/different content/);
  });

  it("handles an already-published artifact without a transaction", async () => {
    const input = fixture();
    input.api.prepare.mockResolvedValue({ ...prepared, status: "published", owner } as never);
    await publishStudioEntity(input);
    expect(input.request).not.toHaveBeenCalled();
    expect(input.api.confirm).not.toHaveBeenCalled();
    expect(input.store.get("connector", "demo")).toMatchObject({
      stage: "mined",
      owner,
      content_hash: contentHash,
      address: owner,
    });
  });

  it("does not accept a confirmation for a different artifact", async () => {
    const input = fixture();
    input.api.confirm.mockResolvedValue({ ...mined, content_hash: `0x${"ff".repeat(32)}` });
    await expect(publishStudioEntity(input)).rejects.toThrow(/does not match/);
    expect(input.store.get("connector", "demo")?.stage).toBe("pending");
  });
});
