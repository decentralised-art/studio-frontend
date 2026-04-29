import {
  getConnectorPostFeedState,
  listNetworkFeedEventsByAuthor,
  loadMoreConnectorPostDataFromChain,
  syncParticlePostDataFromChain as syncConnectorPostDataFromChain,
  type NetworkFeedEvent,
} from "$lib/feed/particlePostData";

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
}): Promise<NetworkFeedEvent[]> => {
  const sourceAddresses = normalizeProfileActivitySourceAddresses(options.sourceAddresses);
  if (sourceAddresses.length === 0) return [];

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

  return events;
};
