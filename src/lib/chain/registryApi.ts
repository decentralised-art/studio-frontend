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

type ChainFeatureDimension = {
  transformations?: Array<{ name?: string; args?: number[] }>;
};

export type ChainFeatureResponse = {
  name?: string;
  owner?: string;
  dimensions?: ChainFeatureDimension[];
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

export type ChainParticleResponse = {
  name?: string;
  owner?: string;
  feature_name?: string;
  featureName?: string;
  composite_names?: Array<string | null>;
  compositeNames?: Array<string | null>;
  composites?: Array<string | null>;
  condition_name?: string;
  conditionName?: string;
  condition_args?: number[];
  conditionArgs?: number[];
};

export type ChainAccountResponse = {
  address?: string;
  limit?: number;
  page?: number;
  owned_particles?: string[];
  owned_features?: string[];
  owned_transformations?: string[];
  owned_conditions?: string[];
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

  try {
    return await fetchJson<ChainAccountResponse>(pathFor({ limit, page }));
  } catch (error) {
    const fallbackLimit = Math.min(limit, 200);
    const fallbackPage = page <= 0 ? 1 : page;
    const changed = fallbackLimit !== limit || fallbackPage !== page;
    if (!changed) throw error;
    return fetchJson<ChainAccountResponse>(pathFor({ limit: fallbackLimit, page: fallbackPage }));
  }
};

export const getChainFeature = async (name: string, version?: string) =>
  fetchJson<ChainFeatureResponse>(
    `/feature/${encodeURIComponent(name)}${version ? `/${encodeURIComponent(version)}` : ""}`,
  );

export const getChainTransformation = async (name: string, version?: string) =>
  fetchJson<ChainTransformationResponse>(
    `/transformation/${encodeURIComponent(name)}${version ? `/${encodeURIComponent(version)}` : ""}`,
  );

export const getChainCondition = async (name: string, version?: string) =>
  fetchJson<ChainConditionResponse>(
    `/condition/${encodeURIComponent(name)}${version ? `/${encodeURIComponent(version)}` : ""}`,
  );

export const getChainParticle = async (name: string, version?: string) =>
  fetchJson<ChainParticleResponse>(
    `/particle/${encodeURIComponent(name)}${version ? `/${encodeURIComponent(version)}` : ""}`,
  );

export const postChainFeature = async (payload: {
  name: string;
  dimensions: Array<{ transformations: Array<{ name: string; args: number[] }> }>;
}) => postJsonWithChainAuth<ChainFeatureResponse>("/feature", payload);

export const postChainFeatureDetailed = async (payload: {
  name: string;
  dimensions: Array<{ transformations: Array<{ name: string; args: number[] }> }>;
}) => postJsonWithChainAuthDetailed<ChainFeatureResponse>("/feature", payload);

export const postChainTransformation = async (payload: { name: string; sol_src: string }) =>
  postJsonWithChainAuth<ChainTransformationResponse>("/transformation", payload);

export const postChainTransformationDetailed = async (payload: { name: string; sol_src: string }) =>
  postJsonWithChainAuthDetailed<ChainTransformationResponse>("/transformation", payload);

export const postChainCondition = async (payload: { name: string; sol_src: string }) =>
  postJsonWithChainAuth<ChainConditionResponse>("/condition", payload);

export const postChainConditionDetailed = async (payload: { name: string; sol_src: string }) =>
  postJsonWithChainAuthDetailed<ChainConditionResponse>("/condition", payload);

export const postChainParticle = async (payload: {
  name: string;
  feature_name: string;
  composite_names: Array<string | null>;
  condition_name?: string;
  condition_args?: number[];
}) => postJsonWithChainAuth<ChainParticleResponse>("/particle", payload);

export const postChainParticleDetailed = async (payload: {
  name: string;
  feature_name: string;
  composite_names: Array<string | null>;
  condition_name?: string;
  condition_args?: number[];
}) => postJsonWithChainAuthDetailed<ChainParticleResponse>("/particle", payload);
