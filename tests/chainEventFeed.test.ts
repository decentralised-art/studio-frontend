import { describe, expect, it } from "vitest";

import type {
  ChainFeedItem,
  ChainFeedPage,
  ChainFeedStreamDelta,
  ChainFeedStreamMeta,
} from "../src/lib/chain/eventFeedApi";
import {
  applyChainFeedPage,
  applyChainFeedStreamDelta,
  applyChainFeedStreamMeta,
  createChainEventFeedCache,
  listChainEventFeedEvents,
  mapChainFeedItemToNetworkFeedEvent,
} from "../src/lib/feed/chainEventFeed";

const OWNER = "0xb584a15f38c2014cff54fdb1b417428b51999276";
const OWNER_UPPER = "0xB584A15F38C2014CFF54FDB1B417428B51999276";

const feedItem = (overrides: Partial<ChainFeedItem> = {}): ChainFeedItem => ({
  feedId: "feed-connector-pitch",
  eventType: "connector_added",
  status: "observed",
  visible: true,
  txHash: "0xabc",
  blockNumber: 1,
  txIndex: 0,
  logIndex: 0,
  historyCursor: "0000000000000001:0000:0000",
  createdAtMs: 100,
  updatedAtMs: 100,
  projectorVersion: 1,
  payload: {
    type: "connector",
    name: "pitch",
    owner: OWNER,
  },
  ...overrides,
});

const feedPage = (items: ChainFeedItem[]): ChainFeedPage => ({
  limit: items.length || 20,
  hasMore: true,
  nextBefore: "cursor-before",
  items,
});

describe("chainEventFeed", () => {
  it("maps connector feed items to connector post events without invented details", () => {
    const event = mapChainFeedItemToNetworkFeedEvent(
      feedItem({
        feedId: "feed-connector-velocity",
        payload: {
          type: "connector",
          name: "velocity",
          owner: OWNER_UPPER,
        },
      }),
    );

    expect(event).toEqual({
      type: "connector",
      id: "event-connector-created-feed-connector-velocity",
      authorId: OWNER,
      createdAt: 100,
      createdLabel: "",
      particleId: "velocity",
      particleLabel: "velocity",
      usedParticleIds: [],
      usedParticleLabels: [],
      createdNodeIds: [],
      reusedNodeIds: [],
      focusNodeIds: [],
    });
  });

  it("maps transformation and condition events with empty snippets until hydration", () => {
    const cache = createChainEventFeedCache();

    const snapshot = applyChainFeedPage(
      cache,
      feedPage([
        feedItem({
          feedId: "feed-transformation-add",
          eventType: "transformation_added",
          createdAtMs: 300,
          payload: {
            type: "transformation",
            name: "add",
            owner: OWNER,
          },
        }),
        feedItem({
          feedId: "feed-condition-open",
          eventType: "condition_added",
          createdAtMs: 200,
          payload: {
            type: "condition",
            name: "is_open",
            owner: OWNER,
          },
        }),
      ]),
    );

    expect(snapshot.events.map((event) => event.type)).toEqual(["transformation", "condition"]);
    expect(snapshot.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "transformation",
          elementId: "add",
          runtimeSnippet: "",
        }),
        expect.objectContaining({
          type: "condition",
          elementId: "is_open",
          runtimeSnippet: "",
        }),
      ]),
    );
    expect(snapshot.searchable.transformations).toEqual([
      {
        id: "add",
        label: "add",
        summary: "",
        authorId: OWNER,
      },
    ]);
    expect(snapshot.searchable.conditions).toEqual([
      {
        id: "is_open",
        label: "is_open",
        summary: "",
        authorId: OWNER,
      },
    ]);
  });

  it("deduplicates by feed id and keeps the latest status", () => {
    const cache = createChainEventFeedCache();

    applyChainFeedPage(cache, feedPage([feedItem({ status: "observed" })]));
    const snapshot = applyChainFeedPage(
      cache,
      feedPage([
        feedItem({
          status: "finalized",
          updatedAtMs: 500,
          payload: {
            type: "connector",
            name: "pitch_renamed",
            owner: OWNER,
          },
        }),
      ]),
    );

    expect(snapshot.records).toHaveLength(1);
    expect(snapshot.records[0]).toMatchObject({
      feedId: "feed-connector-pitch",
      status: "finalized",
    });
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0]).toMatchObject({
      type: "connector",
      particleId: "pitch_renamed",
    });
    expect(snapshot.connectorRecords).toEqual([
      expect.objectContaining({
        id: "pitch_renamed",
      }),
    ]);
  });

  it("applies stream status updates and tracks stream metadata", () => {
    const cache = createChainEventFeedCache();
    applyChainFeedPage(cache, feedPage([feedItem({ status: "observed" })]));

    const delta: ChainFeedStreamDelta = {
      streamSeq: 42,
      eventType: "connector_added",
      status: "finalized",
      feedId: "feed-connector-pitch",
      historyCursor: "0000000000000002:0000:0000",
      createdAtMs: 100,
      payload: {
        type: "connector",
        name: "pitch",
        owner: OWNER,
      },
    };
    const afterDelta = applyChainFeedStreamDelta(cache, delta);

    expect(afterDelta.records[0]).toMatchObject({
      status: "finalized",
      streamSeq: 42,
    });
    expect(afterDelta.stream.lastSeq).toBe(42);

    const meta: ChainFeedStreamMeta = {
      hasMore: false,
      lastSeq: 45,
      requestedSinceSeq: 40,
      minAvailableSeq: 1,
      replayFloorSeq: 40,
      staleSinceSeq: false,
    };

    expect(applyChainFeedStreamMeta(cache, meta).stream).toEqual({
      lastSeq: 45,
      requestedSinceSeq: 40,
      minAvailableSeq: 1,
      replayFloorSeq: 40,
      staleSinceSeq: false,
    });
  });

  it("preserves stale stream cursor metadata for callers to trigger a reload", () => {
    const cache = createChainEventFeedCache();

    const snapshot = applyChainFeedStreamMeta(cache, {
      hasMore: true,
      lastSeq: 60,
      requestedSinceSeq: 10,
      minAvailableSeq: 25,
      replayFloorSeq: 25,
      staleSinceSeq: true,
    });

    expect(snapshot.stream).toEqual({
      lastSeq: 60,
      requestedSinceSeq: 10,
      minAvailableSeq: 25,
      replayFloorSeq: 25,
      staleSinceSeq: true,
    });
  });

  it("hides removed events and removes projected search records", () => {
    const cache = createChainEventFeedCache();
    applyChainFeedPage(cache, feedPage([feedItem()]));

    const snapshot = applyChainFeedStreamDelta(cache, {
      streamSeq: 5,
      eventType: "connector_added",
      status: "removed",
      feedId: "feed-connector-pitch",
      historyCursor: "0000000000000002:0000:0000",
      createdAtMs: 100,
      payload: {
        type: "connector",
        name: "pitch",
        owner: OWNER,
      },
    });

    expect(snapshot.records).toHaveLength(1);
    expect(snapshot.records[0]).toMatchObject({
      visible: false,
      event: null,
      status: "removed",
    });
    expect(snapshot.events).toEqual([]);
    expect(snapshot.connectorRecords).toEqual([]);
    expect(snapshot.searchable.connectors).toEqual([]);
  });

  it("keeps newest events first and tracks page pagination", () => {
    const cache = createChainEventFeedCache();

    const snapshot = applyChainFeedPage(
      cache,
      feedPage([
        feedItem({
          feedId: "feed-connector-old",
          createdAtMs: 100,
          payload: {
            type: "connector",
            name: "old",
            owner: OWNER,
          },
        }),
        feedItem({
          feedId: "feed-connector-new",
          createdAtMs: 300,
          payload: {
            type: "connector",
            name: "new",
            owner: OWNER,
          },
        }),
      ]),
    );

    expect(listChainEventFeedEvents(cache).map((event) => event.id)).toEqual([
      "event-connector-created-feed-connector-new",
      "event-connector-created-feed-connector-old",
    ]);
    expect(snapshot.pagination).toEqual({
      limit: 2,
      hasMore: true,
      nextBefore: "cursor-before",
    });
  });
});
