import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$lib/url/url", () => ({
  buildChainApiUrl: (path: string) => `https://api.example.invalid${path}`,
}));

import type { ChainFeedItem } from "../src/lib/chain/eventFeedApi";
import {
  ChainEventHydrationError,
  hydrateChainEventDetail,
  hydrateChainFeedItemDetail,
  hydrateNetworkFeedEventDetail,
} from "../src/lib/feed/chainEventHydration";
import type { NetworkFeedEvent } from "../src/lib/feed/particlePostData";

const OWNER = "0xb584a15f38c2014cff54fdb1b417428b51999276";
const OWNER_UPPER = "0xB584A15F38C2014CFF54FDB1B417428B51999276";
const OWNER_BARE = "b584a15f38c2014cff54fdb1b417428b51999276";
const FORMAT_HASH = "0x4e5aa46feeb2db48b7df17d424f29bfdee2ccbdf2433a99da6be58d3c9e31010";

const feedItem = (overrides: Partial<ChainFeedItem> = {}): ChainFeedItem => ({
  feedId: "feed-connector-score-weave",
  eventType: "connector_added",
  status: "safe",
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
    name: "score-weave",
    owner: OWNER,
  },
  ...overrides,
});

describe("chainEventHydration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("hydrates connector feed items from the canonical connector endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        name: "score-weave",
        owner: OWNER_UPPER,
        format_hash: FORMAT_HASH.toUpperCase(),
        dimensions: [
          {
            composite: "pitch",
            transformations: [{ name: "add", args: [1, 2] }],
          },
          {
            composite: "time",
            bindings: {
              "0": "duration_tick",
            },
            transformations: [
              { name: "add", args: [1] },
              { name: "scale", args: [4, 8, 16] },
            ],
          },
          {
            composite: "pitch",
            transformations: [],
          },
        ],
        condition_name: "is_open",
        condition_args: [1, 0],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const detail = await hydrateChainFeedItemDetail(feedItem());

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.invalid/connector/score-weave",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
      }),
    );
    expect(detail).toEqual(
      expect.objectContaining({
        type: "connector",
        name: "score-weave",
        owner: OWNER,
        dependencies: ["pitch", "time", "duration_tick"],
        formatHash: FORMAT_HASH,
        transformationArgCounts: {
          add: 2,
          scale: 3,
        },
        conditionArgCounts: {
          is_open: 2,
        },
      }),
    );
    expect(detail).toMatchObject({
      particleRecord: {
        id: "score-weave",
        name: "score-weave",
        summary: "",
        authorId: OWNER,
        createdAt: 0,
        createdLabel: "",
        dependencies: ["pitch", "time", "duration_tick"],
        formatHash: FORMAT_HASH,
      },
    });
  });

  it("hydrates transformations from the canonical transformation endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        name: "add",
        owner: OWNER_UPPER,
        sol_src: `
          // args[10] in comments should not count
          function transform(int256 x, int256[] memory args) public pure returns (int256) {
            return x + args[2];
          }
        `,
        address: "0x123",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const detail = await hydrateChainEventDetail({
      type: "transformation",
      name: "add",
      owner: OWNER,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.invalid/transformation/add",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
      }),
    );
    expect(detail).toEqual(
      expect.objectContaining({
        type: "transformation",
        name: "add",
        owner: OWNER,
        runtimeSnippet: "return x + args[2];",
        argsCount: 3,
        address: "0x123",
      }),
    );
  });

  it.each([0, 3])(
    "hydrates authoritative runtime args_count=%s without source",
    async (argsCount) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            jsonResponse({ name: "add", owner: OWNER, args_count: argsCount, address: "0x0" }),
          ),
      );
      const detail = await hydrateChainEventDetail({
        type: "transformation",
        name: "add",
        owner: OWNER,
      });
      expect(detail).toMatchObject({ argsCount });
    },
  );

  it("normalizes bare chain owner addresses from chain detail payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        name: "score-weave",
        owner: OWNER_BARE,
        format_hash: FORMAT_HASH,
        dimensions: [{ transformations: [{ name: "add", args: [1] }] }],
        condition_name: "",
        condition_args: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const detail = await hydrateChainEventDetail({
      type: "connector",
      name: "score-weave",
    });

    expect(detail).toEqual(
      expect.objectContaining({
        type: "connector",
        name: "score-weave",
        owner: OWNER,
      }),
    );
  });

  it("hydrates conditions from the canonical condition endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        name: "is_open",
        owner: OWNER,
        sol_src: "if (args[0] <= 0) return false;\nreturn true;",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const detail = await hydrateChainFeedItemDetail(
      feedItem({
        eventType: "condition_added",
        payload: {
          type: "condition",
          name: "is_open",
          owner: OWNER,
        },
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.invalid/condition/is_open",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
      }),
    );
    expect(detail).toEqual(
      expect.objectContaining({
        type: "condition",
        name: "is_open",
        runtimeSnippet: "return false;",
        argsCount: 1,
      }),
    );
  });

  it("does not fetch details for removed or hidden feed items", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      hydrateChainFeedItemDetail(
        feedItem({
          status: "removed",
          visible: false,
        }),
      ),
    ).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("rejects incomplete detail payloads instead of inventing UI data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        name: "score-weave",
        dimensions: [{ transformations: [] }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const error = await hydrateChainEventDetail({ type: "connector", name: "score-weave" }).catch(
      (error: unknown) => error,
    );

    expect(error).toBeInstanceOf(ChainEventHydrationError);
    expect(error).toMatchObject({
      message: "Hydrated chain entity must include a valid owner address.",
    });
  });

  it("hydrates existing network feed events by entity id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        name: "velocity",
        owner: OWNER,
        dimensions: [{ transformations: [] }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const event: NetworkFeedEvent = {
      type: "connector",
      id: "event-connector-created-velocity",
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
    };

    const detail = await hydrateNetworkFeedEventDetail(event);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.invalid/connector/velocity",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
      }),
    );
    expect(detail).toMatchObject({
      type: "connector",
      name: "velocity",
    });
  });

  it("ignores unsupported non-chain network feed events", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      hydrateNetworkFeedEventDetail({
        type: "format",
        id: "format-event",
        authorId: OWNER,
        createdAt: 100,
        createdLabel: "",
        formatId: FORMAT_HASH,
        formatSlug: "format",
        formatName: "Format",
        terminalParticleIds: ["pitch"],
        terminalParticleLabels: ["pitch"],
      }),
    ).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});

const jsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
