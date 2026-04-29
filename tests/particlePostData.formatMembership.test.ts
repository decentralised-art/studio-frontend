import { beforeEach, describe, expect, it, vi } from "vitest";

const hashOne = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const hashTwo = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

vi.mock("../src/lib/studio/chainStudioAdapter", () => {
  return {
    listChainSyncSourcesForApp: vi.fn(async () => [
      {
        address: "0x1111111111111111111111111111111111111111",
        authorId: "user-lyra",
      },
    ]),
    fetchChainOwnedStudioSnapshot: vi.fn(async () => ({
      registry: {
        connectors: {},
        features: {},
        particles: {},
        transformations: {},
        conditions: {},
      },
      library: {
        features: [],
        transformations: [],
        conditions: [],
      },
      particles: [
        {
          id: "connector-alpha",
          name: "alpha",
          summary: "alpha",
          authorId: "user-lyra",
          viewId: "midi",
          createdAt: 300,
          createdLabel: "just synced",
          ingredients: [],
          complexity: 1,
          transactionName: "alpha PT",
          dependencies: [],
          formatHash: hashOne,
        },
        {
          id: "connector-beta",
          name: "beta",
          summary: "beta",
          authorId: "user-lyra",
          viewId: "midi",
          createdAt: 200,
          createdLabel: "just synced",
          ingredients: [],
          complexity: 1,
          transactionName: "beta PT",
          dependencies: [],
          formatHash: hashTwo,
        },
        {
          id: "connector-gamma",
          name: "gamma",
          summary: "gamma",
          authorId: "user-lyra",
          viewId: "midi",
          createdAt: 100,
          createdLabel: "just synced",
          ingredients: [],
          complexity: 1,
          transactionName: "gamma PT",
          dependencies: [],
        },
      ],
      formats: [],
      formatSync: {
        requested: 0,
        hydrated: 0,
        failed: [],
      },
    })),
    fetchChainParticleForStudio: vi.fn(async () => ({ registry: {} })),
  };
});

describe("particlePostData format hash membership", () => {
  beforeEach(async () => {
    const mod = await import("../src/lib/feed/particlePostData");
    mod.resetParticlePostDataCacheForDebug();
  });

  it("returns only particles whose formatHash matches requested hash", async () => {
    const mod = await import("../src/lib/feed/particlePostData");
    await mod.syncParticlePostDataFromOwnedAccountSnapshotsForDebug();

    const records = mod.listParticleRecordsByFormatHash(hashOne.toUpperCase());

    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe("connector-alpha");
  });

  it("returns empty array for invalid hash", async () => {
    const mod = await import("../src/lib/feed/particlePostData");
    await mod.syncParticlePostDataFromOwnedAccountSnapshotsForDebug();

    expect(mod.listParticleRecordsByFormatHash("not-a-hash")).toEqual([]);
  });
});
