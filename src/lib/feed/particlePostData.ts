import type { ExploreParticle } from "$lib/data/exploreParticles";
import { extraChainSyncSources, mockUsers } from "$lib/data/users";
import type { FormatFeedEvent } from "$lib/formats/localFormats";
import type { MockFeatureDef, MockParticleDef } from "$lib/particles/mockPtNetwork";
import type { SocialEvent } from "$lib/social/mockSocialFeed";
import {
  fetchChainOwnedStudioSnapshot,
  fetchChainParticleForStudio,
} from "$lib/studio/chainStudioAdapter";

export type ParticlePostEvent = SocialEvent;
export type NetworkFeedEvent = ParticlePostEvent | FormatFeedEvent;

export type ParticleRecord = Pick<
  ExploreParticle,
  "id" | "name" | "summary" | "authorId" | "createdAt" | "createdLabel" | "dependencies"
>;

type ParticleDependencyRegistrySnapshot = {
  particles: Record<string, MockParticleDef>;
  features: Record<string, MockFeatureDef>;
};

type ParticlePostCache = {
  loaded: boolean;
  events: ParticlePostEvent[];
  particlesById: Map<string, ParticleRecord>;
  registry: ParticleDependencyRegistrySnapshot;
  searchable: {
    particles: Array<{ id: string; label: string; summary: string; authorId: string }>;
    features: Array<{ id: string; label: string; summary: string; authorId: string }>;
    transformations: Array<{ id: string; label: string; summary: string; authorId: string }>;
    conditions: Array<{ id: string; label: string; summary: string; authorId: string }>;
  };
};

const titleize = (value: string) =>
  value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const emptyCache = (): ParticlePostCache => ({
  loaded: false,
  events: [],
  particlesById: new Map(),
  registry: { particles: {}, features: {} },
  searchable: { particles: [], features: [], transformations: [], conditions: [] },
});

let cache: ParticlePostCache = emptyCache();
let loadPromise: Promise<ParticlePostCache> | null = null;
const terminalSetCache = new Map<string, string[]>();

const rebuildEventsFromParticles = (particles: ParticleRecord[]): ParticlePostEvent[] => {
  const labelById = new Map(particles.map((particle) => [particle.id, particle.name] as const));
  return particles
    .map((particle) => ({
      type: "particle",
      id: `event-particle-created-${particle.id}`,
      authorId: particle.authorId,
      createdAt: particle.createdAt,
      createdLabel: particle.createdLabel,
      particleId: particle.id,
      particleLabel: particle.name,
      usedParticleIds: [...particle.dependencies],
      usedParticleLabels: particle.dependencies.map((id) => labelById.get(id) ?? titleize(id)),
      createdNodeIds: [],
      reusedNodeIds: [],
      focusNodeIds: [],
    }))
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
    particles: Map<string, { id: string; label: string; summary: string; authorId: string }>;
  },
) => {
  if (nextParticlesById.has(particle.id)) return;
  nextParticlesById.set(particle.id, particle);
  searchByKind.particles.set(`particle:${particle.id}`, {
    id: particle.id,
    label: particle.name,
    summary: particle.summary,
    authorId: particle.authorId,
  });
};

const mergeSnapshots = async (): Promise<ParticlePostCache> => {
  const chainSources = [
    ...mockUsers
      .filter((user) => Boolean(user.address?.trim()))
      .map((user) => ({
        address: user.address,
        authorId: user.id,
      })),
    ...extraChainSyncSources
      .filter((source) => Boolean(source.address?.trim()))
      .map((source) => ({
        address: source.address,
        authorId: source.id,
      })),
  ];

  const settled = await Promise.allSettled(
    chainSources.map((source) =>
      fetchChainOwnedStudioSnapshot(source.address, {
        authorId: source.authorId,
      }),
    ),
  );

  const nextParticlesById = new Map<string, ParticleRecord>();
  const nextRegistry: ParticleDependencyRegistrySnapshot = {
    particles: {},
    features: {},
  };
  const searchByKind = {
    particles: new Map<string, { id: string; label: string; summary: string; authorId: string }>(),
    features: new Map<string, { id: string; label: string; summary: string; authorId: string }>(),
    transformations: new Map<
      string,
      { id: string; label: string; summary: string; authorId: string }
    >(),
    conditions: new Map<string, { id: string; label: string; summary: string; authorId: string }>(),
  };

  let particleCounter = 0;

  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    const snapshot = result.value;

    Object.assign(nextRegistry.features, snapshot.registry.features);
    Object.assign(nextRegistry.particles, snapshot.registry.particles);

    snapshot.library.features.forEach((item) => {
      if (!searchByKind.features.has(item.id)) {
        searchByKind.features.set(item.id, {
          id: item.id,
          label: item.name,
          summary: item.summary,
          authorId: item.authorId,
        });
      }
    });
    snapshot.library.transformations.forEach((item) => {
      if (!searchByKind.transformations.has(item.id)) {
        searchByKind.transformations.set(item.id, {
          id: item.id,
          label: item.name,
          summary: item.summary,
          authorId: item.authorId,
        });
      }
    });
    snapshot.library.conditions.forEach((item) => {
      if (!searchByKind.conditions.has(item.id)) {
        searchByKind.conditions.set(item.id, {
          id: item.id,
          label: item.name,
          summary: item.summary,
          authorId: item.authorId,
        });
      }
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
            : `${particle.name} particle synced from chain.`,
        authorId: particle.authorId,
        createdAt,
        createdLabel: "",
        dependencies: [...particle.dependencies],
      };
      mergeParticleRecordIntoStructures(record, nextParticlesById, searchByKind);
    });
  }

  // Pull one-hop dependency particles so /p/[id] links and search can resolve referenced particles
  // even when they are not owned by the 7 synced mock users.
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
      if (fetched.particleMeta) {
        const fallbackRecord: ParticleRecord = {
          id: fetched.particleMeta.id,
          name: fetched.particleMeta.name,
          summary: fetched.particleMeta.summary,
          authorId: fetched.particleMeta.authorId,
          createdAt: Date.now() - particleCounter * 1000,
          createdLabel: "",
          dependencies: [...fetched.particleMeta.dependencies],
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

  return {
    loaded: true,
    events: rebuildEventsFromParticles(particles),
    particlesById: nextParticlesById,
    registry: nextRegistry,
    searchable: {
      particles: Array.from(searchByKind.particles.values()),
      features: Array.from(searchByKind.features.values()),
      transformations: Array.from(searchByKind.transformations.values()),
      conditions: Array.from(searchByKind.conditions.values()),
    },
  };
};

export const syncParticlePostDataFromChain = async (options?: { force?: boolean }) => {
  if (cache.loaded && !options?.force) return cache;
  if (!loadPromise || options?.force) {
    loadPromise = mergeSnapshots()
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

export const listParticlePostsByAuthor = (authorId: string): ParticlePostEvent[] =>
  cache.events.filter((event) => event.authorId === authorId);

export const listParticlePostsReferencingParticle = (particleId: string): ParticlePostEvent[] =>
  cache.events.filter((event) => event.usedParticleIds.includes(particleId));

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
    if (!fetched.particleMeta) return null;

    const record: ParticleRecord = {
      id: fetched.particleMeta.id,
      name: fetched.particleMeta.name,
      summary: fetched.particleMeta.summary,
      authorId: fetched.particleMeta.authorId,
      createdAt: fetched.particleMeta.createdAt,
      createdLabel: fetched.particleMeta.createdLabel,
      dependencies: [...fetched.particleMeta.dependencies],
    };
    cache.particlesById.set(record.id, record);
    cache.searchable.particles = [
      ...cache.searchable.particles.filter((item) => item.id !== record.id),
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
