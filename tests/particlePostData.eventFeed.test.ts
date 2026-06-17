import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$lib/url/url", () => ({
  buildChainApiUrl: (path: string) => `https://api.example.invalid${path}`,
}));

const OWNER = "0xb584a15f38c2014cff54fdb1b417428b51999276";
const OTHER_OWNER = "0x71a60533defdc8e989392068f0d97c9e71974839";
const FORMAT_HASH = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("particlePostData event feed sync", () => {
  beforeEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    const mod = await import("../src/lib/feed/particlePostData");
    mod.resetParticlePostDataCacheForDebug();
  });

  it("uses /feed as the default sync path and hydrates visible feed details", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/feed") {
        expect(url.searchParams.get("limit")).toBe("128");
        expect(url.searchParams.get("include_unfinalized")).toBe("1");
        return jsonResponse({
          limit: 128,
          cursor: {
            has_more: true,
            next_before: "cursor-before",
          },
          items: [
            feedItem({
              feed_id: "feed-connector-alpha",
              event_type: "connector_added",
              created_at_ms: 300,
              payload: {
                type: "connector",
                name: "connector-alpha",
                owner: OWNER.toUpperCase(),
              },
            }),
            feedItem({
              feed_id: "feed-transformation-add",
              event_type: "transformation_added",
              created_at_ms: 200,
              payload: {
                type: "transformation",
                name: "add",
                owner: OWNER,
              },
            }),
            feedItem({
              feed_id: "feed-connector-foreign",
              event_type: "connector_added",
              created_at_ms: 100,
              payload: {
                type: "connector",
                name: "foreign",
                owner: OTHER_OWNER,
              },
            }),
          ],
        });
      }
      if (url.pathname === "/connector/connector-alpha") {
        return jsonResponse({
          name: "connector-alpha",
          owner: OWNER,
          format_hash: FORMAT_HASH,
          dimensions: [
            {
              composite: "pitch",
              transformations: [{ name: "add", args: [1, 2] }],
            },
            {
              composite: "time",
              transformations: [],
            },
          ],
        });
      }
      if (url.pathname === "/transformation/add") {
        return jsonResponse({
          name: "add",
          owner: OWNER,
          sol_src: "return x + args[1];",
        });
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("../src/lib/feed/particlePostData");
    await mod.syncParticlePostDataFromChain({
      force: true,
      sourceAddresses: [OWNER],
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual([
      "/feed",
      "/connector/connector-alpha",
      "/transformation/add",
    ]);
    expect(mod.doesParticlePostCacheMatchSources([OWNER])).toBe(true);

    const events = mod.listNetworkFeedEvents();
    expect(events).toEqual([
      expect.objectContaining({
        type: "connector",
        id: "event-connector-created-feed-connector-alpha",
        authorId: OWNER,
        particleId: "connector-alpha",
        formatHash: FORMAT_HASH,
        usedParticleIds: ["pitch", "time"],
      }),
      expect.objectContaining({
        type: "transformation",
        id: "event-transformation-created-feed-transformation-add",
        authorId: OWNER,
        elementId: "add",
        runtimeSnippet: "return x + args[1];",
      }),
    ]);
    expect(mod.listParticleRecordsByFormatHash(FORMAT_HASH)).toEqual([
      expect.objectContaining({
        id: "connector-alpha",
        dependencies: ["pitch", "time"],
      }),
    ]);
    expect(mod.listParticleSearchEntities()).toEqual({
      connectors: [
        {
          id: "connector-alpha",
          label: "connector-alpha",
          summary: "",
          authorId: OWNER,
        },
      ],
      transformations: [
        {
          id: "add",
          label: "add",
          summary: "return x + args[1];",
          authorId: OWNER,
        },
      ],
      conditions: [],
    });
  });

  it("loads older feed pages with the next_before cursor", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/feed" && !url.searchParams.has("before")) {
        return jsonResponse({
          limit: 128,
          cursor: {
            has_more: true,
            next_before: "cursor-before",
          },
          items: [
            feedItem({
              feed_id: "feed-connector-alpha",
              created_at_ms: 300,
              payload: {
                type: "connector",
                name: "connector-alpha",
                owner: OWNER,
              },
            }),
          ],
        });
      }
      if (url.pathname === "/feed" && url.searchParams.get("before") === "cursor-before") {
        return jsonResponse({
          limit: 128,
          cursor: {
            has_more: false,
            next_before: null,
          },
          items: [
            feedItem({
              feed_id: "feed-connector-beta",
              history_cursor: "0000000000000000:0000:0000",
              created_at_ms: 200,
              payload: {
                type: "connector",
                name: "connector-beta",
                owner: OWNER,
              },
            }),
          ],
        });
      }
      if (url.pathname === "/connector/connector-alpha") {
        return connectorResponse("connector-alpha", OWNER, FORMAT_HASH);
      }
      if (url.pathname === "/connector/connector-beta") {
        return connectorResponse("connector-beta", OWNER, FORMAT_HASH);
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("../src/lib/feed/particlePostData");
    await mod.syncParticlePostDataFromChain({
      force: true,
      sourceAddresses: [OWNER],
    });
    expect(mod.getParticlePostFeedState().hasMoreHistory).toBe(true);

    await mod.loadMoreParticlePostDataFromChain({
      sourceAddresses: [OWNER],
    });

    const feedRequests = fetchMock.mock.calls
      .map(([input]) => new URL(String(input)))
      .filter((url) => url.pathname === "/feed");
    expect(feedRequests.map((url) => url.searchParams.get("before"))).toEqual([
      null,
      "cursor-before",
    ]);
    expect(mod.getParticlePostFeedState().hasMoreHistory).toBe(false);
    expect(mod.listNetworkFeedEvents().map((event) => event.id)).toEqual([
      "event-connector-created-feed-connector-alpha",
      "event-connector-created-feed-connector-beta",
    ]);
  });

  it("keeps followed-format connector candidates outside followed owners", async () => {
    const otherFormatHash = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/feed") {
        return jsonResponse({
          limit: 128,
          cursor: {
            has_more: false,
            next_before: null,
          },
          items: [
            feedItem({
              feed_id: "feed-owner-connector",
              created_at_ms: 500,
              payload: {
                type: "connector",
                name: "owner-connector",
                owner: OWNER,
              },
            }),
            feedItem({
              feed_id: "feed-format-connector",
              created_at_ms: 400,
              payload: {
                type: "connector",
                name: "format-connector",
                owner: OTHER_OWNER,
              },
            }),
            feedItem({
              feed_id: "feed-other-format-connector",
              created_at_ms: 300,
              payload: {
                type: "connector",
                name: "other-format-connector",
                owner: OTHER_OWNER,
              },
            }),
            feedItem({
              feed_id: "feed-foreign-transformation",
              event_type: "transformation_added",
              created_at_ms: 200,
              payload: {
                type: "transformation",
                name: "foreign-transform",
                owner: OTHER_OWNER,
              },
            }),
          ],
        });
      }
      if (url.pathname === "/connector/owner-connector") {
        return connectorResponse("owner-connector", OWNER, otherFormatHash);
      }
      if (url.pathname === "/connector/format-connector") {
        return connectorResponse("format-connector", OTHER_OWNER, FORMAT_HASH);
      }
      if (url.pathname === "/connector/other-format-connector") {
        return connectorResponse("other-format-connector", OTHER_OWNER, otherFormatHash);
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("../src/lib/feed/particlePostData");
    await mod.syncParticlePostDataFromChain({
      force: true,
      sourceAddresses: [OWNER],
      followedFormatHashes: [FORMAT_HASH],
    });

    expect(fetchMock.mock.calls.map(([input]) => new URL(String(input)).pathname)).not.toContain(
      "/transformation/foreign-transform",
    );
    expect(mod.listNetworkFeedEvents().map((event) => event.id)).toEqual([
      "event-connector-created-feed-owner-connector",
      "event-connector-created-feed-format-connector",
    ]);
    expect(mod.doesParticlePostCacheMatchFeedScope([OWNER], [FORMAT_HASH])).toBe(true);
  });

  it("hides removed feed entries during initial sync", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/feed") {
        return jsonResponse({
          limit: 128,
          cursor: {
            has_more: false,
            next_before: null,
          },
          items: [
            feedItem({
              feed_id: "feed-removed",
              status: "removed",
              visible: false,
              payload: {
                type: "connector",
                name: "removed-connector",
                owner: OWNER,
              },
            }),
            feedItem({
              feed_id: "feed-kept",
              payload: {
                type: "connector",
                name: "kept-connector",
                owner: OWNER,
              },
            }),
          ],
        });
      }
      if (url.pathname === "/connector/kept-connector") {
        return connectorResponse("kept-connector", OWNER, FORMAT_HASH);
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("../src/lib/feed/particlePostData");
    await mod.syncParticlePostDataFromChain({
      force: true,
      sourceAddresses: [OWNER],
    });

    expect(fetchMock.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual([
      "/feed",
      "/connector/kept-connector",
    ]);
    expect(mod.listNetworkFeedEvents().map((event) => event.id)).toEqual([
      "event-connector-created-feed-kept",
    ]);
    expect(mod.listParticleSearchEntities().connectors.map((item) => item.id)).toEqual([
      "kept-connector",
    ]);
  });

  it("does not cache projected feed events when detail hydration is incomplete", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/feed") {
        return jsonResponse({
          limit: 128,
          cursor: {
            has_more: false,
            next_before: null,
          },
          items: [
            feedItem({
              feed_id: "feed-broken",
              payload: {
                type: "connector",
                name: "broken-connector",
                owner: OWNER,
              },
            }),
          ],
        });
      }
      if (url.pathname === "/connector/broken-connector") {
        return jsonResponse({
          name: "broken-connector",
          owner: OWNER,
          dimensions: "not-a-dimension-list",
        });
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("../src/lib/feed/particlePostData");
    await expect(
      mod.syncParticlePostDataFromChain({
        force: true,
        sourceAddresses: [OWNER],
      }),
    ).rejects.toThrow(/Unable to hydrate chain feed detail/);
    expect(mod.listNetworkFeedEvents()).toEqual([]);
    expect(mod.listParticleSearchEntities()).toEqual({
      connectors: [],
      transformations: [],
      conditions: [],
    });
  });

  it("applies feed stream deltas and stale cursor metadata", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/feed/stream") {
        expect(url.searchParams.get("since_seq")).toBe("0");
        expect(url.searchParams.get("limit")).toBe("128");
        return new Response(
          [
            "event: connector_added",
            `data: ${JSON.stringify({
              stream_seq: 12,
              event_type: "connector_added",
              status: "safe",
              feed_id: "feed-streamed",
              history_cursor: "0000000000000012:0000:0000",
              created_at_ms: 600,
              payload: {
                type: "connector",
                name: "streamed",
                owner: OWNER,
              },
            })}`,
            "",
            "event: stream_meta",
            `data: ${JSON.stringify({
              has_more: false,
              last_seq: 20,
              requested_since_seq: 0,
              min_available_seq: 10,
              replay_floor_seq: 10,
              stale_since_seq: true,
            })}`,
            "",
            "",
          ].join("\n"),
          {
            headers: { "Content-Type": "text/event-stream" },
          },
        );
      }
      if (url.pathname === "/connector/streamed") {
        return connectorResponse("streamed", OWNER, FORMAT_HASH);
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("../src/lib/feed/particlePostData");
    const onUpdate = vi.fn();
    const onStale = vi.fn();
    const subscription = mod.createParticlePostDataStream({
      sourceAddresses: [OWNER],
      onUpdate,
      onStale,
    });

    expect(subscription.url).toContain("/feed/stream?since_seq=0&limit=128");

    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(mod.listNetworkFeedEvents()).toEqual([
      expect.objectContaining({
        id: "event-connector-created-feed-streamed",
        particleId: "streamed",
      }),
    ]);

    await vi.waitFor(() => expect(onStale).toHaveBeenCalledTimes(1));
    expect(mod.getParticlePostFeedState().stream).toEqual({
      lastSeq: 20,
      requestedSinceSeq: 0,
      minAvailableSeq: 10,
      replayFloorSeq: 10,
      staleSinceSeq: true,
    });
    subscription.close();
  });
});

const connectorResponse = (name: string, owner: string, formatHash: string) =>
  jsonResponse({
    name,
    owner,
    format_hash: formatHash,
    dimensions: [
      {
        composite: null,
        transformations: [],
      },
    ],
  });

const feedItem = (overrides: Record<string, unknown>) => ({
  feed_id: "feed-item",
  event_type: "connector_added",
  status: "safe",
  visible: true,
  tx_hash: "0xabc",
  block_number: 1,
  tx_index: 0,
  log_index: 0,
  history_cursor: "0000000000000001:0000:0000",
  created_at_ms: 100,
  updated_at_ms: 100,
  projector_version: 1,
  payload: {
    type: "connector",
    name: "connector",
    owner: OWNER,
  },
  ...overrides,
});

const jsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
