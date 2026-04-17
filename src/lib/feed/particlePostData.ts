import { normalizeFormatHash } from "$lib/chain/registryApi";
import type { ExploreParticle } from "$lib/data/exploreParticles";
import type { FormatFeedEvent } from "$lib/formats/localFormats";
import type { MockFeatureDef, MockParticleDef } from "$lib/particles/mockPtNetwork";
import {
  fetchChainOwnedStudioSnapshot,
  fetchChainParticleForStudio,
  listChainSyncSourcesForApp,
} from "$lib/studio/chainStudioAdapter";
import type { StudioConnectorDef } from "$lib/studio/domain/connectorModel";

export type ConnectorPostEvent = {
  type: "connector";
  id: string;
  authorId: string;
  createdAt: number;
  createdLabel: string;
  particleId: string;
  particleLabel: string;
  formatHash?: string;
  usedParticleIds: string[];
  usedParticleLabels: string[];
  createdNodeIds: string[];
  reusedNodeIds: string[];
  focusNodeIds: string[];
};

export type RuntimeCodePostEvent = {
  type: "transformation" | "condition";
  id: string;
  authorId: string;
  createdAt: number;
  createdLabel: string;
  elementId: string;
  elementLabel: string;
  runtimeSnippet: string;
};

export type ParticlePostEvent = ConnectorPostEvent | RuntimeCodePostEvent;
export type NetworkFeedEvent = ParticlePostEvent | FormatFeedEvent;

export type ParticleRecord = Pick<
  ExploreParticle,
  | "id"
  | "name"
  | "summary"
  | "authorId"
  | "createdAt"
  | "createdLabel"
  | "dependencies"
  | "formatHash"
>;

type ParticleDependencyRegistrySnapshot = {
  connectors: Record<string, StudioConnectorDef>;
  particles: Record<string, MockParticleDef>;
  features: Record<string, MockFeatureDef>;
};

type ParticlePostCache = {
  loaded: boolean;
  events: ParticlePostEvent[];
  particlesById: Map<string, ParticleRecord>;
  registry: ParticleDependencyRegistrySnapshot;
  searchable: {
    connectors: Array<{ id: string; label: string; summary: string; authorId: string }>;
    transformations: Array<{ id: string; label: string; summary: string; authorId: string }>;
    conditions: Array<{ id: string; label: string; summary: string; authorId: string }>;
  };
};

const emptyCache = (): ParticlePostCache => ({
  loaded: false,
  events: [],
  particlesById: new Map(),
  registry: { connectors: {}, particles: {}, features: {} },
  searchable: { connectors: [], transformations: [], conditions: [] },
});

let cache: ParticlePostCache = emptyCache();
let loadPromise: Promise<ParticlePostCache> | null = null;
let cachedMaxOwnedPerSource: number | null = null;
let cachedMaxSources: number | null = null;
let cachedIncludesRuntimeCode = false;
let cachedIncludesDependencyExpansion = false;
let cachedSourceAddresses: string[] | null = null;
const terminalSetCache = new Map<string, string[]>();
const SOURCE_SNAPSHOT_CONCURRENCY = 4;
const SOURCE_SNAPSHOT_TIMEOUT_MS = 6000;
const EXPLICIT_SOURCE_SNAPSHOT_TIMEOUT_MS = 15000;
const DEPENDENCY_FETCH_CONCURRENCY = 8;
const DEPENDENCY_FETCH_TIMEOUT_MS = 8000;
const CHAIN_ADDRESS_RE = /^0x[0-9a-f]{40}$/;

const normalizeSourceAddress = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  const withPrefix = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return CHAIN_ADDRESS_RE.test(withPrefix) ? withPrefix : "";
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, context: string) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${context} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
};

const runSettledWithConcurrency = async <T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<Array<PromiseSettledResult<R>>> => {
  if (items.length === 0) return [];
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results: Array<PromiseSettledResult<R>> = new Array(items.length);
  let cursor = 0;

  const worker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        const value = await task(items[index], index);
        results[index] = { status: "fulfilled", value };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };

  await Promise.all(Array.from({ length: safeConcurrency }, () => worker()));
  return results;
};

const normalizeEpochForSort = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const compareNewestFirst = (
  a: { createdAt: number; id: string },
  b: { createdAt: number; id: string },
) => {
  const byCreatedAt = normalizeEpochForSort(b.createdAt) - normalizeEpochForSort(a.createdAt);
  if (byCreatedAt !== 0) return byCreatedAt;
  return b.id.localeCompare(a.id);
};

const rebuildEventsFromParticles = (particles: ParticleRecord[]): ConnectorPostEvent[] => {
  const labelById = new Map(particles.map((particle) => [particle.id, particle.name] as const));
  return particles
    .map(
      (particle) =>
        ({
          type: "connector",
          id: `event-particle-created-${particle.id}`,
          authorId: particle.authorId,
          createdAt: particle.createdAt,
          createdLabel: particle.createdLabel,
          particleId: particle.id,
          particleLabel: particle.name,
          ...(particle.formatHash ? { formatHash: particle.formatHash } : {}),
          usedParticleIds: [...particle.dependencies],
          usedParticleLabels: particle.dependencies.map((id) => labelById.get(id) ?? id),
          createdNodeIds: [],
          reusedNodeIds: [],
          focusNodeIds: [],
        }) satisfies ConnectorPostEvent,
    )
    .sort(compareNewestFirst);
};

const mergeParticleRecordIntoStructures = (
  particle: ParticleRecord,
  nextParticlesById: Map<string, ParticleRecord>,
  searchByKind: {
    connectors: Map<string, { id: string; label: string; summary: string; authorId: string }>;
  },
) => {
  if (nextParticlesById.has(particle.id)) return;
  nextParticlesById.set(particle.id, particle);
  searchByKind.connectors.set(`connector:${particle.id}`, {
    id: particle.id,
    label: particle.name,
    summary: particle.summary,
    authorId: particle.authorId,
  });
};

const normalizeOptionalFormatHash = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return normalizeFormatHash(trimmed);
  } catch {
    return undefined;
  }
};

type RuntimeCodeRecord = {
  type: "transformation" | "condition";
  id: string;
  label: string;
  summary: string;
  runtimeSnippet: string;
  authorId: string;
  createdAt: number;
};

const normalizeRuntimeSnippet = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const returnMatch = trimmed.match(/\breturn\b[\s\S]*?;/i);
  if (returnMatch) return returnMatch[0].replace(/\s+/g, " ").trim();
  return trimmed.replace(/\s+/g, " ").trim();
};

const rebuildRuntimeCodeEvents = (records: RuntimeCodeRecord[]): Array<RuntimeCodePostEvent> =>
  records.map((record) => ({
    type: record.type,
    id: `event-${record.type}-created-${record.id}`,
    authorId: record.authorId,
    createdAt: record.createdAt,
    createdLabel: "",
    elementId: record.id,
    elementLabel: record.label,
    runtimeSnippet: record.runtimeSnippet,
  }));

const mergeSnapshots = async (options?: {
  forceSources?: boolean;
  maxOwnedPerSource?: number;
  maxSources?: number;
  includeRuntimeCode?: boolean;
  includeDependencyExpansion?: boolean;
  sourceAddresses?: string[];
}): Promise<ParticlePostCache> => {
  const explicitSourceAddresses = Array.from(
    new Set((options?.sourceAddresses ?? []).map(normalizeSourceAddress).filter(Boolean)),
  );
  const sourceSnapshotTimeoutMs =
    explicitSourceAddresses.length > 0
      ? EXPLICIT_SOURCE_SNAPSHOT_TIMEOUT_MS
      : SOURCE_SNAPSHOT_TIMEOUT_MS;
  const allSources =
    explicitSourceAddresses.length > 0
      ? explicitSourceAddresses.map((address) => ({
          address,
          authorId: address,
          label: address,
        }))
      : await listChainSyncSourcesForApp({ force: options?.forceSources });
  const chainSources =
    typeof options?.maxSources === "number" && Number.isFinite(options.maxSources)
      ? allSources.slice(0, Math.max(1, Math.trunc(options.maxSources)))
      : allSources;
  const includeRuntimeCode = options?.includeRuntimeCode !== false;
  const includeDependencyExpansion = options?.includeDependencyExpansion !== false;

  const settled = await runSettledWithConcurrency(
    chainSources,
    SOURCE_SNAPSHOT_CONCURRENCY,
    (source) =>
      withTimeout(
        fetchChainOwnedStudioSnapshot(source.address, {
          authorId: source.authorId,
          ...(typeof options?.maxOwnedPerSource === "number"
            ? { limit: options.maxOwnedPerSource }
            : {}),
          includeRuntimeCode,
        }),
        sourceSnapshotTimeoutMs,
        `snapshot ${source.address}`,
      ),
  );
  const successfulSnapshots = settled.filter((result) => result.status === "fulfilled").length;
  const failedSnapshots = settled.length - successfulSnapshots;
  if (explicitSourceAddresses.length > 0 && failedSnapshots > 0) {
    throw new Error("Failed to load one or more followed accounts. Check connection and retry.");
  }
  if (chainSources.length > 0 && successfulSnapshots === 0) {
    throw new Error("Unable to load chain snapshots from available sources.");
  }

  const nextParticlesById = new Map<string, ParticleRecord>();
  const nextRegistry: ParticleDependencyRegistrySnapshot = {
    connectors: {},
    particles: {},
    features: {},
  };
  const searchByKind = {
    connectors: new Map<string, { id: string; label: string; summary: string; authorId: string }>(),
    transformations: new Map<
      string,
      { id: string; label: string; summary: string; authorId: string }
    >(),
    conditions: new Map<string, { id: string; label: string; summary: string; authorId: string }>(),
  };
  const runtimeCodeRecordsById = new Map<string, RuntimeCodeRecord>();

  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    const snapshot = result.value;

    Object.assign(nextRegistry.features, snapshot.registry.features);
    Object.assign(nextRegistry.particles, snapshot.registry.particles);
    Object.assign(nextRegistry.connectors, snapshot.registry.connectors);

    snapshot.library.transformations.forEach((item) => {
      const transformationId = item.id.replace(/^transform-/, "").trim();
      if (!searchByKind.transformations.has(item.id)) {
        searchByKind.transformations.set(item.id, {
          id: transformationId || item.id,
          label: item.name,
          summary: item.summary ?? "Synced from chain.",
          authorId: item.authorId,
        });
      }
      const runtimeSnippet = normalizeRuntimeSnippet(
        item.runtimeSnippet?.trim() || item.summary?.trim() || "",
      );
      if (!runtimeSnippet) return;
      const eventKey = `transformation:${transformationId || item.id}`;
      if (runtimeCodeRecordsById.has(eventKey)) return;
      runtimeCodeRecordsById.set(eventKey, {
        type: "transformation",
        id: transformationId || item.id,
        label: item.name,
        summary: item.summary ?? "Synced from chain.",
        runtimeSnippet,
        authorId: item.authorId,
        createdAt: 0,
      });
    });
    snapshot.library.conditions.forEach((item) => {
      const conditionId = item.id.replace(/^condition-/, "").trim();
      if (!searchByKind.conditions.has(item.id)) {
        searchByKind.conditions.set(item.id, {
          id: conditionId || item.id,
          label: item.name,
          summary: item.summary ?? "Synced from chain.",
          authorId: item.authorId,
        });
      }
      const runtimeSnippet = normalizeRuntimeSnippet(
        item.runtimeSnippet?.trim() || item.summary?.trim() || "",
      );
      if (!runtimeSnippet) return;
      const eventKey = `condition:${conditionId || item.id}`;
      if (runtimeCodeRecordsById.has(eventKey)) return;
      runtimeCodeRecordsById.set(eventKey, {
        type: "condition",
        id: conditionId || item.id,
        label: item.name,
        summary: item.summary ?? "Synced from chain.",
        runtimeSnippet,
        authorId: item.authorId,
        createdAt: 0,
      });
    });

    snapshot.particles.forEach((particle) => {
      const createdAt = Number.isFinite(particle.createdAt) ? particle.createdAt : 0;
      const record: ParticleRecord = {
        id: particle.id,
        name: particle.name,
        summary:
          particle.summary && particle.summary.trim().length > 0
            ? particle.summary
            : `${particle.name} connector synced from chain.`,
        authorId: particle.authorId,
        createdAt,
        createdLabel: "",
        dependencies: [...particle.dependencies],
        formatHash: normalizeOptionalFormatHash(particle.formatHash),
      };
      mergeParticleRecordIntoStructures(record, nextParticlesById, searchByKind);
    });
  }

  // Pull one-hop dependency connectors so /p/[id] links and search can resolve referenced connectors
  // even when they are not owned by the currently synced user source set.
  const missingDependencyIds = Array.from(
    new Set(
      Array.from(nextParticlesById.values()).flatMap((particle) =>
        particle.dependencies.filter((id) => !nextParticlesById.has(id)),
      ),
    ),
  );

  if (includeDependencyExpansion && missingDependencyIds.length > 0) {
    const dependencyFetches = await runSettledWithConcurrency(
      missingDependencyIds,
      DEPENDENCY_FETCH_CONCURRENCY,
      (id) =>
        withTimeout(
          fetchChainParticleForStudio(id),
          DEPENDENCY_FETCH_TIMEOUT_MS,
          `dependency ${id}`,
        ),
    );

    for (const result of dependencyFetches) {
      if (result.status !== "fulfilled") continue;
      const fetched = result.value;
      if (fetched.registry.feature) {
        nextRegistry.features[fetched.registry.feature.name] = fetched.registry.feature;
      }
      if (fetched.registry.particle) {
        nextRegistry.particles[fetched.registry.particle.name] = fetched.registry.particle;
      }
      if (fetched.registry.connector) {
        nextRegistry.connectors[fetched.registry.connector.name] = fetched.registry.connector;
      }
      if (fetched.particleMeta) {
        const fallbackRecord: ParticleRecord = {
          id: fetched.particleMeta.id,
          name: fetched.particleMeta.name,
          summary: fetched.particleMeta.summary,
          authorId: fetched.particleMeta.authorId,
          createdAt: Number.isFinite(fetched.particleMeta.createdAt)
            ? fetched.particleMeta.createdAt
            : 0,
          createdLabel: "",
          dependencies: [...fetched.particleMeta.dependencies],
          formatHash: normalizeOptionalFormatHash(fetched.particleMeta.formatHash),
        };
        mergeParticleRecordIntoStructures(fallbackRecord, nextParticlesById, searchByKind);
      }
    }
  }

  const particles = Array.from(nextParticlesById.values()).sort(compareNewestFirst);
  if (particles.length === 0 && failedSnapshots > 0) {
    throw new Error(
      "Unable to load network feed reliably (some chain sources timed out or failed).",
    );
  }

  const connectorEvents = rebuildEventsFromParticles(particles);
  const runtimeCodeEvents = includeRuntimeCode
    ? rebuildRuntimeCodeEvents(Array.from(runtimeCodeRecordsById.values()).sort(compareNewestFirst))
    : [];
  const events = [...connectorEvents, ...runtimeCodeEvents].sort(compareNewestFirst);

  return {
    loaded: true,
    events,
    particlesById: nextParticlesById,
    registry: nextRegistry,
    searchable: {
      connectors: Array.from(searchByKind.connectors.values()),
      transformations: Array.from(searchByKind.transformations.values()),
      conditions: Array.from(searchByKind.conditions.values()),
    },
  };
};

export const syncParticlePostDataFromChain = async (options?: {
  force?: boolean;
  forceSources?: boolean;
  maxOwnedPerSource?: number;
  maxSources?: number;
  includeRuntimeCode?: boolean;
  includeDependencyExpansion?: boolean;
  sourceAddresses?: string[];
}) => {
  const requestedIncludesRuntimeCode = options?.includeRuntimeCode !== false;
  const requestedSourceAddresses = Array.from(
    new Set((options?.sourceAddresses ?? []).map(normalizeSourceAddress).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const hasExplicitSourceAddresses = requestedSourceAddresses.length > 0;
  const requestedIncludesDependencyExpansion = hasExplicitSourceAddresses
    ? options?.includeDependencyExpansion === true
    : options?.includeDependencyExpansion !== false;
  const requestedMaxOwnedPerSource =
    typeof options?.maxOwnedPerSource === "number" && Number.isFinite(options.maxOwnedPerSource)
      ? Math.max(1, Math.trunc(options.maxOwnedPerSource))
      : null;
  const requestedMaxSources =
    typeof options?.maxSources === "number" && Number.isFinite(options.maxSources)
      ? Math.max(1, Math.trunc(options.maxSources))
      : null;

  const cacheSatisfiesRequest = (() => {
    if (!cache.loaded) return false;
    if (hasExplicitSourceAddresses) {
      if (!cachedSourceAddresses) return false;
      if (cachedSourceAddresses.length !== requestedSourceAddresses.length) return false;
      if (
        !cachedSourceAddresses.every((value, index) => value === requestedSourceAddresses[index])
      ) {
        return false;
      }
    } else if (cachedSourceAddresses !== null) {
      return false;
    }
    if (requestedIncludesRuntimeCode && !cachedIncludesRuntimeCode) return false;
    if (requestedIncludesDependencyExpansion && !cachedIncludesDependencyExpansion) return false;
    if (requestedMaxSources === null) {
      if (cachedMaxSources !== null) return false;
    } else if (cachedMaxSources !== null && cachedMaxSources < requestedMaxSources) {
      return false;
    }
    if (requestedMaxOwnedPerSource === null) {
      return cachedMaxOwnedPerSource === null;
    }
    if (cachedMaxOwnedPerSource === null) return true;
    return cachedMaxOwnedPerSource >= requestedMaxOwnedPerSource;
  })();

  if (cacheSatisfiesRequest && !options?.force) return cache;

  if (!loadPromise || options?.force) {
    loadPromise = mergeSnapshots({
      forceSources: Boolean(options?.forceSources),
      includeRuntimeCode: requestedIncludesRuntimeCode,
      includeDependencyExpansion: requestedIncludesDependencyExpansion,
      ...(hasExplicitSourceAddresses ? { sourceAddresses: requestedSourceAddresses } : {}),
      ...(requestedMaxSources !== null ? { maxSources: requestedMaxSources } : {}),
      ...(requestedMaxOwnedPerSource !== null
        ? { maxOwnedPerSource: requestedMaxOwnedPerSource }
        : {}),
    })
      .then((next) => {
        cache = next;
        cachedSourceAddresses = hasExplicitSourceAddresses ? [...requestedSourceAddresses] : null;
        cachedMaxOwnedPerSource = requestedMaxOwnedPerSource;
        cachedMaxSources = requestedMaxSources;
        cachedIncludesRuntimeCode = requestedIncludesRuntimeCode;
        cachedIncludesDependencyExpansion = requestedIncludesDependencyExpansion;
        terminalSetCache.clear();
        return cache;
      })
      .catch((error) => {
        loadPromise = null;
        throw error;
      });
  }
  const next = await loadPromise;
  return next;
};

export const listParticlePosts = (): ParticlePostEvent[] =>
  [...cache.events].sort(compareNewestFirst);

export const listNetworkFeedEvents = (): NetworkFeedEvent[] =>
  [...cache.events].sort(compareNewestFirst);

export const listParticlePostsByAuthor = (authorId: string): ParticlePostEvent[] =>
  cache.events.filter((event) => event.authorId === authorId).sort(compareNewestFirst);

export const listNetworkFeedEventsByAuthor = (authorId: string): NetworkFeedEvent[] =>
  listNetworkFeedEvents()
    .filter((event) => event.authorId === authorId)
    .sort(compareNewestFirst);

export const listParticlePostsReferencingParticle = (particleId: string): ParticlePostEvent[] =>
  cache.events.filter(
    (event): event is ConnectorPostEvent =>
      event.type === "connector" && event.usedParticleIds.includes(particleId),
  );

export const getParticleRecordById = (particleId: string): ParticleRecord | null =>
  cache.particlesById.get(particleId) ?? null;

export const ensureParticleRecordLoadedById = async (
  particleId: string,
): Promise<ParticleRecord | null> => {
  const existing = cache.particlesById.get(particleId) ?? null;
  if (existing) return existing;

  try {
    const fetched = await fetchChainParticleForStudio(particleId);
    if (fetched.registry.feature) {
      cache.registry.features[fetched.registry.feature.name] = fetched.registry.feature;
    }
    if (fetched.registry.particle) {
      cache.registry.particles[fetched.registry.particle.name] = fetched.registry.particle;
    }
    if (fetched.registry.connector) {
      cache.registry.connectors[fetched.registry.connector.name] = fetched.registry.connector;
    }
    if (!fetched.particleMeta) return null;

    const record: ParticleRecord = {
      id: fetched.particleMeta.id,
      name: fetched.particleMeta.name,
      summary: fetched.particleMeta.summary,
      authorId: fetched.particleMeta.authorId,
      createdAt: fetched.particleMeta.createdAt,
      createdLabel: fetched.particleMeta.createdLabel,
      dependencies: [...fetched.particleMeta.dependencies],
      formatHash: normalizeOptionalFormatHash(fetched.particleMeta.formatHash),
    };
    cache.particlesById.set(record.id, record);
    cache.searchable.connectors = [
      ...cache.searchable.connectors.filter((item) => item.id !== record.id),
      {
        id: record.id,
        label: record.name,
        summary: record.summary,
        authorId: record.authorId,
      },
    ].sort((a, b) => a.label.localeCompare(b.label));
    terminalSetCache.clear();
    return record;
  } catch {
    return null;
  }
};

export const listParticleRecords = (): ParticleRecord[] => Array.from(cache.particlesById.values());

export const listParticleRecordsByFormatHash = (formatHash: string): ParticleRecord[] => {
  let normalizedHash = "";
  try {
    normalizedHash = normalizeFormatHash(formatHash);
  } catch {
    return [];
  }
  return listParticleRecords().filter((particle) => particle.formatHash === normalizedHash);
};

export const getParticleLabelMap = (): ReadonlyMap<string, string> =>
  new Map(
    Array.from(cache.particlesById.values()).map(
      (particle) => [particle.id, particle.name] as const,
    ),
  );

export const getParticleDependencyRegistrySnapshot = (): ParticleDependencyRegistrySnapshot =>
  cache.registry;

export const listParticleSearchEntities = () => cache.searchable;

export const isParticlePostDataLoaded = () => cache.loaded;

export const doesParticlePostCacheMatchSources = (sourceAddresses: string[]): boolean => {
  if (!cache.loaded) return false;
  const normalizedSources = Array.from(
    new Set(sourceAddresses.map(normalizeSourceAddress).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  if (normalizedSources.length === 0) return cachedSourceAddresses === null;
  if (!cachedSourceAddresses) return false;
  if (cachedSourceAddresses.length !== normalizedSources.length) return false;
  return cachedSourceAddresses.every((value, index) => value === normalizedSources[index]);
};

export const resetParticlePostDataCacheForDebug = () => {
  cache = emptyCache();
  loadPromise = null;
  cachedSourceAddresses = null;
  cachedMaxOwnedPerSource = null;
  cachedMaxSources = null;
  cachedIncludesRuntimeCode = false;
  cachedIncludesDependencyExpansion = false;
  terminalSetCache.clear();
};

const sortUnique = (values: string[]) =>
  Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));

const computeTerminalSet = (particleId: string, seen = new Set<string>()): string[] => {
  if (terminalSetCache.has(particleId)) return terminalSetCache.get(particleId)!;
  if (seen.has(particleId)) return [particleId];
  seen.add(particleId);

  const registryParticle = cache.registry.particles[particleId];
  if (!registryParticle) {
    const leaf = [particleId];
    terminalSetCache.set(particleId, leaf);
    seen.delete(particleId);
    return leaf;
  }

  const composites = (registryParticle.composites ?? []).filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );

  if (!composites.length) {
    const leaf = [particleId];
    terminalSetCache.set(particleId, leaf);
    seen.delete(particleId);
    return leaf;
  }

  const merged = sortUnique(composites.flatMap((name) => computeTerminalSet(name, seen)));
  terminalSetCache.set(particleId, merged);
  seen.delete(particleId);
  return merged;
};

export const getParticleTerminalSet = (particleId: string): string[] =>
  computeTerminalSet(particleId);

const sameStringSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export const findParticlesByTerminalSet = (terminalParticleIds: string[]): ParticleRecord[] => {
  const target = sortUnique(terminalParticleIds);
  return listParticleRecords().filter((particle) =>
    sameStringSet(getParticleTerminalSet(particle.id), target),
  );
};
