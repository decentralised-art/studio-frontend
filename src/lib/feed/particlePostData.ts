import {
  createChainFeedStream,
  getChainFeedPage,
  type ChainFeedItem,
  type ChainFeedStreamDelta,
  type ChainFeedStreamMeta,
  type ChainFeedStreamSubscription,
} from "$lib/chain/eventFeedApi";
import { normalizeFormatHash } from "$lib/chain/registryApi";
import type { ExploreParticle } from "$lib/data/exploreParticles";
import {
  applyChainFeedPage,
  applyChainFeedStreamDelta,
  createChainEventFeedCache,
  getChainEventFeedSnapshot,
  type ChainEventFeedPaginationState,
  type ChainEventFeedRecord,
  type ChainEventFeedStreamState,
} from "$lib/feed/chainEventFeed";
import {
  hydrateChainEventDetail,
  hydrateChainFeedItemDetail,
  type ChainEventHydrationTarget,
  type HydratedChainEventDetail,
} from "$lib/feed/chainEventHydration";
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
  feedRecordsById: Map<string, ChainEventFeedRecord>;
  events: ParticlePostEvent[];
  particlesById: Map<string, ParticleRecord>;
  registry: ParticleDependencyRegistrySnapshot;
  searchable: {
    connectors: Array<{ id: string; label: string; summary: string; authorId: string }>;
    transformations: Array<{ id: string; label: string; summary: string; authorId: string }>;
    conditions: Array<{ id: string; label: string; summary: string; authorId: string }>;
  };
  pagination: ChainEventFeedPaginationState;
  stream: ChainEventFeedStreamState;
};

const emptyCache = (): ParticlePostCache => ({
  loaded: false,
  feedRecordsById: new Map(),
  events: [],
  particlesById: new Map(),
  registry: { connectors: {}, particles: {}, features: {} },
  searchable: { connectors: [], transformations: [], conditions: [] },
  pagination: {
    limit: null,
    hasMore: false,
    nextBefore: null,
  },
  stream: {
    lastSeq: null,
    requestedSinceSeq: null,
    minAvailableSeq: null,
    replayFloorSeq: null,
    staleSinceSeq: false,
  },
});

let cache: ParticlePostCache = emptyCache();
let loadPromise: Promise<ParticlePostCache> | null = null;
let loadPromiseKey = "";
let cachedMaxOwnedPerSource: number | null = null;
let cachedMaxSources: number | null = null;
let cachedIncludesRuntimeCode = false;
let cachedIncludesDependencyExpansion = false;
let cachedSourceAddresses: string[] | null = null;
let cachedFollowedFormatHashes: string[] = [];
let cachedFeedPageLimit: number | null = null;
const terminalSetCache = new Map<string, string[]>();
const SOURCE_SNAPSHOT_CONCURRENCY = 4;
const SOURCE_SNAPSHOT_TIMEOUT_MS = 6000;
const EXPLICIT_SOURCE_SNAPSHOT_TIMEOUT_MS = 15000;
const DEPENDENCY_FETCH_CONCURRENCY = 8;
const DEPENDENCY_FETCH_TIMEOUT_MS = 8000;
const EVENT_FEED_PAGE_LIMIT = 128;
const EVENT_FEED_HYDRATION_CONCURRENCY = 8;
const EVENT_FEED_HYDRATION_TIMEOUT_MS = 8000;
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

const normalizeFormatHashForScope = (value: unknown): string => {
  if (typeof value !== "string") return "";
  try {
    return normalizeFormatHash(value);
  } catch {
    return "";
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

const connectorToFeature = (connector: StudioConnectorDef): MockFeatureDef => ({
  name: connector.name,
  dimensions: connector.dimensions.map((dimension, index) => ({
    label: `dim-${index + 1}`,
    transformations: dimension.transformations.map((tx) => ({
      name: tx.name as never,
      args: [...tx.args],
    })),
  })),
});

const connectorToParticle = (connector: StudioConnectorDef): MockParticleDef => ({
  name: connector.name,
  featureName: connector.name,
  composites: connector.dimensions.map((dimension) => dimension.composite ?? null),
  conditionName: connector.conditionName,
  conditionArgs: connector.conditionName ? [...(connector.conditionArgs ?? [])] : undefined,
});

const runtimeEventKey = (type: "transformation" | "condition", id: string) => `${type}:${id}`;

const loadOwnedAccountSnapshotParticlePostCache = async (options?: {
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
    feedRecordsById: new Map(),
    events,
    particlesById: nextParticlesById,
    registry: nextRegistry,
    searchable: {
      connectors: Array.from(searchByKind.connectors.values()),
      transformations: Array.from(searchByKind.transformations.values()),
      conditions: Array.from(searchByKind.conditions.values()),
    },
    pagination: {
      limit: null,
      hasMore: false,
      nextBefore: null,
    },
    stream: {
      lastSeq: null,
      requestedSinceSeq: null,
      minAvailableSeq: null,
      replayFloorSeq: null,
      staleSinceSeq: false,
    },
  };
};

const normalizeFeedPageLimit = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return EVENT_FEED_PAGE_LIMIT;
  return Math.max(1, Math.min(256, Math.trunc(value)));
};

const isFeedItemRuntimeCode = (eventType: string): boolean => {
  const normalized = eventType.trim().toLowerCase();
  return normalized === "transformation_added" || normalized === "condition_added";
};

const isConnectorFeedEvent = (eventType: string, payloadType?: string): boolean => {
  const normalizedPayloadType = payloadType?.trim().toLowerCase() ?? "";
  if (normalizedPayloadType === "connector") return true;
  return eventType.trim().toLowerCase() === "connector_added";
};

type EventFeedScope = {
  sourceAddresses: string[];
  followedFormatHashes: string[];
  includeRuntimeCode: boolean;
  restrictToPreferences: boolean;
};

const createEventFeedScope = (options?: {
  sourceAddresses?: string[];
  followedFormatHashes?: string[];
  includeRuntimeCode?: boolean;
}): EventFeedScope => {
  const sourceAddresses = Array.from(
    new Set((options?.sourceAddresses ?? []).map(normalizeSourceAddress).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const followedFormatHashes = Array.from(
    new Set((options?.followedFormatHashes ?? []).map(normalizeFormatHashForScope).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  return {
    sourceAddresses,
    followedFormatHashes,
    includeRuntimeCode: options?.includeRuntimeCode !== false,
    restrictToPreferences: sourceAddresses.length > 0 || followedFormatHashes.length > 0,
  };
};

const feedOwnerMatchesScope = (owner: string, scope: EventFeedScope): boolean => {
  if (!scope.restrictToPreferences) return true;
  if (scope.sourceAddresses.length === 0) return false;
  return scope.sourceAddresses.includes(normalizeSourceAddress(owner));
};

const feedItemMatchesPreHydrationScope = (item: ChainFeedItem, scope: EventFeedScope): boolean => {
  const ownerMatches = feedOwnerMatchesScope(item.payload.owner, scope);
  if (ownerMatches) return scope.includeRuntimeCode || !isFeedItemRuntimeCode(item.eventType);
  return (
    scope.followedFormatHashes.length > 0 && isConnectorFeedEvent(item.eventType, item.payload.type)
  );
};

const feedDeltaMatchesPreHydrationScope = (
  delta: ChainFeedStreamDelta,
  scope: EventFeedScope,
): boolean => {
  const ownerMatches = feedOwnerMatchesScope(delta.payload.owner, scope);
  if (ownerMatches) return scope.includeRuntimeCode || !isFeedItemRuntimeCode(delta.eventType);
  return (
    scope.followedFormatHashes.length > 0 &&
    isConnectorFeedEvent(delta.eventType, delta.payload.type)
  );
};

const hydratedDetailMatchesScope = (
  event: ParticlePostEvent | null,
  detail: HydratedChainEventDetail | null,
  scope: EventFeedScope,
): boolean => {
  if (!event) return false;
  if (feedOwnerMatchesScope(event.authorId, scope)) return true;
  if (
    event.type === "connector" &&
    detail?.type === "connector" &&
    detail.formatHash &&
    scope.followedFormatHashes.includes(normalizeFormatHashForScope(detail.formatHash))
  ) {
    return true;
  }
  return !scope.restrictToPreferences;
};

type SearchMaps = {
  connectors: Map<string, { id: string; label: string; summary: string; authorId: string }>;
  transformations: Map<string, { id: string; label: string; summary: string; authorId: string }>;
  conditions: Map<string, { id: string; label: string; summary: string; authorId: string }>;
};

const createSearchMaps = (
  searchable: ParticlePostCache["searchable"] = {
    connectors: [],
    transformations: [],
    conditions: [],
  },
): SearchMaps => ({
  connectors: new Map(searchable.connectors.map((item) => [`connector:${item.id}`, item])),
  transformations: new Map(
    searchable.transformations.map((item) => [runtimeEventKey("transformation", item.id), item]),
  ),
  conditions: new Map(
    searchable.conditions.map((item) => [runtimeEventKey("condition", item.id), item]),
  ),
});

const sortSearchEntities = (
  items: Array<{ id: string; label: string; summary: string; authorId: string }>,
) =>
  [...items].sort((a, b) => {
    const byLabel = a.label.localeCompare(b.label);
    if (byLabel !== 0) return byLabel;
    return a.id.localeCompare(b.id);
  });

const searchableFromMaps = (maps: SearchMaps): ParticlePostCache["searchable"] => ({
  connectors: sortSearchEntities(Array.from(maps.connectors.values())),
  transformations: sortSearchEntities(Array.from(maps.transformations.values())),
  conditions: sortSearchEntities(Array.from(maps.conditions.values())),
});

const removeEventFromWorkingStructures = (
  event: ParticlePostEvent,
  particlesById: Map<string, ParticleRecord>,
  registry: ParticleDependencyRegistrySnapshot,
  searchByKind: SearchMaps,
) => {
  if (event.type === "connector") {
    particlesById.delete(event.particleId);
    delete registry.connectors[event.particleId];
    delete registry.features[event.particleId];
    delete registry.particles[event.particleId];
    searchByKind.connectors.delete(`connector:${event.particleId}`);
    return;
  }
  searchByKind[`${event.type}s`].delete(runtimeEventKey(event.type, event.elementId));
};

const mergeParticlePostCaches = (
  base: ParticlePostCache,
  incoming: ParticlePostCache,
): ParticlePostCache => {
  const feedRecordsById = new Map(base.feedRecordsById);
  const particlesById = new Map(base.particlesById);
  const registry: ParticleDependencyRegistrySnapshot = {
    connectors: { ...base.registry.connectors },
    particles: { ...base.registry.particles },
    features: { ...base.registry.features },
  };
  const searchByKind = createSearchMaps(base.searchable);

  for (const [feedId, record] of incoming.feedRecordsById) {
    const previous = feedRecordsById.get(feedId);
    if (previous?.event) {
      removeEventFromWorkingStructures(previous.event, particlesById, registry, searchByKind);
    }
    feedRecordsById.set(feedId, record);
  }

  incoming.particlesById.forEach((record, id) => {
    particlesById.set(id, record);
  });
  Object.assign(registry.connectors, incoming.registry.connectors);
  Object.assign(registry.particles, incoming.registry.particles);
  Object.assign(registry.features, incoming.registry.features);

  const incomingSearch = createSearchMaps(incoming.searchable);
  incomingSearch.connectors.forEach((item, key) => searchByKind.connectors.set(key, item));
  incomingSearch.transformations.forEach((item, key) =>
    searchByKind.transformations.set(key, item),
  );
  incomingSearch.conditions.forEach((item, key) => searchByKind.conditions.set(key, item));

  return {
    loaded: true,
    feedRecordsById,
    events: Array.from(feedRecordsById.values())
      .map((record) => record.event)
      .filter((event): event is ParticlePostEvent => Boolean(event))
      .sort(compareNewestFirst),
    particlesById,
    registry,
    searchable: searchableFromMaps(searchByKind),
    pagination: incoming.pagination,
    stream: base.stream,
  };
};

const hydrateVisibleFeedDetails = async (
  items: Awaited<ReturnType<typeof getChainFeedPage>>["items"],
): Promise<Map<string, HydratedChainEventDetail>> => {
  const visibleItems = items.filter((item) => item.visible && item.status !== "removed");
  const settled = await runSettledWithConcurrency(
    visibleItems,
    EVENT_FEED_HYDRATION_CONCURRENCY,
    (item) =>
      withTimeout(
        hydrateChainFeedItemDetail(item),
        EVENT_FEED_HYDRATION_TIMEOUT_MS,
        `feed detail ${item.feedId}`,
      ).then((detail) => ({ feedId: item.feedId, detail })),
  );

  const detailsByFeedId = new Map<string, HydratedChainEventDetail>();
  for (const result of settled) {
    if (result.status === "rejected") {
      const reason = result.reason;
      throw new Error(
        reason instanceof Error
          ? `Unable to hydrate chain feed detail: ${reason.message}`
          : "Unable to hydrate chain feed detail.",
      );
    }
    if (result.value.detail) {
      detailsByFeedId.set(result.value.feedId, result.value.detail);
    }
  }
  return detailsByFeedId;
};

const mergeHydratedConnectorDetail = (
  detail: Extract<HydratedChainEventDetail, { type: "connector" }>,
  event: ConnectorPostEvent,
  nextParticlesById: Map<string, ParticleRecord>,
  nextRegistry: ParticleDependencyRegistrySnapshot,
  searchByKind: {
    connectors: Map<string, { id: string; label: string; summary: string; authorId: string }>;
  },
): ConnectorPostEvent => {
  const feature = connectorToFeature(detail.connector);
  const particle = connectorToParticle(detail.connector);
  nextRegistry.connectors[detail.connector.name] = detail.connector;
  nextRegistry.features[feature.name] = feature;
  nextRegistry.particles[particle.name] = particle;

  const record: ParticleRecord = {
    ...detail.particleRecord,
    createdAt: event.createdAt,
    createdLabel: event.createdLabel,
  };
  nextParticlesById.set(record.id, record);
  searchByKind.connectors.set(`connector:${record.id}`, {
    id: record.id,
    label: record.name,
    summary: record.summary,
    authorId: record.authorId,
  });

  return {
    ...event,
    authorId: detail.owner,
    particleId: detail.name,
    particleLabel: detail.name,
    ...(detail.formatHash ? { formatHash: detail.formatHash } : {}),
    usedParticleIds: [...detail.dependencies],
    usedParticleLabels: [...detail.dependencies],
  };
};

const mergeHydratedRuntimeCodeDetail = (
  detail: Extract<HydratedChainEventDetail, { type: "transformation" | "condition" }>,
  event: RuntimeCodePostEvent,
  searchByKind: {
    transformations: Map<string, { id: string; label: string; summary: string; authorId: string }>;
    conditions: Map<string, { id: string; label: string; summary: string; authorId: string }>;
  },
): RuntimeCodePostEvent => {
  const nextEvent: RuntimeCodePostEvent = {
    ...event,
    authorId: detail.owner,
    elementId: detail.name,
    elementLabel: detail.name,
    runtimeSnippet: detail.runtimeSnippet,
  };
  searchByKind[`${detail.type}s`].set(runtimeEventKey(detail.type, detail.name), {
    id: detail.name,
    label: detail.name,
    summary: detail.runtimeSnippet,
    authorId: detail.owner,
  });
  return nextEvent;
};

const loadEventFeedParticlePostCache = async (options?: {
  sourceAddresses?: string[];
  followedFormatHashes?: string[];
  includeRuntimeCode?: boolean;
  feedPageLimit?: number;
  before?: string | null;
}): Promise<ParticlePostCache> => {
  const scope = createEventFeedScope(options);
  const page = await getChainFeedPage({
    limit: normalizeFeedPageLimit(options?.feedPageLimit),
    before: options?.before ?? null,
    includeUnfinalized: true,
  });
  const filteredItems = page.items.filter((item) => feedItemMatchesPreHydrationScope(item, scope));
  const eventFeedCache = createChainEventFeedCache();
  applyChainFeedPage(eventFeedCache, { ...page, items: filteredItems });
  const projected = getChainEventFeedSnapshot(eventFeedCache);
  const detailsByFeedId = await hydrateVisibleFeedDetails(filteredItems);

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
  const eventsById = new Map<string, ParticlePostEvent>();
  const feedRecordsById = new Map<string, ChainEventFeedRecord>();

  for (const record of projected.records) {
    let event = record.event;
    const detail = detailsByFeedId.get(record.feedId) ?? null;
    if (!hydratedDetailMatchesScope(event, detail, scope)) {
      feedRecordsById.set(record.feedId, {
        ...record,
        event: null,
        visible: false,
      });
      continue;
    }

    if (event?.type === "connector" && detail?.type === "connector") {
      event = mergeHydratedConnectorDetail(
        detail,
        event,
        nextParticlesById,
        nextRegistry,
        searchByKind,
      );
    } else if (
      event &&
      (event.type === "transformation" || event.type === "condition") &&
      detail &&
      (detail.type === "transformation" || detail.type === "condition")
    ) {
      event = mergeHydratedRuntimeCodeDetail(detail, event, searchByKind);
    }

    if (event) eventsById.set(event.id, event);
    feedRecordsById.set(record.feedId, {
      ...record,
      event,
      visible: Boolean(event),
    });
  }

  const events = Array.from(eventsById.values()).sort(compareNewestFirst);

  return {
    loaded: true,
    feedRecordsById,
    events,
    particlesById: nextParticlesById,
    registry: nextRegistry,
    searchable: {
      connectors: Array.from(searchByKind.connectors.values()),
      transformations: Array.from(searchByKind.transformations.values()),
      conditions: Array.from(searchByKind.conditions.values()),
    },
    pagination: projected.pagination,
    stream: projected.stream,
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
  followedFormatHashes?: string[];
  feedPageLimit?: number;
}) => {
  const requestedScope = createEventFeedScope(options);
  const requestedIncludesRuntimeCode = requestedScope.includeRuntimeCode;
  const requestedSourceAddresses = requestedScope.sourceAddresses;
  const requestedFollowedFormatHashes = requestedScope.followedFormatHashes;
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
  const requestedFeedPageLimit = normalizeFeedPageLimit(options?.feedPageLimit);
  const requestKey = JSON.stringify({
    sourceAddresses: requestedSourceAddresses,
    followedFormatHashes: requestedFollowedFormatHashes,
    includeRuntimeCode: requestedIncludesRuntimeCode,
    includeDependencyExpansion: requestedIncludesDependencyExpansion,
    maxOwnedPerSource: requestedMaxOwnedPerSource,
    maxSources: requestedMaxSources,
    feedPageLimit: requestedFeedPageLimit,
  });

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
    if (cachedFollowedFormatHashes.length !== requestedFollowedFormatHashes.length) return false;
    if (
      !cachedFollowedFormatHashes.every(
        (value, index) => value === requestedFollowedFormatHashes[index],
      )
    ) {
      return false;
    }
    if (requestedIncludesRuntimeCode && !cachedIncludesRuntimeCode) return false;
    if (requestedIncludesDependencyExpansion && !cachedIncludesDependencyExpansion) return false;
    if (cachedFeedPageLimit !== null && cachedFeedPageLimit < requestedFeedPageLimit) return false;
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

  if (!loadPromise || options?.force || loadPromiseKey !== requestKey) {
    loadPromiseKey = requestKey;
    loadPromise = loadEventFeedParticlePostCache({
      includeRuntimeCode: requestedIncludesRuntimeCode,
      ...(hasExplicitSourceAddresses ? { sourceAddresses: requestedSourceAddresses } : {}),
      ...(requestedFollowedFormatHashes.length > 0
        ? { followedFormatHashes: requestedFollowedFormatHashes }
        : {}),
      feedPageLimit: requestedFeedPageLimit,
    })
      .then((next) => {
        cache = next;
        cachedSourceAddresses = hasExplicitSourceAddresses ? [...requestedSourceAddresses] : null;
        cachedFollowedFormatHashes = [...requestedFollowedFormatHashes];
        cachedMaxOwnedPerSource = requestedMaxOwnedPerSource;
        cachedMaxSources = requestedMaxSources;
        cachedIncludesRuntimeCode = requestedIncludesRuntimeCode;
        cachedIncludesDependencyExpansion = requestedIncludesDependencyExpansion;
        cachedFeedPageLimit = requestedFeedPageLimit;
        terminalSetCache.clear();
        loadPromise = null;
        loadPromiseKey = "";
        return cache;
      })
      .catch((error) => {
        loadPromise = null;
        loadPromiseKey = "";
        throw error;
      });
  }
  const next = await loadPromise;
  return next;
};

export const loadMoreParticlePostDataFromChain = async (options?: {
  includeRuntimeCode?: boolean;
  sourceAddresses?: string[];
  followedFormatHashes?: string[];
  feedPageLimit?: number;
}) => {
  const requestedScope = createEventFeedScope(options);
  const requestedFeedPageLimit = normalizeFeedPageLimit(options?.feedPageLimit);
  if (!cache.loaded) {
    return syncParticlePostDataFromChain({
      force: true,
      includeRuntimeCode: requestedScope.includeRuntimeCode,
      ...(requestedScope.sourceAddresses.length > 0
        ? { sourceAddresses: requestedScope.sourceAddresses }
        : {}),
      ...(requestedScope.followedFormatHashes.length > 0
        ? { followedFormatHashes: requestedScope.followedFormatHashes }
        : {}),
      feedPageLimit: requestedFeedPageLimit,
    });
  }
  if (!cache.pagination.hasMore || !cache.pagination.nextBefore) return cache;

  const nextPage = await loadEventFeedParticlePostCache({
    includeRuntimeCode: requestedScope.includeRuntimeCode,
    ...(requestedScope.sourceAddresses.length > 0
      ? { sourceAddresses: requestedScope.sourceAddresses }
      : {}),
    ...(requestedScope.followedFormatHashes.length > 0
      ? { followedFormatHashes: requestedScope.followedFormatHashes }
      : {}),
    feedPageLimit: requestedFeedPageLimit,
    before: cache.pagination.nextBefore,
  });
  cache = mergeParticlePostCaches(cache, nextPage);
  cachedSourceAddresses =
    requestedScope.sourceAddresses.length > 0 ? [...requestedScope.sourceAddresses] : null;
  cachedFollowedFormatHashes = [...requestedScope.followedFormatHashes];
  cachedIncludesRuntimeCode = requestedScope.includeRuntimeCode;
  cachedFeedPageLimit = requestedFeedPageLimit;
  terminalSetCache.clear();
  return cache;
};

const hydrationTargetFromDelta = (
  delta: ChainFeedStreamDelta,
): ChainEventHydrationTarget | null => {
  if (delta.status === "removed") return null;
  const type = delta.payload.type.trim().toLowerCase();
  if (type === "connector" || type === "transformation" || type === "condition") {
    return {
      type,
      name: delta.payload.name,
      owner: delta.payload.owner,
    };
  }
  if (delta.eventType === "connector_added") {
    return { type: "connector", name: delta.payload.name, owner: delta.payload.owner };
  }
  if (delta.eventType === "transformation_added") {
    return { type: "transformation", name: delta.payload.name, owner: delta.payload.owner };
  }
  if (delta.eventType === "condition_added") {
    return { type: "condition", name: delta.payload.name, owner: delta.payload.owner };
  }
  return null;
};

const applyStreamMetaToCache = (meta: ChainFeedStreamMeta) => {
  cache = {
    ...cache,
    stream: {
      lastSeq: meta.lastSeq,
      requestedSinceSeq: meta.requestedSinceSeq,
      minAvailableSeq: meta.minAvailableSeq,
      replayFloorSeq: meta.replayFloorSeq,
      staleSinceSeq: meta.staleSinceSeq,
    },
  };
};

const applyStreamDeltaToCache = async (
  delta: ChainFeedStreamDelta,
  scope: EventFeedScope,
): Promise<boolean> => {
  if (!feedDeltaMatchesPreHydrationScope(delta, scope)) return false;

  const eventFeedCache = createChainEventFeedCache();
  applyChainFeedStreamDelta(eventFeedCache, delta);
  const projected = getChainEventFeedSnapshot(eventFeedCache);
  const record = projected.records.find((entry) => entry.feedId === delta.feedId) ?? null;
  if (!record) return false;

  let detail: HydratedChainEventDetail | null = null;
  const target = hydrationTargetFromDelta(delta);
  if (target) {
    detail = await withTimeout(
      hydrateChainEventDetail(target),
      EVENT_FEED_HYDRATION_TIMEOUT_MS,
      `feed delta detail ${delta.feedId}`,
    );
  }

  let event = record.event;
  const nextParticlesById = new Map<string, ParticleRecord>();
  const nextRegistry: ParticleDependencyRegistrySnapshot = {
    connectors: {},
    particles: {},
    features: {},
  };
  const searchByKind = createSearchMaps();

  if (!hydratedDetailMatchesScope(event, detail, scope)) {
    event = null;
  } else if (event?.type === "connector" && detail?.type === "connector") {
    event = mergeHydratedConnectorDetail(
      detail,
      event,
      nextParticlesById,
      nextRegistry,
      searchByKind,
    );
  } else if (
    event &&
    (event.type === "transformation" || event.type === "condition") &&
    detail &&
    (detail.type === "transformation" || detail.type === "condition")
  ) {
    event = mergeHydratedRuntimeCodeDetail(detail, event, searchByKind);
  }

  const incoming: ParticlePostCache = {
    loaded: true,
    feedRecordsById: new Map([
      [
        record.feedId,
        {
          ...record,
          event,
          visible: Boolean(event),
        },
      ],
    ]),
    events: event ? [event] : [],
    particlesById: nextParticlesById,
    registry: nextRegistry,
    searchable: searchableFromMaps(searchByKind),
    pagination: cache.pagination,
    stream: projected.stream,
  };
  cache = {
    ...mergeParticlePostCaches(cache, incoming),
    stream: {
      ...cache.stream,
      lastSeq:
        cache.stream.lastSeq === null
          ? delta.streamSeq
          : Math.max(cache.stream.lastSeq, delta.streamSeq),
    },
  };
  terminalSetCache.clear();
  return true;
};

export const createParticlePostDataStream = (options?: {
  includeRuntimeCode?: boolean;
  sourceAddresses?: string[];
  followedFormatHashes?: string[];
  feedPageLimit?: number;
  onUpdate?: () => void;
  onMeta?: (state: ChainEventFeedStreamState) => void;
  onStale?: () => void;
  onError?: (error: Error) => void;
}): ChainFeedStreamSubscription => {
  const scope = createEventFeedScope(options);
  return createChainFeedStream({
    sinceSeq: cache.stream.lastSeq ?? 0,
    limit: normalizeFeedPageLimit(options?.feedPageLimit),
    onDelta: (delta) => {
      void applyStreamDeltaToCache(delta, scope)
        .then((changed) => {
          if (changed) options?.onUpdate?.();
        })
        .catch((error) => {
          options?.onError?.(
            error instanceof Error ? error : new Error("Unable to apply chain feed delta."),
          );
        });
    },
    onMeta: (meta) => {
      applyStreamMetaToCache(meta);
      options?.onMeta?.({ ...cache.stream });
      if (meta.staleSinceSeq) options?.onStale?.();
    },
    onError: (error) => options?.onError?.(error),
  });
};

export const getParticlePostFeedState = () => ({
  pagination: { ...cache.pagination },
  stream: { ...cache.stream },
  hasMoreHistory: Boolean(cache.pagination.hasMore && cache.pagination.nextBefore),
});

export const loadMoreConnectorPostDataFromChain = loadMoreParticlePostDataFromChain;
export const createConnectorPostDataStream = createParticlePostDataStream;
export const getConnectorPostFeedState = getParticlePostFeedState;

export const syncParticlePostDataFromOwnedAccountSnapshotsForDebug = async (options?: {
  forceSources?: boolean;
  maxOwnedPerSource?: number;
  maxSources?: number;
  includeRuntimeCode?: boolean;
  includeDependencyExpansion?: boolean;
  sourceAddresses?: string[];
}) => {
  const requestedSourceAddresses = Array.from(
    new Set((options?.sourceAddresses ?? []).map(normalizeSourceAddress).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const next = await loadOwnedAccountSnapshotParticlePostCache({
    forceSources: Boolean(options?.forceSources),
    includeRuntimeCode: options?.includeRuntimeCode !== false,
    includeDependencyExpansion: options?.includeDependencyExpansion !== false,
    ...(requestedSourceAddresses.length > 0 ? { sourceAddresses: requestedSourceAddresses } : {}),
    ...(typeof options?.maxSources === "number" && Number.isFinite(options.maxSources)
      ? { maxSources: Math.max(1, Math.trunc(options.maxSources)) }
      : {}),
    ...(typeof options?.maxOwnedPerSource === "number" && Number.isFinite(options.maxOwnedPerSource)
      ? { maxOwnedPerSource: Math.max(1, Math.trunc(options.maxOwnedPerSource)) }
      : {}),
  });
  cache = next;
  cachedSourceAddresses =
    requestedSourceAddresses.length > 0 ? [...requestedSourceAddresses] : null;
  cachedFollowedFormatHashes = [];
  cachedMaxOwnedPerSource =
    typeof options?.maxOwnedPerSource === "number" && Number.isFinite(options.maxOwnedPerSource)
      ? Math.max(1, Math.trunc(options.maxOwnedPerSource))
      : null;
  cachedMaxSources =
    typeof options?.maxSources === "number" && Number.isFinite(options.maxSources)
      ? Math.max(1, Math.trunc(options.maxSources))
      : null;
  cachedIncludesRuntimeCode = options?.includeRuntimeCode !== false;
  cachedIncludesDependencyExpansion = options?.includeDependencyExpansion !== false;
  cachedFeedPageLimit = null;
  terminalSetCache.clear();
  return cache;
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

export const doesParticlePostCacheMatchFeedScope = (
  sourceAddresses: string[],
  followedFormatHashes: string[] = [],
): boolean => {
  if (!doesParticlePostCacheMatchSources(sourceAddresses)) return false;
  const normalizedFormatHashes = Array.from(
    new Set(followedFormatHashes.map(normalizeFormatHashForScope).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  if (cachedFollowedFormatHashes.length !== normalizedFormatHashes.length) return false;
  return cachedFollowedFormatHashes.every(
    (value, index) => value === normalizedFormatHashes[index],
  );
};

export const resetParticlePostDataCacheForDebug = () => {
  cache = emptyCache();
  loadPromise = null;
  loadPromiseKey = "";
  cachedSourceAddresses = null;
  cachedMaxOwnedPerSource = null;
  cachedMaxSources = null;
  cachedIncludesRuntimeCode = false;
  cachedIncludesDependencyExpansion = false;
  cachedFeedPageLimit = null;
  cachedFollowedFormatHashes = [];
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
