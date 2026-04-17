import { chainAuthFetch } from "$lib/auth/api";
import { normalizeChainExecutePayload } from "$lib/chain/executePayloadContract";
import { buildChainApiUrl } from "$lib/url/url";

export type ChainApiPostResult<T> = {
  status: number;
  body: T;
};

export class ChainApiRequestError extends Error {
  status: number;
  responseBody: unknown;

  constructor(message: string, status: number, responseBody: unknown) {
    super(message);
    this.name = "ChainApiRequestError";
    this.status = status;
    this.responseBody = responseBody;
  }
}

export type ChainTransformationArg = number;

export type ChainConnectorTransformationPayload = {
  name: string;
  args: ChainTransformationArg[];
};

export type ChainConnectorDimensionPayload = {
  transformations: ChainConnectorTransformationPayload[];
  composite?: string;
  bindings?: Record<string, string>;
};

export type ChainConnectorPayload = {
  name: string;
  dimensions: ChainConnectorDimensionPayload[];
  condition_name?: string;
  condition_args?: number[];
  static_ri?: Record<
    string,
    {
      start_point: number;
      transformation_shift: number;
    }
  >;
};

export type ChainConnectorDimensionResponse = {
  transformations?: Array<{ name?: string; args?: ChainTransformationArg[] }>;
  composite?: string;
  bindings?: Record<string, string>;
};

export type ChainConnectorResponse = {
  name?: string;
  owner?: string;
  dimensions?: ChainConnectorDimensionResponse[];
  condition_name?: string;
  conditionName?: string;
  condition_args?: number[];
  conditionArgs?: number[];
  static_ri?: Record<
    string,
    {
      start_point?: number;
      transformation_shift?: number;
    }
  >;
  staticRi?: Record<
    string,
    {
      start_point?: number;
      transformation_shift?: number;
    }
  >;
  address?: string;
  format_hash?: string;
};

export type ChainTransformationResponse = {
  name?: string;
  owner?: string;
  sol_src?: string;
  address?: string;
};

export type ChainConditionResponse = {
  name?: string;
  owner?: string;
  sol_src?: string;
  address?: string;
};

export type ChainExecuteRunningInstancePayload = {
  start_point: number;
  transformation_shift: number;
};

export type ChainExecutePayload = {
  connector_name: string;
  particles_count: string;
  dynamic_ri: Record<string, ChainExecuteRunningInstancePayload>;
};

export type ChainExecuteStreamResponse = {
  path?: string;
  feature_path?: string;
  data?: number[];
};

export type ChainExecuteResponse = ChainExecuteStreamResponse[];

export type ChainCursorResponse = {
  has_more?: boolean;
  next_after?: string | null;
};

export type ChainAccountResponse = {
  address?: string;
  limit?: number;
  owned_connectors?: string[];
  owned_transformations?: string[];
  owned_conditions?: string[];
  // Cursor shape (current backend contract)
  cursor_connectors?: ChainCursorResponse;
  cursor_transformations?: ChainCursorResponse;
  cursor_conditions?: ChainCursorResponse;
  // Legacy fields (still accepted by frontend for compatibility)
  connectors_has_more?: boolean;
  transformations_has_more?: boolean;
  conditions_has_more?: boolean;
  next_after_connectors?: string | null;
  next_after_transformations?: string | null;
  next_after_conditions?: string | null;
};

export type ChainFormatResponse = {
  format_hash?: string;
  limit?: number;
  total_connectors?: number;
  // Cursor shape (current backend contract)
  cursor?: ChainCursorResponse;
  // Legacy fields (still accepted by frontend for compatibility)
  has_more?: boolean;
  next_after?: string | null;
  scalars?: string[];
  connectors?: string[];
};

export type ChainAccountsResponse = {
  limit?: number;
  total_accounts?: number;
  accounts?: string[];
  cursor?: ChainCursorResponse;
  has_more?: boolean;
  next_after?: string | null;
};

export type ChainFormatsResponse = {
  limit?: number;
  total_formats?: number;
  formats?: string[];
  cursor?: ChainCursorResponse;
  has_more?: boolean;
  next_after?: string | null;
};

const FORMAT_HASH_HEX_RE = /^[0-9a-f]{64}$/i;
const CHAIN_CURSOR_PAGE_LIMIT_MAX = 256;

const normalizeCursorLimit = (value: unknown, fallback = CHAIN_CURSOR_PAGE_LIMIT_MAX) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const int = Math.trunc(parsed);
  if (int <= 0) return 1;
  return Math.min(int, CHAIN_CURSOR_PAGE_LIMIT_MAX);
};

export const normalizeFormatHash = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  const withoutPrefix = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
  if (!FORMAT_HASH_HEX_RE.test(withoutPrefix)) {
    throw new Error("Invalid format hash. Expected 32-byte hex value.");
  }
  return `0x${withoutPrefix}`;
};

const parseBody = async (response: Response) => {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return response.json();
  return response.text();
};

const normalizeCursorToken = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export type ChainResolvedCursor = {
  hasMore: boolean;
  nextAfter: string | null;
};

const resolveCursorFromObject = (cursor: unknown): ChainResolvedCursor | null => {
  if (!cursor || typeof cursor !== "object") return null;
  const rec = cursor as Record<string, unknown>;
  return {
    hasMore: Boolean(rec.has_more),
    nextAfter: normalizeCursorToken(rec.next_after),
  };
};

export const resolveChainAccountCursor = (
  payload: ChainAccountResponse,
  kind: "connectors" | "transformations" | "conditions",
): ChainResolvedCursor => {
  const cursorField =
    kind === "connectors"
      ? payload.cursor_connectors
      : kind === "transformations"
        ? payload.cursor_transformations
        : payload.cursor_conditions;

  const fromObject = resolveCursorFromObject(cursorField);
  if (fromObject) return fromObject;

  if (kind === "connectors") {
    return {
      hasMore: Boolean(payload.connectors_has_more),
      nextAfter: normalizeCursorToken(payload.next_after_connectors),
    };
  }
  if (kind === "transformations") {
    return {
      hasMore: Boolean(payload.transformations_has_more),
      nextAfter: normalizeCursorToken(payload.next_after_transformations),
    };
  }
  return {
    hasMore: Boolean(payload.conditions_has_more),
    nextAfter: normalizeCursorToken(payload.next_after_conditions),
  };
};

export const resolveChainFormatCursor = (payload: ChainFormatResponse): ChainResolvedCursor => {
  const fromObject = resolveCursorFromObject(payload.cursor);
  if (fromObject) return fromObject;
  return {
    hasMore: Boolean(payload.has_more),
    nextAfter: normalizeCursorToken(payload.next_after),
  };
};

export const resolveChainAccountsCursor = (payload: ChainAccountsResponse): ChainResolvedCursor => {
  const fromObject = resolveCursorFromObject(payload.cursor);
  if (fromObject) return fromObject;
  return {
    hasMore: Boolean(payload.has_more),
    nextAfter: normalizeCursorToken(payload.next_after),
  };
};

export const resolveChainFormatsCursor = (payload: ChainFormatsResponse): ChainResolvedCursor => {
  const fromObject = resolveCursorFromObject(payload.cursor);
  if (fromObject) return fromObject;
  return {
    hasMore: Boolean(payload.has_more),
    nextAfter: normalizeCursorToken(payload.next_after),
  };
};

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

const fetchJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(buildChainApiUrl(path), { method: "GET", cache: "no-store" });
  const payload = await parseBody(response);
  if (!response.ok) {
    throw new Error(errorMessage(payload, response.status));
  }
  return payload as T;
};

const postJsonWithChainAuth = async <T>(path: string, body: unknown): Promise<T> => {
  const result = await postJsonWithChainAuthDetailed<T>(path, body);
  return result.body;
};

const postJsonWithChainAuthDetailed = async <T>(
  path: string,
  body: unknown,
): Promise<ChainApiPostResult<T>> => {
  const response = await chainAuthFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await parseBody(response);
  if (!response.ok) {
    throw new ChainApiRequestError(
      errorMessage(payload, response.status),
      response.status,
      payload,
    );
  }
  return { status: response.status, body: payload as T };
};

export const getChainAccount = async (
  address: string,
  options: {
    limit?: number;
    after_connectors?: string | null;
    after_transformations?: string | null;
    after_conditions?: string | null;
  } = {},
) => {
  const limit = normalizeCursorLimit(options.limit);
  const query = new URLSearchParams({
    limit: String(limit),
  });
  const afterConnectors = options.after_connectors?.trim();
  if (afterConnectors) query.set("after_connectors", afterConnectors);
  const afterTransformations = options.after_transformations?.trim();
  if (afterTransformations) query.set("after_transformations", afterTransformations);
  const afterConditions = options.after_conditions?.trim();
  if (afterConditions) query.set("after_conditions", afterConditions);

  return fetchJson<ChainAccountResponse>(
    `/account/${encodeURIComponent(address)}?${query.toString()}`,
  );
};

export const getChainAccounts = async (
  options: {
    limit?: number;
    after?: string | null;
  } = {},
) => {
  const limit = normalizeCursorLimit(options.limit);
  const query = new URLSearchParams({
    limit: String(limit),
  });
  const after = options.after?.trim();
  if (after) query.set("after", after);
  return fetchJson<ChainAccountsResponse>(`/accounts?${query.toString()}`);
};

export const getChainConnector = async (name: string) =>
  fetchJson<ChainConnectorResponse>(`/connector/${encodeURIComponent(name)}`);

export const getChainTransformation = async (name: string) =>
  fetchJson<ChainTransformationResponse>(`/transformation/${encodeURIComponent(name)}`);

export const getChainCondition = async (name: string) =>
  fetchJson<ChainConditionResponse>(`/condition/${encodeURIComponent(name)}`);

export const getChainFormat = async (
  formatHash: string,
  options: { limit?: number; after?: string | null } = {},
) => {
  const limit = normalizeCursorLimit(options.limit);
  const normalizedHash = normalizeFormatHash(formatHash);
  const query = new URLSearchParams({
    limit: String(limit),
  });
  const after = options.after?.trim();
  if (after) query.set("after", after);
  return fetchJson<ChainFormatResponse>(
    `/format/${encodeURIComponent(normalizedHash)}?${query.toString()}`,
  );
};

export const getChainFormats = async (options: { limit?: number; after?: string | null } = {}) => {
  const limit = normalizeCursorLimit(options.limit);
  const query = new URLSearchParams({
    limit: String(limit),
  });
  const after = options.after?.trim();
  if (after) query.set("after", after);
  return fetchJson<ChainFormatsResponse>(`/formats?${query.toString()}`);
};

export const postChainConnector = async (payload: ChainConnectorPayload) =>
  postJsonWithChainAuth<ChainConnectorResponse>("/connector", payload);

export const postChainConnectorDetailed = async (payload: ChainConnectorPayload) =>
  postJsonWithChainAuthDetailed<ChainConnectorResponse>("/connector", payload);

export const postChainTransformation = async (payload: { name: string; sol_src: string }) =>
  postJsonWithChainAuth<ChainTransformationResponse>("/transformation", payload);

export const postChainTransformationDetailed = async (payload: { name: string; sol_src: string }) =>
  postJsonWithChainAuthDetailed<ChainTransformationResponse>("/transformation", payload);

export const postChainCondition = async (payload: { name: string; sol_src: string }) =>
  postJsonWithChainAuth<ChainConditionResponse>("/condition", payload);

export const postChainConditionDetailed = async (payload: { name: string; sol_src: string }) =>
  postJsonWithChainAuthDetailed<ChainConditionResponse>("/condition", payload);

export const postChainExecute = async (payload: ChainExecutePayload) => {
  const result = await postChainExecuteDetailed(payload);
  return result.body;
};
export const postChainExecuteDetailed = async (payload: ChainExecutePayload) =>
  postJsonWithChainAuthDetailed<ChainExecuteResponse>(
    "/execute",
    normalizeChainExecutePayload(payload),
  );
