import { getChainFormat, resolveChainFormatCursor } from "$lib/chain/registryApi";
import { buildWorldAssetUrl } from "./api";
import type { WorldDescriptor, WorldRiCoordinate } from "./types";

/** Optional file at the bundle root. No World-specific configuration belongs in Studio. */
export const WORLD_STUDIO_STARTER_FILE = "studio-starter.json";
export type WorldStudioStarter = {
  schemaVersion: 1;
  connector: string;
  particlesCount: number;
  dynamicRi: Record<string, WorldRiCoordinate>;
  simulate: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const parseWorldStudioStarter = (value: unknown): WorldStudioStarter => {
  const fail = (): never => {
    throw new Error("Invalid World studio-starter.json.");
  };
  if (!isRecord(value) || value.schemaVersion !== 1) return fail();
  const { connector, particlesCount, dynamicRi = {}, simulate = false } = value;
  if (typeof connector !== "string" || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(connector)) return fail();
  if (
    !Number.isSafeInteger(particlesCount) ||
    Number(particlesCount) < 1 ||
    Number(particlesCount) > 10000
  )
    return fail();
  if (typeof simulate !== "boolean" || !isRecord(dynamicRi)) return fail();
  const coordinates: Record<string, WorldRiCoordinate> = {};
  for (const [position, coordinate] of Object.entries(dynamicRi)) {
    if (
      !/^(0|[1-9][0-9]*)$/.test(position) ||
      !Number.isSafeInteger(Number(position)) ||
      !isRecord(coordinate)
    )
      return fail();
    const { start_point, transformation_shift } = coordinate;
    if (
      !Number.isSafeInteger(start_point) ||
      !Number.isSafeInteger(transformation_shift) ||
      Number(transformation_shift) < 0
    )
      return fail();
    coordinates[position] = {
      start_point: Number(start_point),
      transformation_shift: Number(transformation_shift),
    };
  }
  return {
    schemaVersion: 1,
    connector,
    particlesCount: Number(particlesCount),
    dynamicRi: coordinates,
    simulate,
  };
};

export const worldStudioStarterUrl = (world: WorldDescriptor, baseUrl: string): string => {
  const entry = new URL(buildWorldAssetUrl(world.entryUrn ?? world.entry), baseUrl);
  const entryPath = world.backend?.entryPath ?? "index.html";
  // entryPath is bundle-relative, whereas the entry URL can include a Services prefix.
  if (!entry.pathname.endsWith(`/${entryPath}`))
    throw new Error("Cannot resolve the World bundle root.");
  entry.pathname = entry.pathname.slice(0, -entryPath.length) + WORLD_STUDIO_STARTER_FILE;
  entry.search = "";
  entry.hash = "";
  return entry.href;
};

export const loadWorldStudioStarter = async (
  world: WorldDescriptor,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<WorldStudioStarter | null> => {
  const response = await fetcher(worldStudioStarterUrl(world, baseUrl), { credentials: "omit" });
  if (response.status === 404) return null; // Existing Worlds need no starter file.
  if (!response.ok) throw new Error(`Could not load the World starter (HTTP ${response.status}).`);
  const text = await response.text();
  if (text.length > 65536) throw new Error("World starter exceeds 64 KB.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Invalid World studio-starter.json.");
  }
  return parseWorldStudioStarter(value);
};

/** Start with named examples, then read only the World’s declared format memberships. */
export async function* manifestWorldStarterCandidates(
  world: WorldDescriptor,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const seen = new Set<string>();
  function* uniqueNames(names: readonly string[]): Generator<string> {
    for (const name of names) {
      const connector = name.trim();
      if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,127}$/.test(connector) || seen.has(connector)) continue;
      seen.add(connector);
      yield connector;
    }
  }

  for (const set of world.acceptedConnectorSets ?? []) yield* uniqueNames(set.connectors);
  for (const hash of new Set(world.acceptedFormatHashes)) {
    let after: string | null = null;
    const cursors = new Set<string>();
    while (true) {
      signal.throwIfAborted();
      const membership = await getChainFormat(hash, { limit: 16, after }).catch(() => null);
      signal.throwIfAborted();
      if (!membership) break;
      yield* uniqueNames(membership.connectors ?? []);
      const { hasMore, nextAfter } = resolveChainFormatCursor(membership);
      if (!hasMore || !nextAfter || cursors.has(nextAfter)) break;
      cursors.add(nextAfter);
      after = nextAfter;
    }
  }
}

export const createManifestWorldStarter = (
  world: WorldDescriptor,
  connector: string,
): WorldStudioStarter => {
  const limits = world.backend?.valueLimits?.particlesCount;
  const min = Math.max(1, Math.ceil(limits?.min ?? 1));
  const max = Math.min(10000, Math.floor(limits?.max ?? 10000));
  return {
    schemaVersion: 1,
    connector,
    particlesCount: Math.max(min, Math.min(max, 12)),
    dynamicRi: {},
    simulate: true,
  };
};
