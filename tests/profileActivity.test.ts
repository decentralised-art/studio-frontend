import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$lib/url/url", () => ({
  buildChainApiUrl: (path: string) => `https://api.example.invalid${path}`,
}));

const OWNER = "0xb584a15f38c2014cff54fdb1b417428b51999276";
const OTHER_OWNER = "0x71a60533defdc8e989392068f0d97c9e71974839";
const FORMAT_HASH = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("profile activity feed loading", () => {
  beforeEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    const mod = await import("../src/lib/feed/particlePostData");
    mod.resetParticlePostDataCacheForDebug();
  });

  it("walks event feed history until it finds activity by the profile owner", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/feed" && !url.searchParams.has("before")) {
        return jsonResponse({
          limit: 128,
          cursor: {
            has_more: true,
            next_before: "older-feed-page",
          },
          items: [
            feedItem({
              feed_id: "feed-foreign",
              created_at_ms: 500,
              payload: {
                type: "connector",
                name: "foreign",
                owner: OTHER_OWNER,
              },
            }),
          ],
        });
      }
      if (url.pathname === "/feed" && url.searchParams.get("before") === "older-feed-page") {
        return jsonResponse({
          limit: 128,
          cursor: {
            has_more: false,
            next_before: null,
          },
          items: [
            feedItem({
              feed_id: "feed-owned",
              history_cursor: "0000000000000000:0000:0000",
              created_at_ms: 300,
              payload: {
                type: "connector",
                name: "owned_connector",
                owner: OWNER,
              },
            }),
          ],
        });
      }
      if (url.pathname === "/connector/owned_connector") {
        return connectorResponse("owned_connector", OWNER);
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("../src/lib/feed/profileActivity");
    const events = await mod.syncProfileActivityFromEventFeed({
      sourceAddresses: [OWNER],
      minVisibleEvents: 1,
    });

    expect(fetchMock.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual([
      "/feed",
      "/feed",
      "/connector/owned_connector",
    ]);
    expect(events).toEqual([
      expect.objectContaining({
        id: "event-connector-created-feed-owned",
        authorId: OWNER,
        particleId: "owned_connector",
      }),
    ]);
    expect(mod.listProfileActivityEvents([OWNER])).toEqual(events);
  });
});

const connectorResponse = (name: string, owner: string) =>
  jsonResponse({
    name,
    owner,
    format_hash: FORMAT_HASH,
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
