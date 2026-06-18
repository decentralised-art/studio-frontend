import type { ExploreParticle } from "$lib/data/exploreParticles";
import type { LibraryItem } from "$lib/data/studioLibrary";
import {
  getConnectorPostFeedState,
  listNetworkFeedEventsByAuthor,
  loadMoreConnectorPostDataFromChain,
  syncParticlePostDataFromChain as syncConnectorPostDataFromChain,
  type ConnectorPostEvent,
  type NetworkFeedEvent,
  type RuntimeCodePostEvent,
} from "$lib/feed/particlePostData";
import { fetchChainOwnedStudioSnapshot } from "$lib/studio/chainStudioAdapter";

const ETH_ADDRESS_RE = /^0x[0-9a-f]{40}$/;
const PROFILE_ACTIVITY_FEED_PAGE_LIMIT = 128;
const PROFILE_ACTIVITY_MIN_VISIBLE_EVENTS = 20;
const PROFILE_ACTIVITY_MAX_HISTORY_PAGES = 20;

const normalizeSourceAddress = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  const withPrefix = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return ETH_ADDRESS_RE.test(withPrefix) ? withPrefix : "";
};

const compareFeedEventsNewestFirst = (
  a: { createdAt: number; id: string },
  b: { createdAt: number; id: string },
): number => {
  const byCreatedAt = b.createdAt - a.createdAt;
  if (byCreatedAt !== 0) return byCreatedAt;
  return b.id.localeCompare(a.id);
};

const normalizeCreatedAt = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const eventEntityKey = (event: NetworkFeedEvent): string => {
  switch (event.type) {
    case "connector":
      return `connector:${event.particleId}`;
    case "transformation":
    case "condition":
      return `${event.type}:${event.elementId}`;
    case "format":
      return `format:${event.formatId}`;
  }
};

const mergeProfileActivityEvents = (
  primaryEvents: NetworkFeedEvent[],
  backfillEvents: NetworkFeedEvent[],
): NetworkFeedEvent[] => {
  const eventsByEntity = new Map<string, NetworkFeedEvent>();
  backfillEvents.forEach((event) => {
    eventsByEntity.set(eventEntityKey(event), event);
  });
  primaryEvents.forEach((event) => {
    eventsByEntity.set(eventEntityKey(event), event);
  });
  return Array.from(eventsByEntity.values()).sort(compareFeedEventsNewestFirst);
};

const createSnapshotConnectorEvent = (particle: ExploreParticle): ConnectorPostEvent | null => {
  const particleId = particle.id.trim();
  if (!particleId) return null;
  const authorId = normalizeSourceAddress(particle.authorId);
  if (!authorId) return null;
  const dependencies = particle.dependencies.map((value) => value.trim()).filter(Boolean);
  return {
    type: "connector",
    id: `event-profile-snapshot-connector-${particleId}`,
    authorId,
    createdAt: normalizeCreatedAt(particle.createdAt),
    createdLabel: particle.createdLabel,
    particleId,
    particleLabel: particle.name.trim() || particleId,
    ...(particle.formatHash ? { formatHash: particle.formatHash } : {}),
    usedParticleIds: dependencies,
    usedParticleLabels: [...dependencies],
    createdNodeIds: [],
    reusedNodeIds: [],
    focusNodeIds: [],
  };
};

const normalizeRuntimeElementId = (item: LibraryItem): string => {
  if (item.kind === "transformation") return item.id.replace(/^transform-/, "").trim();
  if (item.kind === "condition") return item.id.replace(/^condition-/, "").trim();
  return item.id.trim();
};

const createSnapshotRuntimeEvent = (item: LibraryItem): RuntimeCodePostEvent | null => {
  if (item.kind !== "transformation" && item.kind !== "condition") return null;
  const elementId = normalizeRuntimeElementId(item) || item.name.trim();
  if (!elementId) return null;
  const authorId = normalizeSourceAddress(item.authorId);
  if (!authorId) return null;
  const runtimeSnippet = item.runtimeSnippet?.trim() || item.summary?.trim() || "";
  return {
    type: item.kind,
    id: `event-profile-snapshot-${item.kind}-${elementId}`,
    authorId,
    createdAt: 0,
    createdLabel: "",
    elementId,
    elementLabel: item.name.trim() || elementId,
    runtimeSnippet,
  };
};

const listOwnedSnapshotActivityEvents = async (
  sourceAddresses: string[],
): Promise<NetworkFeedEvent[]> => {
  const snapshotResults = await Promise.allSettled(
    sourceAddresses.map((sourceAddress) =>
      fetchChainOwnedStudioSnapshot(sourceAddress, {
        authorId: sourceAddress,
        includeRuntimeCode: true,
      }),
    ),
  );
  const snapshots = snapshotResults
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  return snapshots
    .flatMap((snapshot) => [
      ...snapshot.particles
        .map(createSnapshotConnectorEvent)
        .filter((event): event is ConnectorPostEvent => Boolean(event)),
      ...snapshot.library.transformations
        .map(createSnapshotRuntimeEvent)
        .filter((event): event is RuntimeCodePostEvent => Boolean(event)),
      ...snapshot.library.conditions
        .map(createSnapshotRuntimeEvent)
        .filter((event): event is RuntimeCodePostEvent => Boolean(event)),
    ])
    .sort(compareFeedEventsNewestFirst);
};

export const normalizeProfileActivitySourceAddresses = (sourceAddresses: string[]): string[] =>
  Array.from(new Set(sourceAddresses.map(normalizeSourceAddress).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );

export const listProfileActivityEvents = (sourceAddresses: string[]): NetworkFeedEvent[] => {
  const eventsById = new Map<string, NetworkFeedEvent>();
  normalizeProfileActivitySourceAddresses(sourceAddresses).forEach((sourceAddress) => {
    listNetworkFeedEventsByAuthor(sourceAddress).forEach((event) => {
      eventsById.set(event.id, event);
    });
  });
  return Array.from(eventsById.values()).sort(compareFeedEventsNewestFirst);
};

export const syncProfileActivityFromEventFeed = async (options: {
  sourceAddresses: string[];
  minVisibleEvents?: number;
  maxHistoryPages?: number;
  feedPageLimit?: number;
  includeOwnedSnapshotBackfill?: boolean;
}): Promise<NetworkFeedEvent[]> => {
  const sourceAddresses = normalizeProfileActivitySourceAddresses(options.sourceAddresses);
  if (sourceAddresses.length === 0) return [];
  const includeOwnedSnapshotBackfill = options.includeOwnedSnapshotBackfill !== false;

  const minVisibleEvents =
    typeof options.minVisibleEvents === "number" && Number.isFinite(options.minVisibleEvents)
      ? Math.max(1, Math.trunc(options.minVisibleEvents))
      : PROFILE_ACTIVITY_MIN_VISIBLE_EVENTS;
  const maxHistoryPages =
    typeof options.maxHistoryPages === "number" && Number.isFinite(options.maxHistoryPages)
      ? Math.max(1, Math.trunc(options.maxHistoryPages))
      : PROFILE_ACTIVITY_MAX_HISTORY_PAGES;
  const feedPageLimit =
    typeof options.feedPageLimit === "number" && Number.isFinite(options.feedPageLimit)
      ? Math.max(1, Math.trunc(options.feedPageLimit))
      : PROFILE_ACTIVITY_FEED_PAGE_LIMIT;
  const syncOptions = {
    sourceAddresses,
    includeRuntimeCode: true,
    includeDependencyExpansion: false,
    feedPageLimit,
  };

  await syncConnectorPostDataFromChain({
    ...syncOptions,
    force: true,
  });

  let events = listProfileActivityEvents(sourceAddresses);
  let pagesLoaded = 1;
  while (
    events.length < minVisibleEvents &&
    getConnectorPostFeedState().hasMoreHistory &&
    pagesLoaded < maxHistoryPages
  ) {
    await loadMoreConnectorPostDataFromChain(syncOptions);
    pagesLoaded += 1;
    events = listProfileActivityEvents(sourceAddresses);
  }

  if (!includeOwnedSnapshotBackfill) return events;

  // Explicit profile pages must be complete; /feed remains the primary timestamp source.
  const backfillEvents = await listOwnedSnapshotActivityEvents(sourceAddresses);
  return mergeProfileActivityEvents(events, backfillEvents);
};
