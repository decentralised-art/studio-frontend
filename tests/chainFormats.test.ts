import { normalizeFormatHash } from "../src/lib/chain/registryApi";
import {
  getCachedChainFormat,
  getChainFormatDisplayName,
  isChainFormatFresh,
  mapChainFormatResponseToRecord,
  mergeChainFormatRecords,
  resetChainFormatCacheForDebug,
  upsertChainFormatRecord,
} from "../src/lib/formats/chainFormats";

describe("chainFormats", () => {
  const rawHash = "ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789";
  const normalizedHash = normalizeFormatHash(rawHash);

  beforeEach(() => {
    resetChainFormatCacheForDebug();
  });

  it("maps chain format response to normalized, deduped record", () => {
    const record = mapChainFormatResponseToRecord(
      {
        format_hash: rawHash,
        page: 0,
        limit: 2,
        total_connectors: 1,
        scalars: [" time ", "pitch", "pitch", "duration"],
        connectors: [
          { name: "b", local_address: "0xBB" },
          { name: "a", local_address: "0xaa" },
          { name: "a", local_address: "0xAA" }, // duplicate (case-insensitive local_address)
          { name: "", local_address: "" }, // invalid
        ],
      },
      { fetchedAt: 1000 },
    );

    expect(record).not.toBeNull();
    expect(record?.formatHash).toBe(normalizedHash);
    expect(record?.scalars).toEqual(["duration", "pitch", "time"]);
    expect(record?.connectors).toEqual([
      { name: "a", address: "", localAddress: "0xaa" },
      { name: "b", address: "", localAddress: "0xbb" },
    ]);
    // total_connectors should never be less than deduped connectors count
    expect(record?.totalConnectors).toBe(2);
    expect(record?.fetchedAt).toBe(1000);
  });

  it("merges paged records by hash and ignores other hashes", () => {
    const sameHashA = {
      formatHash: normalizedHash,
      scalars: ["pitch", "time"],
      connectors: [
        { name: "c2", address: "0x0", localAddress: "0x22" },
        { name: "c1", address: "0x0", localAddress: "0x11" },
      ],
      page: 0,
      limit: 100,
      totalConnectors: 5,
      fetchedAt: 101,
    };
    const sameHashB = {
      formatHash: normalizedHash,
      scalars: ["duration", "pitch"],
      connectors: [
        { name: "c1", address: "0x0", localAddress: "0x11" },
        { name: "c3", address: "0x0", localAddress: "0x33" },
      ],
      page: 1,
      limit: 100,
      totalConnectors: 3,
      fetchedAt: 202,
    };
    const otherHash = {
      formatHash: normalizeFormatHash(
        "1111111111111111111111111111111111111111111111111111111111111111",
      ),
      scalars: ["x"],
      connectors: [{ name: "x", address: "0x0", localAddress: "0x99" }],
      page: 0,
      limit: 100,
      totalConnectors: 1,
      fetchedAt: 303,
    };

    const merged = mergeChainFormatRecords([sameHashA, otherHash, sameHashB]);

    expect(merged).not.toBeNull();
    expect(merged?.formatHash).toBe(normalizedHash);
    expect(merged?.page).toBe(0);
    expect(merged?.limit).toBe(100);
    expect(merged?.fetchedAt).toBe(202);
    expect(merged?.totalConnectors).toBe(5);
    expect(merged?.scalars).toEqual(["duration", "pitch", "time"]);
    expect(merged?.connectors.map((c) => c.name)).toEqual(["c1", "c2", "c3"]);
  });

  it("upserts and resolves cached records by normalized hash", () => {
    const record = {
      formatHash: normalizedHash,
      scalars: ["pitch", "time"],
      connectors: [{ name: "c1", address: "0x0", localAddress: "0x11" }],
      page: 0,
      limit: 50,
      totalConnectors: 1,
      fetchedAt: 1000,
    };

    upsertChainFormatRecord(record);

    expect(getCachedChainFormat(rawHash)).toEqual(record);
    expect(getCachedChainFormat(normalizedHash)).toEqual(record);
  });

  it("computes freshness against ttl", () => {
    const record = {
      formatHash: normalizedHash,
      scalars: [],
      connectors: [],
      page: 0,
      limit: 0,
      totalConnectors: 0,
      fetchedAt: 1_000,
    };

    expect(isChainFormatFresh(record, { now: 1_050, ttlMs: 100 })).toBe(true);
    expect(isChainFormatFresh(record, { now: 1_101, ttlMs: 100 })).toBe(false);
  });

  it("uses hash-based display names", () => {
    expect(getChainFormatDisplayName(normalizedHash)).toMatch(
      /^Format 0x[a-f0-9]{8}\.\.\.[a-f0-9]{6}$/,
    );
  });
});
