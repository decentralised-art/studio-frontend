import { createDcnClient, isDcnApiError } from "$lib/chain/dcnClient";
import { ChainApiRequestError } from "$lib/chain/registryApi";

export const CHAIN_FEED_EVENT_TYPES = [
  "connector_added",
  "transformation_added",
  "condition_added",
] as const;

export type ChainFeedEventType = (typeof CHAIN_FEED_EVENT_TYPES)[number];

export const CHAIN_FEED_STATUSES = ["observed", "safe", "finalized", "removed"] as const;

export type ChainFeedStatus = (typeof CHAIN_FEED_STATUSES)[number];

export type ChainFeedEntityType = "connector" | "transformation" | "condition";

export type RawChainFeedPayload = {
  type?: unknown;
  name?: unknown;
  owner?: unknown;
};

export type RawChainFeedCursor = {
  has_more?: unknown;
  next_before?: unknown;
};

export type RawChainFeedItem = {
  feed_id?: unknown;
  event_type?: unknown;
  status?: unknown;
  visible?: unknown;
  tx_hash?: unknown;
  block_number?: unknown;
  tx_index?: unknown;
  log_index?: unknown;
  history_cursor?: unknown;
  created_at_ms?: unknown;
  updated_at_ms?: unknown;
  projector_version?: unknown;
  payload?: unknown;
};

export type RawChainFeedPageResponse = {
  limit?: unknown;
  cursor?: unknown;
  items?: unknown;
};

export type RawChainFeedStreamDelta = {
  stream_seq?: unknown;
  event_type?: unknown;
  status?: unknown;
  feed_id?: unknown;
  history_cursor?: unknown;
  created_at_ms?: unknown;
  payload?: unknown;
};

export type RawChainFeedStreamMeta = {
  has_more?: unknown;
  last_seq?: unknown;
  requested_since_seq?: unknown;
  min_available_seq?: unknown;
  replay_floor_seq?: unknown;
  stale_since_seq?: unknown;
};

export type ChainFeedPayload = {
  type: ChainFeedEntityType | string;
  name: string;
  owner: string;
};

export type ChainFeedItem = {
  feedId: string;
  eventType: ChainFeedEventType | string;
  status: ChainFeedStatus | string;
  visible: boolean;
  txHash: string;
  blockNumber: number;
  txIndex: number;
  logIndex: number;
  historyCursor: string;
  createdAtMs: number;
  updatedAtMs: number;
  projectorVersion: number;
  payload: ChainFeedPayload;
};

export type ChainFeedPage = {
  limit: number;
  hasMore: boolean;
  nextBefore: string | null;
  items: ChainFeedItem[];
};

export type ChainFeedStreamDelta = {
  streamSeq: number;
  eventType: ChainFeedEventType | string;
  status: ChainFeedStatus | string;
  feedId: string;
  historyCursor: string;
  createdAtMs: number;
  payload: ChainFeedPayload;
};

export type ChainFeedStreamMeta = {
  hasMore: boolean;
  lastSeq: number | null;
  requestedSinceSeq: number;
  minAvailableSeq: number;
  replayFloorSeq: number;
  staleSinceSeq: boolean;
};

export type GetChainFeedPageOptions = {
  limit: number;
  before?: string | null;
  type?: ChainFeedEventType | string | null;
  includeUnfinalized?: boolean;
};

export type CreateChainFeedStreamOptions = {
  sinceSeq: number;
  limit: number;
  onDelta: (delta: ChainFeedStreamDelta, event: MessageEvent<string>) => void;
  onMeta?: (meta: ChainFeedStreamMeta, event: MessageEvent<string>) => void;
  onError?: (error: Error, event?: Event | MessageEvent<string>) => void;
};

export type ChainFeedStreamSubscription = {
  close: () => void;
  url: string;
};

export class ChainFeedValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChainFeedValidationError";
  }
}

const STREAM_RECONNECT_BASE_DELAY_MS = 1_000;
const STREAM_RECONNECT_MAX_DELAY_MS = 15_000;

const ENTITY_TYPE_BY_EVENT_TYPE: Record<ChainFeedEventType, ChainFeedEntityType> = {
  connector_added: "connector",
  transformation_added: "transformation",
  condition_added: "condition",
};

const CHAIN_ADDRESS_RE = /^0x[a-f0-9]{40}$/i;

const looksLikeHtmlPayload = (value: string) =>
  /<\s*html[\s>]/i.test(value) || /<!doctype html>/i.test(value);

const gatewayErrorMessage = (status?: number) => {
  if (status === 502) return "Chain API is temporarily unavailable (502 Bad Gateway).";
  if (status === 503) return "Chain API is temporarily unavailable (503 Service Unavailable).";
  if (status === 504) return "Chain API timed out (504 Gateway Timeout).";
  return null;
};

const errorMessage = (payload: unknown, status?: number) => {
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) return status ? `Request failed (HTTP ${status}).` : "Request failed.";

    if (looksLikeHtmlPayload(trimmed)) {
      const explicitGateway = gatewayErrorMessage(status);
      if (explicitGateway) return explicitGateway;
      if (/502\s+bad gateway/i.test(trimmed)) {
        return "Chain API is temporarily unavailable (502 Bad Gateway).";
      }
      if (/503\s+service unavailable/i.test(trimmed)) {
        return "Chain API is temporarily unavailable (503 Service Unavailable).";
      }
      if (/504\s+gateway timeout/i.test(trimmed)) {
        return "Chain API timed out (504 Gateway Timeout).";
      }
      return status ? `Chain API request failed (HTTP ${status}).` : "Chain API request failed.";
    }

    return trimmed;
  }

  if (payload && typeof payload === "object") {
    const rec = payload as Record<string, unknown>;
    const message = rec.message ?? rec.error ?? rec.detail ?? rec.reason;
    if (typeof message === "string") return message;
  }
  return status ? `Request failed (HTTP ${status}).` : "Request failed.";
};

const normalizeRequestLimit = (value: unknown, field: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new ChainFeedValidationError(`${field} must be a positive integer.`);
  }
  return parsed;
};

const normalizeRequestSeq = (value: unknown, field: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    throw new ChainFeedValidationError(`${field} must be an integer >= 0.`);
  }
  return parsed;
};

const normalizeOptionalToken = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeRequiredString = (value: unknown, field: string): string => {
  if (typeof value !== "string") {
    throw new ChainFeedValidationError(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ChainFeedValidationError(`${field} must not be empty.`);
  }
  return trimmed;
};

const normalizeLowerString = (value: unknown, field: string): string =>
  normalizeRequiredString(value, field).toLowerCase();

const normalizeBoolean = (value: unknown, field: string): boolean => {
  if (typeof value !== "boolean") {
    throw new ChainFeedValidationError(`${field} must be a boolean.`);
  }
  return value;
};

const normalizeInteger = (value: unknown, field: string, min = 0): number => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
    throw new ChainFeedValidationError(`${field} must be an integer >= ${min}.`);
  }
  return value;
};

const normalizeNullableInteger = (value: unknown, field: string, min = 0): number | null => {
  if (value === null) return null;
  return normalizeInteger(value, field, min);
};

const normalizeOwnerAddress = (value: unknown, field: string): string => {
  const owner = normalizeRequiredString(value, field).toLowerCase();
  if (!CHAIN_ADDRESS_RE.test(owner)) {
    throw new ChainFeedValidationError(`${field} must be a 0x-prefixed Ethereum address.`);
  }
  return owner;
};

const isKnownEventType = (eventType: string): eventType is ChainFeedEventType =>
  (CHAIN_FEED_EVENT_TYPES as readonly string[]).includes(eventType);

const inferPayloadType = (
  eventType: ChainFeedEventType | string,
  payloadType: unknown,
): ChainFeedEntityType | string => {
  if (payloadType !== undefined && payloadType !== null) {
    return normalizeLowerString(payloadType, "payload.type");
  }
  if (isKnownEventType(eventType)) return ENTITY_TYPE_BY_EVENT_TYPE[eventType];
  throw new ChainFeedValidationError("payload.type is required for unknown event types.");
};

const normalizePayload = (
  value: unknown,
  eventType: ChainFeedEventType | string,
): ChainFeedPayload => {
  if (!value || typeof value !== "object") {
    throw new ChainFeedValidationError("payload must be an object.");
  }
  const raw = value as RawChainFeedPayload;
  return {
    type: inferPayloadType(eventType, raw.type),
    name: normalizeRequiredString(raw.name, "payload.name"),
    owner: normalizeOwnerAddress(raw.owner, "payload.owner"),
  };
};

export const normalizeChainFeedItem = (value: unknown): ChainFeedItem => {
  if (!value || typeof value !== "object") {
    throw new ChainFeedValidationError("feed item must be an object.");
  }
  const raw = value as RawChainFeedItem;
  const eventType = normalizeLowerString(raw.event_type, "event_type");
  return {
    feedId: normalizeRequiredString(raw.feed_id, "feed_id"),
    eventType,
    status: normalizeLowerString(raw.status, "status"),
    visible: normalizeBoolean(raw.visible, "visible"),
    txHash: normalizeRequiredString(raw.tx_hash, "tx_hash"),
    blockNumber: normalizeInteger(raw.block_number, "block_number"),
    txIndex: normalizeInteger(raw.tx_index, "tx_index"),
    logIndex: normalizeInteger(raw.log_index, "log_index"),
    historyCursor: normalizeRequiredString(raw.history_cursor, "history_cursor"),
    createdAtMs: normalizeInteger(raw.created_at_ms, "created_at_ms"),
    updatedAtMs: normalizeInteger(raw.updated_at_ms, "updated_at_ms"),
    projectorVersion: normalizeInteger(raw.projector_version, "projector_version"),
    payload: normalizePayload(raw.payload, eventType),
  };
};

export const normalizeChainFeedPage = (payload: unknown): ChainFeedPage => {
  if (!payload || typeof payload !== "object") {
    throw new ChainFeedValidationError("feed page response must be an object.");
  }
  const raw = payload as RawChainFeedPageResponse;
  if (!raw.cursor || typeof raw.cursor !== "object") {
    throw new ChainFeedValidationError("cursor must be an object.");
  }
  const cursor = raw.cursor as RawChainFeedCursor;
  if (!Array.isArray(raw.items)) {
    throw new ChainFeedValidationError("items must be an array.");
  }
  return {
    limit: normalizeInteger(raw.limit, "limit", 1),
    hasMore: normalizeBoolean(cursor.has_more, "cursor.has_more"),
    nextBefore: normalizeOptionalToken(cursor.next_before),
    items: raw.items.map((item) => normalizeChainFeedItem(item)),
  };
};

export const normalizeChainFeedStreamDelta = (payload: unknown): ChainFeedStreamDelta => {
  if (!payload || typeof payload !== "object") {
    throw new ChainFeedValidationError("feed stream delta must be an object.");
  }
  const raw = payload as RawChainFeedStreamDelta;
  const eventType = normalizeLowerString(raw.event_type, "event_type");
  return {
    streamSeq: normalizeInteger(raw.stream_seq, "stream_seq", 0),
    eventType,
    status: normalizeLowerString(raw.status, "status"),
    feedId: normalizeRequiredString(raw.feed_id, "feed_id"),
    historyCursor: normalizeRequiredString(raw.history_cursor, "history_cursor"),
    createdAtMs: normalizeInteger(raw.created_at_ms, "created_at_ms"),
    payload: normalizePayload(raw.payload, eventType),
  };
};

export const normalizeChainFeedStreamMeta = (payload: unknown): ChainFeedStreamMeta => {
  if (!payload || typeof payload !== "object") {
    throw new ChainFeedValidationError("feed stream meta must be an object.");
  }
  const raw = payload as RawChainFeedStreamMeta;
  return {
    hasMore: normalizeBoolean(raw.has_more, "has_more"),
    lastSeq: normalizeNullableInteger(raw.last_seq, "last_seq", 0),
    requestedSinceSeq: normalizeInteger(raw.requested_since_seq, "requested_since_seq", 0),
    minAvailableSeq: normalizeInteger(raw.min_available_seq, "min_available_seq", 0),
    replayFloorSeq: normalizeInteger(raw.replay_floor_seq, "replay_floor_seq", 0),
    staleSinceSeq: normalizeBoolean(raw.stale_since_seq, "stale_since_seq"),
  };
};

const parseJsonFrame = (data: string, frameName: string): unknown => {
  try {
    return JSON.parse(data);
  } catch (error) {
    throw new ChainFeedValidationError(
      `${frameName} must contain valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

export const parseChainFeedStreamDeltaData = (data: string): ChainFeedStreamDelta =>
  normalizeChainFeedStreamDelta(parseJsonFrame(data, "feed stream delta"));

export const parseChainFeedStreamMetaData = (data: string): ChainFeedStreamMeta =>
  normalizeChainFeedStreamMeta(parseJsonFrame(data, "feed stream meta"));

export const getChainFeedPage = async (
  options: GetChainFeedPageOptions,
): Promise<ChainFeedPage> => {
  const limit = normalizeRequestLimit(options.limit, "limit");
  const before = normalizeOptionalToken(options.before);
  const type = normalizeOptionalToken(options.type);

  try {
    const payload = await createDcnClient().feed({
      limit,
      before: before ?? undefined,
      type: type ? (type.toLowerCase() as ChainFeedEventType) : undefined,
      includeUnfinalized: options.includeUnfinalized,
    });
    return normalizeChainFeedPage(payload);
  } catch (error) {
    if (isDcnApiError(error)) {
      throw new ChainApiRequestError(
        errorMessage(error.body, error.status),
        error.status,
        error.body,
      );
    }
    throw error;
  }
};

const dispatchSseEvent = (
  eventType: string,
  data: string,
  options: CreateChainFeedStreamOptions,
) => {
  const event = { type: eventType, data } as MessageEvent<string>;
  try {
    if (eventType === "stream_meta") {
      options.onMeta?.(parseChainFeedStreamMetaData(data), event);
      return;
    }
    options.onDelta(parseChainFeedStreamDeltaData(data), event);
  } catch (error) {
    options.onError?.(
      error instanceof Error ? error : new Error("Invalid chain feed stream frame."),
      event,
    );
  }
};

const dispatchSseFrame = (frame: string, options: CreateChainFeedStreamOptions) => {
  let eventType = "message";
  const dataLines: string[] = [];

  for (const rawLine of frame.split("\n")) {
    if (!rawLine || rawLine.startsWith(":")) continue;
    const separatorIndex = rawLine.indexOf(":");
    const field = separatorIndex === -1 ? rawLine : rawLine.slice(0, separatorIndex);
    let value = separatorIndex === -1 ? "" : rawLine.slice(separatorIndex + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") {
      eventType = value || "message";
    } else if (field === "data") {
      dataLines.push(value);
    }
  }

  if (dataLines.length === 0) return;
  dispatchSseEvent(eventType, dataLines.join("\n"), options);
};

const normalizeSseLineEndings = (value: string): string =>
  value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

const findSseFrameBoundary = (buffer: string): { index: number; length: number } | null => {
  const match = /\r\n\r\n|\n\n|\r\r/.exec(buffer);
  return match ? { index: match.index, length: match[0].length } : null;
};

const consumeSseResponse = async (
  response: Response,
  options: CreateChainFeedStreamOptions,
  isClosed: () => boolean,
) => {
  if (!response.body) {
    throw new ChainFeedValidationError("Chain feed stream response did not include a body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (!isClosed()) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = findSseFrameBoundary(buffer);
      while (boundary) {
        if (isClosed()) return;
        dispatchSseFrame(normalizeSseLineEndings(buffer.slice(0, boundary.index)), options);
        buffer = buffer.slice(boundary.index + boundary.length);
        boundary = findSseFrameBoundary(buffer);
      }
    }

    buffer += decoder.decode();
    if (!isClosed() && buffer.trim()) {
      dispatchSseFrame(normalizeSseLineEndings(buffer), options);
    }
  } finally {
    reader.releaseLock();
  }
};

const isAbortError = (error: unknown): boolean =>
  typeof DOMException !== "undefined" && error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";

const toStreamError = (error: unknown): Error => {
  if (isDcnApiError(error)) {
    return new ChainApiRequestError(
      errorMessage(error.body, error.status),
      error.status,
      error.body,
    );
  }
  return error instanceof Error ? error : new Error("Chain feed stream failed.");
};

export const createChainFeedStream = (
  options: CreateChainFeedStreamOptions,
): ChainFeedStreamSubscription => {
  let nextSinceSeq = normalizeRequestSeq(options.sinceSeq, "sinceSeq");
  const limit = normalizeRequestLimit(options.limit, "limit");
  let closed = false;
  let url = "";
  let currentController: AbortController | null = null;
  let reconnectAttempts = 0;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  const clearReconnectTimeout = () => {
    if (reconnectTimeout === null || typeof clearTimeout !== "function") return;
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  };

  const scheduleReconnect = () => {
    if (closed || typeof setTimeout !== "function" || reconnectTimeout !== null) return;
    const delay = Math.min(
      STREAM_RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempts,
      STREAM_RECONNECT_MAX_DELAY_MS,
    );
    reconnectAttempts += 1;
    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null;
      connect();
    }, delay);
  };

  const streamOptions: CreateChainFeedStreamOptions = {
    ...options,
    onDelta: (delta, event) => {
      nextSinceSeq = Math.max(nextSinceSeq, delta.streamSeq);
      options.onDelta(delta, event);
    },
    onMeta: (meta, event) => {
      if (meta.lastSeq !== null) {
        nextSinceSeq = Math.max(nextSinceSeq, meta.lastSeq);
      }
      options.onMeta?.(meta, event);
    },
  };

  function connect() {
    if (closed) return;
    currentController = new AbortController();
    const controller = currentController;
    const fetchWithAbort: typeof fetch = (input, init = {}) => {
      url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return fetch(input, {
        ...init,
        signal: init.signal ?? controller.signal,
      });
    };

    void createDcnClient({ fetch: fetchWithAbort })
      .feedStream({ sinceSeq: nextSinceSeq, limit })
      .then(async (response) => {
        if (response.url) url = response.url;
        if (closed) return;
        reconnectAttempts = 0;
        await consumeSseResponse(response, streamOptions, () => closed);
        if (!closed) scheduleReconnect();
      })
      .catch((error) => {
        if (closed && isAbortError(error)) return;
        if (closed) return;
        options.onError?.(toStreamError(error));
        scheduleReconnect();
      })
      .finally(() => {
        if (currentController === controller) {
          currentController = null;
        }
      });
  }

  connect();

  return {
    get url() {
      return url;
    },
    close: () => {
      closed = true;
      clearReconnectTimeout();
      currentController?.abort();
      currentController = null;
    },
  };
};
