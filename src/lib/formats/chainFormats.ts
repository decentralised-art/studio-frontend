import { normalizeFormatHash, type ChainFormatResponse } from "$lib/chain/registryApi";

export type ChainFormatRecord = {
  formatHash: string;
  scalars: string[];
  connectors: string[];
  limit: number;
  totalConnectors: number;
  fetchedAt: number;
};

type ChainFormatCache = {
  byHash: Map<string, ChainFormatRecord>;
};

export const DEFAULT_CHAIN_FORMAT_CACHE_TTL_MS = 5 * 60 * 1000;

const cache: ChainFormatCache = {
  byHash: new Map<string, ChainFormatRecord>(),
};

const sortUniqueStrings = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))).sort(
    (a, b) => a.localeCompare(b),
  );

export const mapChainFormatResponseToRecord = (
  response: ChainFormatResponse,
  options: { fetchedAt?: number } = {},
): ChainFormatRecord | null => {
  const rawHash = `${response.format_hash ?? ""}`.trim();
  if (!rawHash) return null;

  let formatHash = "";
  try {
    formatHash = normalizeFormatHash(rawHash);
  } catch {
    return null;
  }

  const fetchedAt = options.fetchedAt ?? Date.now();
  const limit =
    Number.isInteger(response.limit) && (response.limit ?? -1) >= 0 ? response.limit! : 0;
  const connectors = sortUniqueStrings(
    (Array.isArray(response.connectors) ? response.connectors : []).filter(
      (value): value is string => typeof value === "string",
    ),
  );
  const totalFromResponse =
    Number.isInteger(response.total_connectors) && (response.total_connectors ?? -1) >= 0
      ? response.total_connectors!
      : connectors.length;
  const totalConnectors = Math.max(totalFromResponse, connectors.length);
  const scalarsRaw = Array.isArray(response.scalars) ? response.scalars : [];
  const scalars = sortUniqueStrings(
    scalarsRaw.filter((value): value is string => typeof value === "string"),
  );

  return {
    formatHash,
    scalars,
    connectors,
    limit,
    totalConnectors,
    fetchedAt,
  };
};

export const mergeChainFormatRecords = (records: ChainFormatRecord[]): ChainFormatRecord | null => {
  if (!records.length) return null;
  const normalizedHash = records[0].formatHash;
  const sameHashRecords = records.filter((record) => record.formatHash === normalizedHash);
  if (!sameHashRecords.length) return null;

  const connectors = sortUniqueStrings(sameHashRecords.flatMap((record) => record.connectors));
  const scalars = sortUniqueStrings(sameHashRecords.flatMap((record) => record.scalars));
  const totalConnectors = sameHashRecords.reduce(
    (max, record) => Math.max(max, record.totalConnectors, record.connectors.length),
    connectors.length,
  );
  const limit = sameHashRecords.reduce((max, record) => Math.max(max, record.limit), 0);
  const fetchedAt = sameHashRecords.reduce((max, record) => Math.max(max, record.fetchedAt), 0);

  return {
    formatHash: normalizedHash,
    connectors,
    scalars,
    limit,
    totalConnectors,
    fetchedAt,
  };
};

export const upsertChainFormatRecord = (record: ChainFormatRecord) => {
  cache.byHash.set(record.formatHash, record);
  return record;
};

export const upsertChainFormatFromResponse = (
  response: ChainFormatResponse,
  options?: { fetchedAt?: number },
) => {
  const record = mapChainFormatResponseToRecord(response, options);
  if (!record) return null;
  return upsertChainFormatRecord(record);
};

export const getCachedChainFormat = (formatHash: string): ChainFormatRecord | null => {
  try {
    const normalized = normalizeFormatHash(formatHash);
    return cache.byHash.get(normalized) ?? null;
  } catch {
    return null;
  }
};

export const isChainFormatFresh = (
  record: ChainFormatRecord,
  options: { ttlMs?: number; now?: number } = {},
) => {
  const ttlMs = options.ttlMs ?? DEFAULT_CHAIN_FORMAT_CACHE_TTL_MS;
  const now = options.now ?? Date.now();
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) return false;
  return now - record.fetchedAt <= ttlMs;
};

export const getFreshCachedChainFormat = (
  formatHash: string,
  options: { ttlMs?: number; now?: number } = {},
): ChainFormatRecord | null => {
  const record = getCachedChainFormat(formatHash);
  if (!record) return null;
  return isChainFormatFresh(record, options) ? record : null;
};

export const listCachedChainFormats = (): ChainFormatRecord[] =>
  Array.from(cache.byHash.values()).sort((a, b) => b.fetchedAt - a.fetchedAt);

export const getChainFormatDisplayName = (formatHash: string): string => {
  let normalized = "";
  try {
    normalized = normalizeFormatHash(formatHash);
  } catch {
    return "Format";
  }
  const prefix = normalized.slice(0, 10);
  const suffix = normalized.slice(-6);
  return `Format ${prefix}...${suffix}`;
};

export const invalidateChainFormatCacheEntry = (formatHash: string) => {
  const normalized = normalizeFormatHash(formatHash);
  cache.byHash.delete(normalized);
};

export const invalidateAllChainFormatCache = () => {
  cache.byHash.clear();
};

export const resetChainFormatCacheForDebug = () => {
  invalidateAllChainFormatCache();
};
