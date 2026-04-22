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

export type RawChainConnectorTransformationResponse = {
  name?: string;
  args?: ChainTransformationArg[];
};

export type RawChainConnectorDimensionResponse = {
  transformations?: RawChainConnectorTransformationResponse[];
  composite?: string;
  bindings?: Record<string, string>;
};

type RawChainLegacyConnectorResponseFields = {
  // Legacy frontend/test fixtures may still use camelCase aliases.
  conditionName?: string;
  conditionArgs?: number[];
  staticRi?: Record<
    string,
    {
      start_point?: number;
      transformation_shift?: number;
      startPoint?: number;
      transformationShift?: number;
      transformShift?: number;
    }
  >;
};

export type RawChainConnectorResponse = {
  name?: string;
  owner?: string;
  dimensions?: RawChainConnectorDimensionResponse[];
  condition_name?: string;
  condition_args?: number[];
  static_ri?: Record<
    string,
    {
      start_point?: number;
      transformation_shift?: number;
      startPoint?: number;
      transformationShift?: number;
      transformShift?: number;
    }
  >;
  address?: string;
  format_hash?: string;
} & RawChainLegacyConnectorResponseFields;

export type ChainConnectorDimensionResponse = RawChainConnectorDimensionResponse;
export type ChainConnectorResponse = RawChainConnectorResponse;

export type RawChainTransformationResponse = {
  name?: string;
  owner?: string;
  sol_src?: string;
  address?: string;
};

export type ChainTransformationResponse = RawChainTransformationResponse;

export type RawChainConditionResponse = {
  name?: string;
  owner?: string;
  sol_src?: string;
  address?: string;
};

export type ChainConditionResponse = RawChainConditionResponse;

export type ChainExecuteRunningInstancePayload = {
  start_point: number;
  transformation_shift: number;
};

export type ChainExecutePayload = {
  connector_name: string;
  particles_count: string;
  dynamic_ri: Record<string, ChainExecuteRunningInstancePayload>;
};

type RawChainLegacyExecuteStreamFields = {
  // Legacy fallback for historical payloads and old fixtures.
  feature_path?: string;
};

export type RawChainExecuteStreamResponse = {
  path?: string;
  data?: number[];
} & RawChainLegacyExecuteStreamFields;

export type RawChainExecuteResponse = RawChainExecuteStreamResponse[];

export type ChainExecuteStream = {
  path: string;
  data: number[];
};

export type ChainExecuteResponse = ChainExecuteStream[];

export type RawChainCursorResponse = {
  has_more?: boolean;
  next_after?: string | null;
};

type RawChainLegacyAccountCursorFields = {
  // Legacy compatibility accepted by the frontend only.
  connectors_has_more?: boolean;
  transformations_has_more?: boolean;
  conditions_has_more?: boolean;
  next_after_connectors?: string | null;
  next_after_transformations?: string | null;
  next_after_conditions?: string | null;
};

export type RawChainAccountResponse = {
  address?: string;
  limit?: number;
  owned_connectors?: string[];
  owned_transformations?: string[];
  owned_conditions?: string[];
  cursor_connectors?: RawChainCursorResponse;
  cursor_transformations?: RawChainCursorResponse;
  cursor_conditions?: RawChainCursorResponse;
} & RawChainLegacyAccountCursorFields;

export type ChainAccountResponse = RawChainAccountResponse;

type RawChainLegacyPageCursorFields = {
  // Legacy flat cursor fields accepted for compatibility.
  has_more?: boolean;
  next_after?: string | null;
};

export type RawChainFormatResponse = {
  format_hash?: string;
  limit?: number;
  total_connectors?: number;
  cursor?: RawChainCursorResponse;
  scalars?: string[];
  connectors?: string[];
} & RawChainLegacyPageCursorFields;

export type ChainFormatResponse = RawChainFormatResponse;

export type RawChainAccountsResponse = {
  limit?: number;
  total_accounts?: number;
  accounts?: string[];
  cursor?: RawChainCursorResponse;
} & RawChainLegacyPageCursorFields;

export type ChainAccountsResponse = RawChainAccountsResponse;

export type RawChainFormatsResponse = {
  limit?: number;
  total_formats?: number;
  formats?: string[];
  cursor?: RawChainCursorResponse;
} & RawChainLegacyPageCursorFields;

export type ChainFormatsResponse = RawChainFormatsResponse;

export type ChainCursorResponse = RawChainCursorResponse;

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

const resolveLegacyChainAccountCursor = (
  payload: RawChainAccountResponse,
  kind: "connectors" | "transformations" | "conditions",
): ChainResolvedCursor => {
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

const resolveLegacyChainPageCursor = (
  payload: RawChainLegacyPageCursorFields,
): ChainResolvedCursor => ({
  hasMore: Boolean(payload.has_more),
  nextAfter: normalizeCursorToken(payload.next_after),
});

const resolveRawChainExecuteStreamPath = (stream: RawChainExecuteStreamResponse): string => {
  if (typeof stream.path === "string" && stream.path.trim().length > 0) {
    return stream.path.trim();
  }
  if (typeof stream.feature_path === "string" && stream.feature_path.trim().length > 0) {
    return stream.feature_path.trim();
  }
  return "";
};

export const normalizeChainExecuteResponse = (
  payload: RawChainExecuteResponse,
): ChainExecuteResponse => {
  if (!Array.isArray(payload)) {
    throw new Error("Invalid execute response payload: expected an array of streams.");
  }

  return payload.map((stream, index) => {
    if (!stream || typeof stream !== "object") {
      throw new Error(`Invalid execute response payload: stream ${index} must be an object.`);
    }

    const path = resolveRawChainExecuteStreamPath(stream);
    if (!path) {
      throw new Error(
        `Invalid execute response payload: stream ${index} must include path or feature_path.`,
      );
    }

    if (!Array.isArray(stream.data)) {
      throw new Error(`Invalid execute response payload: stream ${index} must include data[].`);
    }

    if (stream.data.some((value) => typeof value !== "number")) {
      throw new Error(
        `Invalid execute response payload: stream ${index} data[] must contain only numbers.`,
      );
    }

    return {
      path,
      data: [...stream.data],
    };
  });
};

export const resolveChainAccountCursor = (
  payload: RawChainAccountResponse,
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
  return resolveLegacyChainAccountCursor(payload, kind);
};

export const resolveChainFormatCursor = (payload: RawChainFormatResponse): ChainResolvedCursor => {
  const fromObject = resolveCursorFromObject(payload.cursor);
  if (fromObject) return fromObject;
  return resolveLegacyChainPageCursor(payload);
};

export const resolveChainAccountsCursor = (
  payload: RawChainAccountsResponse,
): ChainResolvedCursor => {
  const fromObject = resolveCursorFromObject(payload.cursor);
  if (fromObject) return fromObject;
  return resolveLegacyChainPageCursor(payload);
};

export const resolveChainFormatsCursor = (
  payload: RawChainFormatsResponse,
): ChainResolvedCursor => {
  const fromObject = resolveCursorFromObject(payload.cursor);
  if (fromObject) return fromObject;
  return resolveLegacyChainPageCursor(payload);
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

  return fetchJson<RawChainAccountResponse>(
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
  return fetchJson<RawChainAccountsResponse>(`/accounts?${query.toString()}`);
};

export const getChainConnector = async (name: string) =>
  fetchJson<RawChainConnectorResponse>(`/connector/${encodeURIComponent(name)}`);

export const getChainTransformation = async (name: string) =>
  fetchJson<RawChainTransformationResponse>(`/transformation/${encodeURIComponent(name)}`);

export const getChainCondition = async (name: string) =>
  fetchJson<RawChainConditionResponse>(`/condition/${encodeURIComponent(name)}`);

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
  return fetchJson<RawChainFormatResponse>(
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
  return fetchJson<RawChainFormatsResponse>(`/formats?${query.toString()}`);
};

export const postChainConnector = async (payload: ChainConnectorPayload) =>
  postJsonWithChainAuth<RawChainConnectorResponse>("/connector", payload);

export const postChainConnectorDetailed = async (payload: ChainConnectorPayload) =>
  postJsonWithChainAuthDetailed<RawChainConnectorResponse>("/connector", payload);

export const postChainTransformation = async (payload: { name: string; sol_src: string }) =>
  postJsonWithChainAuth<RawChainTransformationResponse>("/transformation", payload);

export const postChainTransformationDetailed = async (payload: { name: string; sol_src: string }) =>
  postJsonWithChainAuthDetailed<RawChainTransformationResponse>("/transformation", payload);

export const postChainCondition = async (payload: { name: string; sol_src: string }) =>
  postJsonWithChainAuth<RawChainConditionResponse>("/condition", payload);

export const postChainConditionDetailed = async (payload: { name: string; sol_src: string }) =>
  postJsonWithChainAuthDetailed<RawChainConditionResponse>("/condition", payload);

export const postChainExecute = async (payload: ChainExecutePayload) => {
  const result = await postChainExecuteDetailed(payload);
  return result.body;
};
export const postChainExecuteDetailed = async (payload: ChainExecutePayload) =>
  postJsonWithChainAuthDetailed<RawChainExecuteResponse>(
    "/execute",
    normalizeChainExecutePayload(payload),
  ).then((result) => {
    try {
      return {
        status: result.status,
        body: normalizeChainExecuteResponse(result.body),
      };
    } catch (error) {
      throw new ChainApiRequestError(
        error instanceof Error ? error.message : "Invalid execute response payload.",
        result.status,
        result.body,
      );
    }
  });
