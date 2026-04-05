import { beforeEach, describe, expect, it } from "vitest";
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
        limit: 2,
        total_connectors: 1,
        scalars: [" time ", "pitch", "pitch", "duration"],
        connectors: ["b", "a", "a", " "],
      },
      { fetchedAt: 1000 },
    );

    expect(record).not.toBeNull();
    expect(record?.formatHash).toBe(normalizedHash);
    expect(record?.scalars).toEqual(["duration", "pitch", "time"]);
    expect(record?.connectors).toEqual(["a", "b"]);
    // total_connectors should never be less than deduped connectors count
    expect(record?.totalConnectors).toBe(2);
    expect(record?.fetchedAt).toBe(1000);
  });

  it("merges paged records by hash and ignores other hashes", () => {
    const sameHashA = {
      formatHash: normalizedHash,
      scalars: ["pitch", "time"],
      connectors: ["c2", "c1"],
      limit: 100,
      totalConnectors: 5,
      fetchedAt: 101,
    };
    const sameHashB = {
      formatHash: normalizedHash,
      scalars: ["duration", "pitch"],
      connectors: ["c1", "c3"],
      limit: 100,
      totalConnectors: 3,
      fetchedAt: 202,
    };
    const otherHash = {
      formatHash: normalizeFormatHash(
        "1111111111111111111111111111111111111111111111111111111111111111",
      ),
      scalars: ["x"],
      connectors: ["x"],
      limit: 100,
      totalConnectors: 1,
      fetchedAt: 303,
    };

    const merged = mergeChainFormatRecords([sameHashA, otherHash, sameHashB]);

    expect(merged).not.toBeNull();
    expect(merged?.formatHash).toBe(normalizedHash);
    expect(merged?.limit).toBe(100);
    expect(merged?.fetchedAt).toBe(202);
    expect(merged?.totalConnectors).toBe(5);
    expect(merged?.scalars).toEqual(["duration", "pitch", "time"]);
    expect(merged?.connectors).toEqual(["c1", "c2", "c3"]);
  });

  it("upserts and resolves cached records by normalized hash", () => {
    const record = {
      formatHash: normalizedHash,
      scalars: ["pitch", "time"],
      connectors: ["c1"],
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
