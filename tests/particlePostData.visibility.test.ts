import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$lib/url/url", () => ({
  buildChainApiUrl: (path: string) => `https://api.example.invalid${path}`,
}));

const OWNER = `0x${"12".repeat(20)}`;
const OTHER_OWNER = `0x${"34".repeat(20)}`;
const CHAIN_ADDRESS = `0x${"ab".repeat(20)}`;

const jsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } });
const feedItem = (name: string, kind = "connector", owner = OWNER) => ({
  feed_id: `feed-${name}`,
  event_type: `${kind}_added`,
  status: "finalized",
  visible: true,
  tx_hash: `0x${"cd".repeat(32)}`,
  block_number: 1,
  tx_index: 0,
  log_index: 0,
  history_cursor: "0000000000000001:0000:0000",
  created_at_ms: 12345,
  updated_at_ms: 12345,
  projector_version: 1,
  payload: { type: kind, name, owner },
});
const feedResponse = (items: unknown[], nextBefore: string | null = null) =>
  jsonResponse({
    limit: 128,
    cursor: { has_more: Boolean(nextBefore), next_before: nextBefore },
    items,
  });
const connectorResponse = (name: string, owner = OWNER, address = CHAIN_ADDRESS) =>
  jsonResponse({ name, owner, address, dimensions: [{ transformations: [] }] });
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe("published operation discovery", () => {
  beforeEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    const mod = await import("../src/lib/feed/particlePostData");
    mod.resetParticlePostDataCacheForDebug();
  });

  it("hides finalized local connectors, transformations and conditions from public feeds, search and Explore", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        if (path === "/feed")
          return feedResponse([
            feedItem("score_study_v2"),
            feedItem("pitch"),
            feedItem("local-step", "transformation"),
            feedItem("chain-step", "transformation"),
            feedItem("local-gate", "condition"),
            feedItem("chain-gate", "condition"),
          ]);
        const name = path.split("/").at(-1)!;
        const address =
          name.startsWith("local-") || name === "score_study_v2" ? "0x0" : CHAIN_ADDRESS;
        if (path.startsWith("/connector/")) return connectorResponse(name, OWNER, address);
        if (path.startsWith("/transformation/") || path.startsWith("/condition/"))
          return jsonResponse({ name, owner: OWNER, address, args_count: 0 });
        throw new Error(`Unexpected request ${path}`);
      }),
    );
    const mod = await import("../src/lib/feed/particlePostData");
    // Even an owner's public profile/feed contains published activity, not local drafts.
    await mod.syncParticlePostDataFromChain({ sourceAddresses: [OWNER] });
    expect(mod.listNetworkFeedEvents().map((event) => event.type)).toEqual([
      "transformation",
      "connector",
      "condition",
    ]);
    expect(mod.listParticleRecords().map((item) => item.name)).toEqual(["pitch"]);
    expect(Object.keys(mod.getParticleDependencyRegistrySnapshot().connectors)).toEqual(["pitch"]);
    expect(mod.listParticleSearchEntities()).toMatchObject({
      connectors: [{ id: "pitch" }],
      transformations: [{ id: "chain-step" }],
      conditions: [{ id: "chain-gate" }],
    });
    expect(mod.listNetworkFeedEvents().every((event) => event.createdAt === 12345)).toBe(true);
  });

  it.each(["0x0", `0x${"0".repeat(40)}`, undefined])(
    "does not expose a local or unverified connector through its public detail loader (%s)",
    async (address) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse({
            name: "score_study_v2",
            owner: OWNER,
            address,
            dimensions: [{ transformations: [] }],
          }),
        ),
      );
      const mod = await import("../src/lib/feed/particlePostData");
      expect(await mod.ensureParticleRecordLoadedById("score_study_v2")).toBeNull();
      expect(mod.getParticleRecordById("score_study_v2")).toBeNull();
      expect(mod.listParticleSearchEntities().connectors).toEqual([]);
      expect(mod.getParticleDependencyRegistrySnapshot().connectors).toEqual({});
    },
  );

  it("preserves valid historical published activity when another feed detail fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        if (path === "/feed") return feedResponse([feedItem("missing"), feedItem("pitch")]);
        if (path === "/connector/pitch") return connectorResponse("pitch");
        return new Response("Not found", { status: 404 });
      }),
    );
    const mod = await import("../src/lib/feed/particlePostData");
    await mod.syncParticlePostDataFromChain();
    expect(mod.listParticleRecords().map((item) => item.id)).toEqual(["pitch"]);
    expect(mod.listNetworkFeedEvents()).toEqual([
      expect.objectContaining({ createdAt: 12345, particleId: "pitch" }),
    ]);
  });

  it("does not reintroduce local creates through public profile snapshot backfill", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        if (path === "/feed") return feedResponse([feedItem("score_study_v2"), feedItem("pitch")]);
        if (path === `/account/${OWNER}`)
          return jsonResponse({
            owned_connectors: ["score_study_v2", "pitch"],
            owned_transformations: ["local-step", "chain-step"],
            owned_conditions: [],
          });
        if (path === "/connector/pitch") return connectorResponse("pitch");
        if (path === "/connector/score_study_v2")
          return connectorResponse("score_study_v2", OWNER, "0x0");
        if (path.startsWith("/transformation/")) {
          const name = path.split("/").at(-1)!;
          return jsonResponse({
            name,
            owner: OWNER,
            address: name === "local-step" ? "0x0" : CHAIN_ADDRESS,
            args_count: 0,
          });
        }
        throw new Error(`Unexpected request ${path}`);
      }),
    );
    const mod = await import("../src/lib/feed/profileActivity");
    const events = await mod.syncProfileActivityFromEventFeed({ sourceAddresses: [OWNER] });
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.type)).toEqual(["connector", "transformation"]);
    expect(JSON.stringify(events)).not.toContain("score_study_v2");
    expect(JSON.stringify(events)).not.toContain("local-step");
  });

  it("filters local creates from live feed deltas as well as history", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        if (path === "/feed/stream") {
          const deltas = ["draft-score", "pitch"].map((name, index) => ({
            stream_seq: index + 1,
            event_type: "connector_added",
            status: "finalized",
            feed_id: `feed-${name}`,
            history_cursor: `000000000000000${index + 1}:0000:0000`,
            created_at_ms: 12345,
            payload: { type: "connector", name, owner: OWNER },
          }));
          return new Response(
            deltas
              .map((delta) => `event: connector_added\ndata: ${JSON.stringify(delta)}\n\n`)
              .join(""),
            {
              headers: { "Content-Type": "text/event-stream" },
            },
          );
        }
        if (path === "/connector/draft-score")
          return connectorResponse("draft-score", OWNER, "0x0");
        if (path === "/connector/pitch") return connectorResponse("pitch");
        throw new Error(`Unexpected request ${path}`);
      }),
    );
    const mod = await import("../src/lib/feed/particlePostData");
    const onUpdate = vi.fn();
    const subscription = mod.createParticlePostDataStream({ onUpdate });
    try {
      await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(2));
      expect(mod.listParticleRecords().map((item) => item.id)).toEqual(["pitch"]);
      expect(mod.listNetworkFeedEvents()).toEqual([
        expect.objectContaining({ particleId: "pitch" }),
      ]);
    } finally {
      subscription.close();
    }
  });

  it("discards hydration that completes after its live subscription is closed", async () => {
    const hydration = deferred<Response>();
    const started = deferred<void>();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        if (path === "/feed/stream")
          return new Response(
            `event: connector_added\ndata: ${JSON.stringify({
              stream_seq: 1,
              event_type: "connector_added",
              status: "safe",
              feed_id: "late",
              history_cursor: "cursor",
              created_at_ms: 12345,
              payload: { type: "connector", name: "late-pitch", owner: OWNER },
            })}\n\n`,
            { headers: { "Content-Type": "text/event-stream" } },
          );
        if (path === "/connector/late-pitch") {
          started.resolve();
          return hydration.promise;
        }
        throw new Error(`Unexpected request ${path}`);
      }),
    );
    const mod = await import("../src/lib/feed/particlePostData");
    const onUpdate = vi.fn();
    const subscription = mod.createParticlePostDataStream({ onUpdate });
    await started.promise;
    subscription.close();
    hydration.resolve(connectorResponse("late-pitch"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mod.listNetworkFeedEvents()).toEqual([]);
    expect(mod.listParticleRecords()).toEqual([]);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("does not let an obsolete account load replace the newer feed scope", async () => {
    const oldResponse = deferred<Response>();
    let feedRequests = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input)).pathname;
        if (path === "/feed") {
          feedRequests += 1;
          return feedRequests === 1
            ? oldResponse.promise
            : feedResponse([feedItem("new-pitch", "connector", OTHER_OWNER)]);
        }
        if (path === "/connector/old-pitch") return connectorResponse("old-pitch");
        if (path === "/connector/new-pitch") return connectorResponse("new-pitch", OTHER_OWNER);
        throw new Error(`Unexpected request ${path}`);
      }),
    );
    const mod = await import("../src/lib/feed/particlePostData");
    const oldLoad = mod.syncParticlePostDataFromChain({ sourceAddresses: [OWNER] });
    await mod.syncParticlePostDataFromChain({ sourceAddresses: [OTHER_OWNER] });
    oldResponse.resolve(feedResponse([feedItem("old-pitch")]));
    await oldLoad;
    expect(mod.doesParticlePostCacheMatchSources([OTHER_OWNER])).toBe(true);
    expect(mod.listParticleRecords().map((item) => item.id)).toEqual(["new-pitch"]);
  });

  it("does not merge an obsolete pagination request into a different account's feed", async () => {
    const oldPage = deferred<Response>();
    let feedRequests = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        if (url.pathname === "/feed" && url.searchParams.has("before")) return oldPage.promise;
        if (url.pathname === "/feed") {
          feedRequests += 1;
          return feedRequests === 1
            ? feedResponse([feedItem("old-pitch")], "older")
            : feedResponse([feedItem("new-pitch", "connector", OTHER_OWNER)]);
        }
        const name = url.pathname.split("/").at(-1)!;
        return connectorResponse(name, name === "new-pitch" ? OTHER_OWNER : OWNER);
      }),
    );
    const mod = await import("../src/lib/feed/particlePostData");
    await mod.syncParticlePostDataFromChain({ sourceAddresses: [OWNER] });
    const pagination = mod.loadMoreParticlePostDataFromChain({ sourceAddresses: [OWNER] });
    await mod.syncParticlePostDataFromChain({ sourceAddresses: [OTHER_OWNER] });
    oldPage.resolve(feedResponse([feedItem("old-page-pitch")]));
    await pagination;
    expect(mod.doesParticlePostCacheMatchSources([OTHER_OWNER])).toBe(true);
    expect(mod.listParticleRecords().map((item) => item.id)).toEqual(["new-pitch"]);
  });
});
