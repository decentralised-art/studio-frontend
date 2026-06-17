import { beforeEach, describe, expect, it, vi } from "vitest";

const { feedMock } = vi.hoisted(() => ({
  feedMock: vi.fn(),
}));

vi.mock("$lib/chain/dcnClient", () => ({
  createDcnClient: () => ({
    feed: feedMock,
  }),
  isDcnApiError: (error: unknown) =>
    Boolean(
      error && typeof error === "object" && (error as { name?: string }).name === "DcnApiError",
    ),
}));

vi.mock("$lib/url/url", () => ({
  buildChainApiUrl: (path: string) => `https://api.example.invalid${path}`,
}));

import {
  ChainFeedValidationError,
  createChainFeedStream,
  getChainFeedPage,
  normalizeChainFeedPage,
  parseChainFeedStreamDeltaData,
  parseChainFeedStreamMetaData,
  type ChainFeedStreamDelta,
  type ChainFeedStreamMeta,
} from "../src/lib/chain/eventFeedApi";
import { ChainApiRequestError } from "../src/lib/chain/registryApi";

const OWNER = "0xb584a15f38c2014cff54fdb1b417428b51999276";
const OWNER_UPPER = "0xB584A15F38C2014CFF54FDB1B417428B51999276";

const makeRawFeedItem = (overrides: Record<string, unknown> = {}) => ({
  feed_id: "connector:test_connector:0x01",
  event_type: "connector_added",
  status: "safe",
  visible: true,
  tx_hash: "0xabc",
  block_number: 123,
  tx_index: 2,
  log_index: 4,
  history_cursor: "0000000000000123:0002:0004",
  created_at_ms: 1_000,
  updated_at_ms: 2_000,
  projector_version: 1,
  payload: {
    name: "test_connector",
    owner: OWNER_UPPER,
  },
  ...overrides,
});

describe("eventFeedApi", () => {
  beforeEach(() => {
    feedMock.mockReset();
    vi.restoreAllMocks();
  });

  it("fetches and normalizes chain feed pages", async () => {
    feedMock.mockResolvedValue({
      limit: 2,
      cursor: {
        has_more: true,
        next_before: "  cursor-1  ",
      },
      items: [makeRawFeedItem()],
    });

    const page = await getChainFeedPage({
      limit: 2,
      before: " cursor-2 ",
      type: " CONNECTOR_ADDED ",
      includeUnfinalized: true,
    });

    expect(feedMock).toHaveBeenCalledWith({
      limit: 2,
      before: "cursor-2",
      type: "connector_added",
      includeUnfinalized: true,
    });
    expect(page).toEqual({
      limit: 2,
      hasMore: true,
      nextBefore: "cursor-1",
      items: [
        {
          feedId: "connector:test_connector:0x01",
          eventType: "connector_added",
          status: "safe",
          visible: true,
          txHash: "0xabc",
          blockNumber: 123,
          txIndex: 2,
          logIndex: 4,
          historyCursor: "0000000000000123:0002:0004",
          createdAtMs: 1_000,
          updatedAtMs: 2_000,
          projectorVersion: 1,
          payload: {
            type: "connector",
            name: "test_connector",
            owner: OWNER,
          },
        },
      ],
    });
  });

  it("normalizes blank page cursors to null", () => {
    expect(
      normalizeChainFeedPage({
        limit: 20,
        cursor: {
          has_more: false,
          next_before: " ",
        },
        items: [],
      }),
    ).toEqual({
      limit: 20,
      hasMore: false,
      nextBefore: null,
      items: [],
    });
  });

  it("infers connector, transformation, and condition payload types from feed events", () => {
    const page = normalizeChainFeedPage({
      limit: 3,
      cursor: {
        has_more: false,
        next_before: null,
      },
      items: [
        makeRawFeedItem({
          feed_id: "feed-connector",
          event_type: "connector_added",
          payload: {
            name: "pitch",
            owner: OWNER_UPPER,
          },
        }),
        makeRawFeedItem({
          feed_id: "feed-transformation",
          event_type: "transformation_added",
          payload: {
            name: "add",
            owner: OWNER_UPPER,
          },
        }),
        makeRawFeedItem({
          feed_id: "feed-condition",
          event_type: "condition_added",
          payload: {
            name: "is_open",
            owner: OWNER_UPPER,
          },
        }),
      ],
    });

    expect(page.items.map((item) => item.payload)).toEqual([
      {
        type: "connector",
        name: "pitch",
        owner: OWNER,
      },
      {
        type: "transformation",
        name: "add",
        owner: OWNER,
      },
      {
        type: "condition",
        name: "is_open",
        owner: OWNER,
      },
    ]);
  });

  it("rejects malformed feed success payloads", () => {
    expect(() =>
      normalizeChainFeedPage({
        limit: 1,
        cursor: {
          has_more: false,
          next_before: null,
        },
        items: [
          makeRawFeedItem({
            payload: {
              name: "test_connector",
            },
          }),
        ],
      }),
    ).toThrow(/payload\.owner/);
  });

  it("surfaces non-json chain feed errors with the shared request error shape", async () => {
    feedMock.mockRejectedValue({
      name: "DcnApiError",
      status: 502,
      body: "<html><body>502 Bad Gateway</body></html>",
    });

    const error = await getChainFeedPage({ limit: 5 }).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ChainApiRequestError);
    expect(error).toMatchObject({
      name: "ChainApiRequestError",
      status: 502,
      message: "Chain API is temporarily unavailable (502 Bad Gateway).",
    });
  });

  it("parses and normalizes stream delta frames", () => {
    const delta = parseChainFeedStreamDeltaData(
      JSON.stringify({
        stream_seq: 11,
        event_type: " TRANSFORMATION_ADDED ",
        status: "FINALIZED",
        feed_id: "transformation:add:0x01",
        history_cursor: "0000000000000123:0001:0000",
        created_at_ms: 3_000,
        payload: {
          name: "add",
          owner: OWNER_UPPER,
        },
      }),
    );

    expect(delta).toEqual({
      streamSeq: 11,
      eventType: "transformation_added",
      status: "finalized",
      feedId: "transformation:add:0x01",
      historyCursor: "0000000000000123:0001:0000",
      createdAtMs: 3_000,
      payload: {
        type: "transformation",
        name: "add",
        owner: OWNER,
      },
    });
  });

  it("parses stream metadata frames", () => {
    expect(
      parseChainFeedStreamMetaData(
        JSON.stringify({
          has_more: true,
          last_seq: 99,
          requested_since_seq: 10,
          min_available_seq: 4,
          replay_floor_seq: 8,
          stale_since_seq: true,
        }),
      ),
    ).toEqual({
      hasMore: true,
      lastSeq: 99,
      requestedSinceSeq: 10,
      minAvailableSeq: 4,
      replayFloorSeq: 8,
      staleSinceSeq: true,
    });
  });

  it("rejects malformed stream frame JSON", () => {
    expect(() => parseChainFeedStreamDeltaData("{not-json")).toThrow(ChainFeedValidationError);
  });

  it("wires EventSource stream frames and closes listeners", () => {
    const source = new FakeEventSource();
    const deltas: ChainFeedStreamDelta[] = [];
    const metas: ChainFeedStreamMeta[] = [];
    const errors: Error[] = [];
    const subscription = createChainFeedStream({
      sinceSeq: 5,
      limit: 50,
      onDelta: (delta) => deltas.push(delta),
      onMeta: (meta) => metas.push(meta),
      onError: (error) => errors.push(error),
      eventSourceFactory: (url) => {
        source.url = url;
        return source;
      },
    });

    expect(subscription.url).toBe("https://api.example.invalid/feed/stream?since_seq=5&limit=50");
    expect(source.url).toBe(subscription.url);

    source.emit(
      "connector_added",
      JSON.stringify({
        stream_seq: 6,
        event_type: "connector_added",
        status: "observed",
        feed_id: "connector:pitch:0x01",
        history_cursor: "0000000000000006:0000:0000",
        created_at_ms: 4_000,
        payload: {
          name: "pitch",
          owner: OWNER,
        },
      }),
    );
    source.emit(
      "stream_meta",
      JSON.stringify({
        has_more: false,
        last_seq: 6,
        requested_since_seq: 5,
        min_available_seq: 1,
        replay_floor_seq: 5,
        stale_since_seq: false,
      }),
    );
    source.onerror?.({ type: "error" } as Event);

    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.payload.name).toBe("pitch");
    expect(metas).toHaveLength(1);
    expect(metas[0]?.lastSeq).toBe(6);
    expect(errors).toHaveLength(1);

    subscription.close();
    expect(source.closed).toBe(true);
    expect(source.listenerCount()).toBe(0);
  });
});

class FakeEventSource {
  url = "";
  closed = false;
  onerror: ((event: Event) => void) | null = null;
  private listeners = new Map<string, Set<(event: MessageEvent<string>) => void>>();

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    const listeners = this.listeners.get(type);
    listeners?.delete(listener);
    if (listeners?.size === 0) this.listeners.delete(type);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data } as MessageEvent<string>);
    }
  }

  listenerCount() {
    return [...this.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0);
  }
}
