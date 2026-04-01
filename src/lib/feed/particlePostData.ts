import { normalizeFormatHash } from "$lib/chain/registryApi";
import type { ExploreParticle } from "$lib/data/exploreParticles";
import {
  getChainFormatDisplayName,
  mergeChainFormatRecords,
  type ChainFormatRecord,
} from "$lib/formats/chainFormats";
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

export type NetworkFeedEvent = ParticlePostEvent;

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

type SearchableEntity = { id: string; label: string; summary: string; authorId: string };

type ParticlePostCache = {
  loaded: boolean;
  events: ParticlePostEvent[];
  networkEvents: NetworkFeedEvent[];
  particlesById: Map<string, ParticleRecord>;
  formatsByHash: Map<string, ChainFormatRecord>;
  registry: ParticleDependencyRegistrySnapshot;
  searchable: {
    connectors: SearchableEntity[];
    transformations: SearchableEntity[];
    conditions: SearchableEntity[];
    formats: SearchableEntity[];
  };
};

const emptyCache = (): ParticlePostCache => ({
  loaded: false,
  events: [],
  networkEvents: [],
  particlesById: new Map(),
  formatsByHash: new Map(),
  registry: { connectors: {}, particles: {}, features: {} },
  searchable: { connectors: [], transformations: [], conditions: [], formats: [] },
});

let cache: ParticlePostCache = emptyCache();
let loadPromise: Promise<ParticlePostCache> | null = null;
const terminalSetCache = new Map<string, string[]>();

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
    .sort((a, b) => {
      const byCreatedAt = b.createdAt - a.createdAt;
      if (byCreatedAt !== 0) return byCreatedAt;
      return a.particleId.localeCompare(b.particleId);
    });
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

const mergeSnapshots = async (options?: { forceSources?: boolean }): Promise<ParticlePostCache> => {
  const chainSources = await listChainSyncSourcesForApp({ force: options?.forceSources });

  const settled = await Promise.allSettled(
    chainSources.map((source) =>
      fetchChainOwnedStudioSnapshot(source.address, {
        authorId: source.authorId,
      }),
    ),
  );

  const nextParticlesById = new Map<string, ParticleRecord>();
  const nextRegistry: ParticleDependencyRegistrySnapshot = {
    connectors: {},
    particles: {},
    features: {},
  };
  const searchByKind = {
    connectors: new Map<string, SearchableEntity>(),
    transformations: new Map<string, SearchableEntity>(),
    conditions: new Map<string, SearchableEntity>(),
    formats: new Map<string, SearchableEntity>(),
  };
  const runtimeCodeRecordsById = new Map<string, RuntimeCodeRecord>();
  const formatRecordsByHash = new Map<string, ChainFormatRecord>();
  const formatAuthorByHash = new Map<string, string>();

  let particleCounter = 0;

  for (const [sourceIndex, result] of settled.entries()) {
    if (result.status !== "fulfilled") continue;
    const snapshot = result.value;
    const source = chainSources[sourceIndex];

    Object.assign(nextRegistry.features, snapshot.registry.features);
    Object.assign(nextRegistry.particles, snapshot.registry.particles);
    Object.assign(nextRegistry.connectors, snapshot.registry.connectors);

    snapshot.formats.forEach((record) => {
      const existing = formatRecordsByHash.get(record.formatHash);
      const merged = existing ? mergeChainFormatRecords([existing, record]) : record;
      if (merged) {
        formatRecordsByHash.set(merged.formatHash, merged);
      }
      if (!formatAuthorByHash.has(record.formatHash)) {
        formatAuthorByHash.set(record.formatHash, source?.authorId ?? "chain-source-unknown");
      }
    });

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
        createdAt: Date.now() - particleCounter * 1000,
      });
      particleCounter += 1;
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
        createdAt: Date.now() - particleCounter * 1000,
      });
      particleCounter += 1;
    });

    snapshot.particles.forEach((particle) => {
      const createdAt = Date.now() - particleCounter * 1000;
      particleCounter += 1;
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
        ...(particle.formatHash ? { formatHash: particle.formatHash } : {}),
      };
      mergeParticleRecordIntoStructures(record, nextParticlesById, searchByKind);
    });
  }

  // Pull one-hop dependency connectors so /c/[id] links and search can resolve referenced connectors
  // even when they are not owned by the currently synced user source set.
  const missingDependencyIds = Array.from(
    new Set(
      Array.from(nextParticlesById.values()).flatMap((particle) =>
        particle.dependencies.filter((id) => !nextParticlesById.has(id)),
      ),
    ),
  );

  if (missingDependencyIds.length > 0) {
    const dependencyFetches = await Promise.allSettled(
      missingDependencyIds.map((id) => fetchChainParticleForStudio(id)),
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
          createdAt: Date.now() - particleCounter * 1000,
          createdLabel: "",
          dependencies: [...fetched.particleMeta.dependencies],
          ...(fetched.particleMeta.formatHash
            ? { formatHash: fetched.particleMeta.formatHash }
            : {}),
        };
        particleCounter += 1;
        mergeParticleRecordIntoStructures(fallbackRecord, nextParticlesById, searchByKind);
      }
    }
  }

  const particles = Array.from(nextParticlesById.values()).sort((a, b) => {
    const byCreatedAt = b.createdAt - a.createdAt;
    if (byCreatedAt !== 0) return byCreatedAt;
    return a.id.localeCompare(b.id);
  });

  const connectorEvents = rebuildEventsFromParticles(particles);
  Array.from(formatRecordsByHash.values()).forEach((formatRecord) => {
    const authorFromConnector = formatRecord.connectors
      .map((ref) => nextParticlesById.get(ref.name)?.authorId)
      .find((value): value is string => Boolean(value && value.trim().length > 0));
    const authorId =
      formatAuthorByHash.get(formatRecord.formatHash) ??
      authorFromConnector ??
      "chain-source-unknown";
    const formatName = getChainFormatDisplayName(formatRecord.formatHash);
    const summary = formatRecord.scalars.length
      ? `Scalars: ${formatRecord.scalars.join(", ")}`
      : `${formatRecord.connectors.length} connector${formatRecord.connectors.length === 1 ? "" : "s"} in format`;

    searchByKind.formats.set(`format:${formatRecord.formatHash}`, {
      id: formatRecord.formatHash,
      label: formatName,
      summary,
      authorId,
    });
  });

  const runtimeCodeEvents = rebuildRuntimeCodeEvents(
    Array.from(runtimeCodeRecordsById.values()).sort((a, b) => {
      const byCreatedAt = b.createdAt - a.createdAt;
      if (byCreatedAt !== 0) return byCreatedAt;
      return a.id.localeCompare(b.id);
    }),
  );
  const events = [...connectorEvents, ...runtimeCodeEvents].sort(
    (a, b) => b.createdAt - a.createdAt,
  );
  const networkEvents = events;

  return {
    loaded: true,
    events,
    networkEvents,
    particlesById: nextParticlesById,
    formatsByHash: formatRecordsByHash,
    registry: nextRegistry,
    searchable: {
      connectors: Array.from(searchByKind.connectors.values()),
      transformations: Array.from(searchByKind.transformations.values()),
      conditions: Array.from(searchByKind.conditions.values()),
      formats: Array.from(searchByKind.formats.values()),
    },
  };
};

export const syncParticlePostDataFromChain = async (options?: { force?: boolean }) => {
  if (cache.loaded && !options?.force) return cache;
  if (!loadPromise || options?.force) {
    loadPromise = mergeSnapshots({ forceSources: Boolean(options?.force) })
      .then((next) => {
        cache = next;
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

export const listParticlePosts = (): ParticlePostEvent[] => cache.events;

export const listNetworkFeedEvents = (): NetworkFeedEvent[] => cache.networkEvents;

export const listParticlePostsByAuthor = (authorId: string): ParticlePostEvent[] =>
  cache.events.filter((event) => event.authorId === authorId);

export const listNetworkFeedEventsByAuthor = (authorId: string): NetworkFeedEvent[] =>
  cache.networkEvents.filter((event) => event.authorId === authorId);

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
      ...(fetched.particleMeta.formatHash ? { formatHash: fetched.particleMeta.formatHash } : {}),
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

export const getFormatRecordByHash = (formatHash: string): ChainFormatRecord | null =>
  cache.formatsByHash.get(normalizeFormatHashSafe(formatHash) ?? formatHash) ?? null;

export const listParticleRecordsByFormatHash = (formatHash: string): ParticleRecord[] => {
  const normalizedTarget = normalizeFormatHashSafe(formatHash);
  if (!normalizedTarget) return [];
  return Array.from(cache.particlesById.values())
    .filter((particle) => {
      const normalizedParticleHash = normalizeFormatHashSafe(particle.formatHash);
      return normalizedParticleHash === normalizedTarget;
    })
    .sort((a, b) => {
      const byCreatedAt = b.createdAt - a.createdAt;
      if (byCreatedAt !== 0) return byCreatedAt;
      return a.id.localeCompare(b.id);
    });
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

export const resetParticlePostDataCacheForDebug = () => {
  cache = emptyCache();
  loadPromise = null;
  terminalSetCache.clear();
};

const sortUnique = (values: string[]) =>
  Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));

const normalizeFormatHashSafe = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    return normalizeFormatHash(value);
  } catch {
    return null;
  }
};

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
