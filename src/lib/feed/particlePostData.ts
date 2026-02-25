import type { ExploreParticle } from "$lib/data/exploreParticles";
import { mockUsers } from "$lib/data/users";
import type { MockFeatureDef, MockParticleDef } from "$lib/particles/mockPtNetwork";
import type { SocialEvent } from "$lib/social/mockSocialFeed";
import { fetchChainOwnedStudioSnapshot } from "$lib/studio/chainStudioAdapter";

export type ParticlePostEvent = SocialEvent;

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

const rebuildEventsFromParticles = (particles: ParticleRecord[]): ParticlePostEvent[] => {
  const labelById = new Map(particles.map((particle) => [particle.id, particle.name] as const));
  return particles
    .map((particle) => ({
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
    .sort((a, b) => b.createdAt - a.createdAt);
};

const mergeSnapshots = async (): Promise<ParticlePostCache> => {
  const settled = await Promise.allSettled(
    mockUsers
      .filter((user) => Boolean(user.address?.trim()))
      .map((user) =>
        fetchChainOwnedStudioSnapshot(user.address, {
          authorId: user.id,
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
      if (nextParticlesById.has(particle.id)) return;
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
        createdLabel: "synced",
        dependencies: [...particle.dependencies],
      };
      nextParticlesById.set(record.id, record);
      searchByKind.particles.set(`particle:${record.id}`, {
        id: record.id,
        label: record.name,
        summary: record.summary,
        authorId: record.authorId,
      });
    });
  }

  const particles = Array.from(nextParticlesById.values()).sort(
    (a, b) => b.createdAt - a.createdAt,
  );

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

export const getParticleDependencyRegistrySnapshot = (): ParticleDependencyRegistrySnapshot =>
  cache.registry;

export const listParticleSearchEntities = () => cache.searchable;

export const isParticlePostDataLoaded = () => cache.loaded;

export const resetParticlePostDataCacheForDebug = () => {
  cache = emptyCache();
  loadPromise = null;
};
