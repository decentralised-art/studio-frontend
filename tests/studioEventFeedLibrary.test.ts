import { beforeEach, describe, expect, it, vi } from "vitest";

const registry = vi.hoisted(() => ({
  connector: vi.fn(),
  transformation: vi.fn(),
  condition: vi.fn(),
}));

vi.mock("$lib/url/url", () => ({
  buildChainApiUrl: (path: string) => `https://api.example.invalid${path}`,
}));
vi.mock("$lib/chain/registryApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/chain/registryApi")>()),
  getChainConnector: registry.connector,
  getChainTransformation: registry.transformation,
  getChainCondition: registry.condition,
}));

import { loadStudioNetworkLibraryFromEventFeed } from "../src/lib/studio/studioEventFeedLibrary";

const OWNER = "0xb584a15f38c2014cff54fdb1b417428b51999276";
const OTHER_OWNER = "0xfa71ff2394596f824d69961293d095a50d322e4e";
const CHAIN_ADDRESS = `0x${"ab".repeat(20)}`;

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
  payload: { name, owner: OWNER },
  ...overrides,
});

const jsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const feedPage = (items: unknown[], nextBefore: string | null = null) =>
  jsonResponse({
    limit: items.length || 1,
    cursor: { has_more: Boolean(nextBefore), next_before: nextBefore },
    items,
  });

describe("studioEventFeedLibrary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    for (const getEntity of Object.values(registry)) {
      getEntity.mockReset();
      getEntity.mockImplementation(async (name: string) => ({
        name,
        address: CHAIN_ADDRESS,
        owner: name === "rhythm" ? OTHER_OWNER : OWNER,
      }));
    }
  });

  it("discovers feed entries and verifies their deployed addresses before listing them", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        feedPage(
          [
            rawFeedItem("pitch", "connector_added", {
              created_at_ms: 2_000,
              payload: { name: "pitch", owner: OWNER.toUpperCase() },
            }),
            rawFeedItem("ignored", "connector_added", {
              created_at_ms: 1_900,
              payload: { name: "ignored", owner: OTHER_OWNER },
            }),
          ],
          "page-2",
        ),
      )
      .mockResolvedValueOnce(
        feedPage([
          rawFeedItem("add", "transformation_added", { created_at_ms: 1_800 }),
          rawFeedItem("gate", "condition_added", { created_at_ms: 1_700 }),
        ]),
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
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.example.invalid/feed?limit=2&before=page-2&include_unfinalized=1",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
    expect(registry.connector).toHaveBeenCalledExactlyOnceWith("pitch");
    expect(registry.transformation).toHaveBeenCalledExactlyOnceWith("add");
    expect(registry.condition).toHaveBeenCalledExactlyOnceWith("gate");
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
        ownerAddress: OWNER,
        chainAddress: CHAIN_ADDRESS,
        summary: "Published on chain.",
      },
    ]);
    expect(discovery.library.transformations.map((item) => item.id)).toEqual(["transform-add"]);
    expect(discovery.library.conditions.map((item) => item.id)).toEqual(["condition-gate"]);
  });

  it("excludes finalized server drafts for every entity kind even when the viewer is their owner", async () => {
    for (const getEntity of Object.values(registry)) {
      getEntity.mockResolvedValue({ address: "0x0", owner: OWNER });
    }
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          feedPage([
            rawFeedItem("score_study_v2", "connector_added", { status: "finalized" }),
            rawFeedItem("draft-tx", "transformation_added", { status: "finalized" }),
            rawFeedItem("draft-gate", "condition_added", { status: "finalized" }),
          ]),
        ),
    );

    const discovery = await loadStudioNetworkLibraryFromEventFeed({ sourceAddresses: [OWNER] });
    expect(discovery.discoveredItemCount).toBe(0);
    expect(discovery.library).toEqual({ features: [], transformations: [], conditions: [] });
  });

  it("keeps verified entries when other registry lookups are missing, unavailable or invalid", async () => {
    registry.connector.mockImplementation(async (name: string) => {
      if (name === "missing") throw new Error("Connector not found");
      if (name === "unavailable") throw new Error("503 Service Unavailable");
      return { owner: OWNER, address: name === "invalid" ? "0x123" : CHAIN_ADDRESS };
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          feedPage(
            ["missing", "pitch", "unavailable", "invalid"].map((name) =>
              rawFeedItem(name, "connector_added"),
            ),
          ),
        ),
    );

    const discovery = await loadStudioNetworkLibraryFromEventFeed({ sourceAddresses: [OWNER] });
    expect(discovery.library.features.map((item) => item.name)).toEqual(["pitch"]);
  });

  it("continues pagination until the target counts verified published entries", async () => {
    registry.connector.mockImplementation(async (name: string) => ({
      address: name === "draft" ? "0x0" : CHAIN_ADDRESS,
      owner: OWNER,
    }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(feedPage([rawFeedItem("draft", "connector_added")], "page-2"))
      .mockResolvedValueOnce(feedPage([rawFeedItem("pitch", "connector_added")]));
    vi.stubGlobal("fetch", fetchMock);

    const discovery = await loadStudioNetworkLibraryFromEventFeed({
      sourceAddresses: [OWNER],
      targetItems: 1,
    });
    expect(discovery.pageCount).toBe(2);
    expect(discovery.library.features.map((item) => item.name)).toEqual(["pitch"]);
  });

  it("lets the newest feed state win for duplicate or removed entries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        feedPage([
          rawFeedItem("removed-latest", "connector_added", {
            status: "removed",
            visible: false,
            created_at_ms: 3_000,
          }),
          rawFeedItem("removed-latest", "connector_added", { created_at_ms: 1_000 }),
          rawFeedItem("kept-latest", "connector_added", { created_at_ms: 2_500 }),
          rawFeedItem("kept-latest", "connector_added", { created_at_ms: 900 }),
        ]),
      ),
    );

    const discovery = await loadStudioNetworkLibraryFromEventFeed({ sourceAddresses: [OWNER] });
    expect(discovery.library.features.map((item) => item.name)).toEqual(["kept-latest"]);
    expect(registry.connector).toHaveBeenCalledExactlyOnceWith("kept-latest");
  });

  it("checks the authoritative registry owner when selecting followed accounts", async () => {
    registry.connector.mockResolvedValue({ owner: OTHER_OWNER, address: CHAIN_ADDRESS });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(feedPage([rawFeedItem("pitch", "connector_added")])),
    );
    const discovery = await loadStudioNetworkLibraryFromEventFeed({ sourceAddresses: [OWNER] });
    expect(discovery.library.features).toEqual([]);
  });

  it("returns an empty library without fetching when no source address is available", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const discovery = await loadStudioNetworkLibraryFromEventFeed({
      sourceAddresses: ["not-an-address"],
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(discovery.library).toEqual({ features: [], transformations: [], conditions: [] });
  });

  it("discovers published entries from all authors for the public Studio library", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        feedPage([
          rawFeedItem("pitch", "connector_added"),
          rawFeedItem("rhythm", "connector_added", {
            payload: { name: "rhythm", owner: OTHER_OWNER },
          }),
        ]),
      ),
    );
    const discovery = await loadStudioNetworkLibraryFromEventFeed({
      sourceAddresses: [],
      includeAllOwners: true,
    });
    expect(discovery.library.features.map((item) => item.name)).toEqual(["pitch", "rhythm"]);
    expect(discovery.library.features[1]).toMatchObject({
      authorId: OTHER_OWNER,
      ownerAddress: OTHER_OWNER,
    });
  });
});
