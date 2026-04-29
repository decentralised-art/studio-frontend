import type {
  ChainFeedItem,
  ChainFeedPage,
  ChainFeedStreamDelta,
  ChainFeedStreamMeta,
} from "$lib/chain/eventFeedApi";
import type {
  ConnectorPostEvent,
  NetworkFeedEvent,
  ParticleRecord,
  RuntimeCodePostEvent,
} from "$lib/feed/particlePostData";

type ChainEventProjectedEvent = ConnectorPostEvent | RuntimeCodePostEvent;

export type ChainEventFeedSearchEntity = {
  id: string;
  label: string;
  summary: string;
  authorId: string;
};

export type ChainEventFeedSearchEntities = {
  connectors: ChainEventFeedSearchEntity[];
  transformations: ChainEventFeedSearchEntity[];
  conditions: ChainEventFeedSearchEntity[];
};

export type ChainEventFeedRecord = {
  feedId: string;
  eventType: string;
  status: string;
  visible: boolean;
  historyCursor: string;
  streamSeq: number | null;
  event: ChainEventProjectedEvent | null;
};

export type ChainEventFeedPaginationState = {
  limit: number | null;
  hasMore: boolean;
  nextBefore: string | null;
};

export type ChainEventFeedStreamState = {
  lastSeq: number | null;
  requestedSinceSeq: number | null;
  minAvailableSeq: number | null;
  replayFloorSeq: number | null;
  staleSinceSeq: boolean;
};

export type ChainEventFeedSnapshot = {
  records: ChainEventFeedRecord[];
  events: NetworkFeedEvent[];
  connectorRecords: ParticleRecord[];
  searchable: ChainEventFeedSearchEntities;
  pagination: ChainEventFeedPaginationState;
  stream: ChainEventFeedStreamState;
};

export type ChainEventFeedCache = {
  recordsByFeedId: Map<string, ChainEventFeedRecord>;
  connectorRecordsById: Map<string, ParticleRecord>;
  searchableByKind: {
    connectors: Map<string, ChainEventFeedSearchEntity>;
    transformations: Map<string, ChainEventFeedSearchEntity>;
    conditions: Map<string, ChainEventFeedSearchEntity>;
  };
  pagination: ChainEventFeedPaginationState;
  stream: ChainEventFeedStreamState;
};

type RenderableFeedKind = "connector" | "transformation" | "condition";

export class ChainEventFeedProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChainEventFeedProjectionError";
  }
}

const CHAIN_ADDRESS_RE = /^0x[a-f0-9]{40}$/i;

const EVENT_KIND_BY_EVENT_TYPE: Record<string, RenderableFeedKind> = {
  connector_added: "connector",
  transformation_added: "transformation",
  condition_added: "condition",
};

export const createChainEventFeedCache = (): ChainEventFeedCache => ({
  recordsByFeedId: new Map(),
  connectorRecordsById: new Map(),
  searchableByKind: {
    connectors: new Map(),
    transformations: new Map(),
    conditions: new Map(),
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
});

const normalizeAddress = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  if (!CHAIN_ADDRESS_RE.test(normalized)) {
    throw new ChainEventFeedProjectionError("Feed owner must be a 0x-prefixed Ethereum address.");
  }
  return normalized;
};

const normalizeString = (value: string, field: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ChainEventFeedProjectionError(`${field} must not be empty.`);
  }
  return trimmed;
};

const compareNewestFirst = (
  a: { createdAt: number; id: string },
  b: { createdAt: number; id: string },
) => {
  const byCreatedAt = b.createdAt - a.createdAt;
  if (byCreatedAt !== 0) return byCreatedAt;
  return b.id.localeCompare(a.id);
};

const searchSort = (a: ChainEventFeedSearchEntity, b: ChainEventFeedSearchEntity) => {
  const byLabel = a.label.localeCompare(b.label);
  if (byLabel !== 0) return byLabel;
  return a.id.localeCompare(b.id);
};

const resolveFeedKind = (eventType: string): RenderableFeedKind | null =>
  EVENT_KIND_BY_EVENT_TYPE[eventType.trim().toLowerCase()] ?? null;

const createConnectorEvent = (feedId: string, item: ChainFeedItem): ConnectorPostEvent => {
  const name = normalizeString(item.payload.name, "payload.name");
  return {
    type: "connector",
    id: `event-connector-created-${feedId}`,
    authorId: normalizeAddress(item.payload.owner),
    createdAt: item.createdAtMs,
    createdLabel: "",
    particleId: name,
    particleLabel: name,
    usedParticleIds: [],
    usedParticleLabels: [],
    createdNodeIds: [],
    reusedNodeIds: [],
    focusNodeIds: [],
  };
};

const createRuntimeCodeEvent = (
  kind: "transformation" | "condition",
  feedId: string,
  item: ChainFeedItem,
): RuntimeCodePostEvent => {
  const name = normalizeString(item.payload.name, "payload.name");
  return {
    type: kind,
    id: `event-${kind}-created-${feedId}`,
    authorId: normalizeAddress(item.payload.owner),
    createdAt: item.createdAtMs,
    createdLabel: "",
    elementId: name,
    elementLabel: name,
    runtimeSnippet: "",
  };
};

const streamDeltaToFeedItem = (delta: ChainFeedStreamDelta): ChainFeedItem => ({
  feedId: delta.feedId,
  eventType: delta.eventType,
  status: delta.status,
  visible: delta.status !== "removed",
  txHash: "",
  blockNumber: 0,
  txIndex: 0,
  logIndex: 0,
  historyCursor: delta.historyCursor,
  createdAtMs: delta.createdAtMs,
  updatedAtMs: delta.createdAtMs,
  projectorVersion: 0,
  payload: {
    type: delta.payload.type,
    name: delta.payload.name,
    owner: delta.payload.owner,
  },
});

export const mapChainFeedItemToNetworkFeedEvent = (
  item: ChainFeedItem,
): ChainEventProjectedEvent | null => {
  if (!item.visible || item.status === "removed") return null;
  const feedId = normalizeString(item.feedId, "feedId");
  const kind = resolveFeedKind(item.eventType);
  if (!kind) return null;
  if (kind === "connector") return createConnectorEvent(feedId, item);
  return createRuntimeCodeEvent(kind, feedId, item);
};

const removeProjectedEntity = (
  cache: ChainEventFeedCache,
  event: ChainEventProjectedEvent | null,
) => {
  if (!event) return;
  if (event.type === "connector") {
    cache.connectorRecordsById.delete(event.particleId);
    cache.searchableByKind.connectors.delete(`connector:${event.particleId}`);
    return;
  }
  cache.searchableByKind[`${event.type}s`].delete(`${event.type}:${event.elementId}`);
};

const upsertProjectedEntity = (
  cache: ChainEventFeedCache,
  event: ChainEventProjectedEvent | null,
) => {
  if (!event) return;
  if (event.type === "connector") {
    cache.connectorRecordsById.set(event.particleId, {
      id: event.particleId,
      name: event.particleLabel,
      summary: "",
      authorId: event.authorId,
      createdAt: event.createdAt,
      createdLabel: event.createdLabel,
      dependencies: [...event.usedParticleIds],
    });
    cache.searchableByKind.connectors.set(`connector:${event.particleId}`, {
      id: event.particleId,
      label: event.particleLabel,
      summary: "",
      authorId: event.authorId,
    });
    return;
  }
  cache.searchableByKind[`${event.type}s`].set(`${event.type}:${event.elementId}`, {
    id: event.elementId,
    label: event.elementLabel,
    summary: "",
    authorId: event.authorId,
  });
};

const upsertRecord = (
  cache: ChainEventFeedCache,
  item: ChainFeedItem,
  streamSeq: number | null,
): ChainEventFeedRecord | null => {
  const feedId = normalizeString(item.feedId, "feedId");
  const previous = cache.recordsByFeedId.get(feedId) ?? null;
  if (previous) removeProjectedEntity(cache, previous.event);

  const event = mapChainFeedItemToNetworkFeedEvent(item);
  const visible = Boolean(event);
  const record: ChainEventFeedRecord = {
    feedId,
    eventType: item.eventType,
    status: item.status,
    visible,
    historyCursor: item.historyCursor,
    streamSeq,
    event,
  };
  cache.recordsByFeedId.set(feedId, record);
  upsertProjectedEntity(cache, event);
  return record;
};

export const applyChainFeedPage = (
  cache: ChainEventFeedCache,
  page: ChainFeedPage,
): ChainEventFeedSnapshot => {
  cache.pagination = {
    limit: page.limit,
    hasMore: page.hasMore,
    nextBefore: page.nextBefore,
  };
  page.items.forEach((item) => upsertRecord(cache, item, null));
  return getChainEventFeedSnapshot(cache);
};

export const applyChainFeedStreamDelta = (
  cache: ChainEventFeedCache,
  delta: ChainFeedStreamDelta,
): ChainEventFeedSnapshot => {
  upsertRecord(cache, streamDeltaToFeedItem(delta), delta.streamSeq);
  cache.stream = {
    ...cache.stream,
    lastSeq:
      cache.stream.lastSeq === null
        ? delta.streamSeq
        : Math.max(cache.stream.lastSeq, delta.streamSeq),
  };
  return getChainEventFeedSnapshot(cache);
};

export const applyChainFeedStreamMeta = (
  cache: ChainEventFeedCache,
  meta: ChainFeedStreamMeta,
): ChainEventFeedSnapshot => {
  cache.stream = {
    lastSeq: meta.lastSeq,
    requestedSinceSeq: meta.requestedSinceSeq,
    minAvailableSeq: meta.minAvailableSeq,
    replayFloorSeq: meta.replayFloorSeq,
    staleSinceSeq: meta.staleSinceSeq,
  };
  return getChainEventFeedSnapshot(cache);
};

export const listChainEventFeedEvents = (cache: ChainEventFeedCache): NetworkFeedEvent[] =>
  Array.from(cache.recordsByFeedId.values())
    .map((record) => record.event)
    .filter((event): event is ChainEventProjectedEvent => Boolean(event))
    .sort(compareNewestFirst);

export const listChainEventConnectorRecords = (cache: ChainEventFeedCache): ParticleRecord[] =>
  Array.from(cache.connectorRecordsById.values()).sort(compareNewestFirst);

export const listChainEventSearchEntities = (
  cache: ChainEventFeedCache,
): ChainEventFeedSearchEntities => ({
  connectors: Array.from(cache.searchableByKind.connectors.values()).sort(searchSort),
  transformations: Array.from(cache.searchableByKind.transformations.values()).sort(searchSort),
  conditions: Array.from(cache.searchableByKind.conditions.values()).sort(searchSort),
});

export const getChainEventFeedSnapshot = (cache: ChainEventFeedCache): ChainEventFeedSnapshot => ({
  records: Array.from(cache.recordsByFeedId.values()).sort(
    (a, b) =>
      (b.event?.createdAt ?? 0) - (a.event?.createdAt ?? 0) || b.feedId.localeCompare(a.feedId),
  ),
  events: listChainEventFeedEvents(cache),
  connectorRecords: listChainEventConnectorRecords(cache),
  searchable: listChainEventSearchEntities(cache),
  pagination: { ...cache.pagination },
  stream: { ...cache.stream },
});
