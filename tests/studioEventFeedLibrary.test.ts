import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$lib/url/url", () => ({
  buildChainApiUrl: (path: string) => `https://api.example.invalid${path}`,
}));

import { loadStudioNetworkLibraryFromEventFeed } from "../src/lib/studio/studioEventFeedLibrary";

const OWNER = "0xb584a15f38c2014cff54fdb1b417428b51999276";
const OTHER_OWNER = "0xfa71ff2394596f824d69961293d095a50d322e4e";

const rawFeedItem = (
  name: string,
  eventType: "connector_added" | "transformation_added" | "condition_added",
  overrides: Record<string, unknown> = {},
) => ({
  feed_id: `${eventType}:${name}:1`,
  event_type: eventType,
  status: "safe",
  visible: true,
  tx_hash: "0xabc",
  block_number: 10,
  tx_index: 0,
  log_index: 0,
  history_cursor: `cursor-${name}`,
  created_at_ms: 1_000,
  updated_at_ms: 1_000,
  projector_version: 1,
  payload: {
    name,
    owner: OWNER,
  },
  ...overrides,
});

const jsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("studioEventFeedLibrary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads Studio network library entries from feed history only", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          limit: 2,
          cursor: {
            has_more: true,
            next_before: "page-2",
          },
          items: [
            rawFeedItem("pitch", "connector_added", {
              created_at_ms: 2_000,
              payload: { name: "pitch", owner: OWNER.toUpperCase() },
            }),
            rawFeedItem("ignored", "connector_added", {
              created_at_ms: 1_900,
              payload: { name: "ignored", owner: OTHER_OWNER },
            }),
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          limit: 2,
          cursor: {
            has_more: false,
            next_before: null,
          },
          items: [
            rawFeedItem("add", "transformation_added", {
              created_at_ms: 1_800,
            }),
            rawFeedItem("gate", "condition_added", {
              created_at_ms: 1_700,
            }),
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const discovery = await loadStudioNetworkLibraryFromEventFeed({
      sourceAddresses: [OWNER],
      pageLimit: 2,
      maxPages: 4,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.example.invalid/feed?limit=2&include_unfinalized=1",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.example.invalid/feed?limit=2&before=page-2&include_unfinalized=1",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
      }),
    );
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/connector/"))).toBe(false);
    expect(discovery).toMatchObject({
      sourceAddresses: [OWNER],
      pageCount: 2,
      rawItemCount: 4,
      discoveredItemCount: 3,
      hasMore: false,
      nextBefore: null,
    });
    expect(discovery.library.features).toEqual([
      {
        id: "feature-pitch",
        name: "pitch",
        kind: "feature",
        authorId: OWNER,
        summary: "Discovered from chain feed.",
      },
    ]);
    expect(discovery.library.transformations.map((item) => item.id)).toEqual(["transform-add"]);
    expect(discovery.library.conditions.map((item) => item.id)).toEqual(["condition-gate"]);
  });

  it("lets the newest feed state win for duplicate or removed entries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        limit: 4,
        cursor: {
          has_more: false,
          next_before: null,
        },
        items: [
          rawFeedItem("removed-latest", "connector_added", {
            status: "removed",
            visible: false,
            created_at_ms: 3_000,
          }),
          rawFeedItem("removed-latest", "connector_added", {
            created_at_ms: 1_000,
          }),
          rawFeedItem("kept-latest", "connector_added", {
            created_at_ms: 2_500,
          }),
          rawFeedItem("kept-latest", "connector_added", {
            created_at_ms: 900,
          }),
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const discovery = await loadStudioNetworkLibraryFromEventFeed({
      sourceAddresses: [OWNER],
      pageLimit: 4,
    });

    expect(discovery.library.features.map((item) => item.name)).toEqual(["kept-latest"]);
  });

  it("returns an empty library without fetching when no source address is available", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const discovery = await loadStudioNetworkLibraryFromEventFeed({
      sourceAddresses: ["not-an-address"],
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(discovery.library).toEqual({
      features: [],
      transformations: [],
      conditions: [],
    });
  });

  it("discovers published entries from all authors for the public Studio library", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          limit: 2,
          cursor: { has_more: false, next_before: null },
          items: [
            rawFeedItem("pitch", "connector_added"),
            rawFeedItem("rhythm", "connector_added", {
              payload: { name: "rhythm", owner: OTHER_OWNER },
            }),
          ],
        }),
      ),
    );

    const discovery = await loadStudioNetworkLibraryFromEventFeed({
      sourceAddresses: [],
      includeAllOwners: true,
    });

    expect(discovery.library.features.map((item) => item.name)).toEqual(["pitch", "rhythm"]);
  });
});
