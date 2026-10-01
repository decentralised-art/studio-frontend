import {
  getChainFeedPage,
  type ChainFeedEventType,
  type ChainFeedItem,
} from "$lib/chain/eventFeedApi";
import type { LibraryItem } from "$lib/data/studioLibrary";
import { normalizeFeedSourceAddress } from "$lib/feed/feedSources";
import type { DeployedLibrary } from "$lib/studio/studioRegistryState";

export type StudioEventFeedLibraryOptions = {
  sourceAddresses: readonly string[];
  includeAllOwners?: boolean;
  pageLimit?: number;
  maxPages?: number;
  targetItems?: number;
  includeUnfinalized?: boolean;
};

export type StudioEventFeedLibraryDiscovery = {
  sourceAddresses: string[];
  library: DeployedLibrary;
  pageCount: number;
  rawItemCount: number;
  discoveredItemCount: number;
  hasMore: boolean;
  nextBefore: string | null;
};

type StudioFeedEntityKind = "feature" | "transformation" | "condition";

type StudioFeedEntity = {
  kind: StudioFeedEntityKind;
  name: string;
  owner: string;
  createdAt: number;
};

const EVENT_KIND_BY_TYPE: Record<ChainFeedEventType, StudioFeedEntityKind> = {
  connector_added: "feature",
  transformation_added: "transformation",
  condition_added: "condition",
};

const DEFAULT_PAGE_LIMIT = 256;
const DEFAULT_MAX_PAGES = 8;
const DEFAULT_TARGET_ITEMS = 240;

const normalizePositiveInteger = (
  value: number | undefined,
  fallback: number,
  min = 1,
  max = 1000,
): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
};

export const normalizeStudioEventFeedSourceAddresses = (
  sourceAddresses: readonly string[],
): string[] =>
  Array.from(
    new Set(sourceAddresses.map((address) => normalizeFeedSourceAddress(address)).filter(Boolean)),
  );

const resolveStudioFeedEntityKind = (item: ChainFeedItem): StudioFeedEntityKind | null => {
  const payloadType = item.payload.type.trim().toLowerCase();
  if (payloadType === "connector") return "feature";
  if (payloadType === "transformation" || payloadType === "condition") return payloadType;
  return EVENT_KIND_BY_TYPE[item.eventType as ChainFeedEventType] ?? null;
};

const libraryIdForEntity = (kind: StudioFeedEntityKind, name: string): string => {
  if (kind === "feature") return `feature-${name}`;
  if (kind === "transformation") return `transform-${name}`;
  return `condition-${name}`;
};

const entityKey = (kind: StudioFeedEntityKind, name: string): string => `${kind}:${name}`;

const mapEntityToLibraryItem = (entity: StudioFeedEntity): LibraryItem => ({
  id: libraryIdForEntity(entity.kind, entity.name),
  name: entity.name,
  kind: entity.kind,
  authorId: entity.owner,
  summary: "Discovered from chain feed.",
});

const compareEntityNewestFirst = (a: StudioFeedEntity, b: StudioFeedEntity): number => {
  const byCreatedAt = b.createdAt - a.createdAt;
  if (byCreatedAt !== 0) return byCreatedAt;
  return a.name.localeCompare(b.name);
};

const processFeedItem = (
  item: ChainFeedItem,
  sourceSet: ReadonlySet<string>,
  includeAllOwners: boolean,
  seenKeys: Set<string>,
  entities: Map<string, StudioFeedEntity>,
) => {
  const owner = normalizeFeedSourceAddress(item.payload.owner);
  if (!owner || (!includeAllOwners && !sourceSet.has(owner))) return;

  const kind = resolveStudioFeedEntityKind(item);
  if (!kind) return;

  const name = item.payload.name.trim();
  if (!name) return;

  const key = entityKey(kind, name);
  if (seenKeys.has(key)) return;
  seenKeys.add(key);

  if (!item.visible || item.status === "removed") return;

  entities.set(key, {
    kind,
    name,
    owner,
    createdAt: item.createdAtMs,
  });
};

export const loadStudioNetworkLibraryFromEventFeed = async (
  options: StudioEventFeedLibraryOptions,
): Promise<StudioEventFeedLibraryDiscovery> => {
  const sourceAddresses = normalizeStudioEventFeedSourceAddresses(options.sourceAddresses);
  const sourceSet = new Set(sourceAddresses);
  const pageLimit = normalizePositiveInteger(options.pageLimit, DEFAULT_PAGE_LIMIT);
  const maxPages = normalizePositiveInteger(options.maxPages, DEFAULT_MAX_PAGES);
  const targetItems = normalizePositiveInteger(options.targetItems, DEFAULT_TARGET_ITEMS);

  const entities = new Map<string, StudioFeedEntity>();
  const seenKeys = new Set<string>();
  let pageCount = 0;
  let rawItemCount = 0;
  let before: string | null = null;
  let hasMore = false;
  let nextBefore: string | null = null;

  if (sourceAddresses.length === 0 && !options.includeAllOwners) {
    return {
      sourceAddresses,
      library: { features: [], transformations: [], conditions: [] },
      pageCount: 0,
      rawItemCount: 0,
      discoveredItemCount: 0,
      hasMore: false,
      nextBefore: null,
    };
  }

  for (let index = 0; index < maxPages; index += 1) {
    const page = await getChainFeedPage({
      limit: pageLimit,
      before,
      includeUnfinalized: options.includeUnfinalized ?? true,
    });
    pageCount += 1;
    rawItemCount += page.items.length;

    page.items.forEach((item) =>
      processFeedItem(item, sourceSet, Boolean(options.includeAllOwners), seenKeys, entities),
    );

    hasMore = page.hasMore;
    nextBefore = page.nextBefore;
    if (!page.hasMore || !page.nextBefore || entities.size >= targetItems) break;
    before = page.nextBefore;
  }

  const libraryItems = Array.from(entities.values()).sort(compareEntityNewestFirst);
  return {
    sourceAddresses,
    library: {
      features: libraryItems
        .filter((entity) => entity.kind === "feature")
        .map(mapEntityToLibraryItem),
      transformations: libraryItems
        .filter((entity) => entity.kind === "transformation")
        .map(mapEntityToLibraryItem),
      conditions: libraryItems
        .filter((entity) => entity.kind === "condition")
        .map(mapEntityToLibraryItem),
    },
    pageCount,
    rawItemCount,
    discoveredItemCount: libraryItems.length,
    hasMore,
    nextBefore,
  };
};
