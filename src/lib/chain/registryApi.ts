import { chainAuthFetch } from "$lib/auth/api";
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
  address?: string;
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

export type ChainAccountResponse = {
  address?: string;
  limit?: number;
  page?: number;
  owned_connectors?: string[];
  owned_transformations?: string[];
  owned_conditions?: string[];
  total_connectors?: number;
  total_transformations?: number;
  total_conditions?: number;
};

const parseBody = async (response: Response) => {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return response.json();
  return response.text();
};

const errorMessage = (payload: unknown) => {
  if (typeof payload === "string") return payload || "Request failed.";
  if (payload && typeof payload === "object") {
    const rec = payload as Record<string, unknown>;
    const message = rec.message ?? rec.error ?? rec.detail ?? rec.reason;
    if (typeof message === "string") return message;
  }
  return "Request failed.";
};

const fetchJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(buildChainApiUrl(path), { method: "GET", cache: "no-store" });
  const payload = await parseBody(response);
  if (!response.ok) {
    throw new Error(errorMessage(payload));
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
    throw new ChainApiRequestError(errorMessage(payload), response.status, payload);
  }
  return { status: response.status, body: payload as T };
};

export const getChainAccount = async (
  address: string,
  options: { limit?: number; page?: number } = {},
) => {
  const limit = options.limit ?? 200;
  const page = options.page ?? 0;
  const pathFor = (params: { limit: number; page: number }) =>
    `/account/${encodeURIComponent(address)}?limit=${encodeURIComponent(String(params.limit))}&page=${encodeURIComponent(String(params.page))}`;

  const hasOwnedEntries = (payload: ChainAccountResponse) => {
    const lists: unknown[] = [
      payload.owned_connectors,
      payload.owned_transformations,
      payload.owned_conditions,
      // Legacy names (kept for mixed backend versions)
      (payload as Record<string, unknown>).owned_features,
      (payload as Record<string, unknown>).owned_particles,
    ];
    return lists.some((list) => Array.isArray(list) && list.length > 0);
  };

  const attempts: Array<{ limit: number; page: number }> = [{ limit, page }];
  const fallbackLimit = Math.min(limit, 200);
  const fallbackPage = page <= 0 ? 1 : page;
  if (fallbackLimit !== limit || fallbackPage !== page) {
    attempts.push({ limit: fallbackLimit, page: fallbackPage });
  }

  let lastError: unknown = null;
  let lastPayload: ChainAccountResponse | null = null;

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    try {
      const payload = await fetchJson<ChainAccountResponse>(pathFor(attempt));
      lastPayload = payload;
      const isLastAttempt = index === attempts.length - 1;
      if (hasOwnedEntries(payload) || isLastAttempt) {
        return payload;
      }
    } catch (error) {
      lastError = error;
      const isLastAttempt = index === attempts.length - 1;
      if (isLastAttempt) throw error;
    }
  }

  if (lastPayload) return lastPayload;
  if (lastError) throw lastError;
  throw new Error("Failed to load chain account.");
};

export const getChainConnector = async (name: string, version?: string) =>
  fetchJson<ChainConnectorResponse>(
    `/connector/${encodeURIComponent(name)}${version ? `/${encodeURIComponent(version)}` : ""}`,
  );

export const getChainTransformation = async (name: string, version?: string) =>
  fetchJson<ChainTransformationResponse>(
    `/transformation/${encodeURIComponent(name)}${version ? `/${encodeURIComponent(version)}` : ""}`,
  );

export const getChainCondition = async (name: string, version?: string) =>
  fetchJson<ChainConditionResponse>(
    `/condition/${encodeURIComponent(name)}${version ? `/${encodeURIComponent(version)}` : ""}`,
  );

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
