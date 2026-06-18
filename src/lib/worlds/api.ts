import { authFetch } from "$lib/auth/api";
import { buildServicesApiUrl } from "$lib/url/url";

import {
  normalizeBackendWorldDescriptor,
  normalizeBackendWorldDescriptorList,
  normalizeBackendWorldValidateResponse,
  type BackendWorldDescriptor,
  type BackendWorldValidateResponse,
} from "./contract";
import type { WorldRuntimeSurface } from "./types";

export type ListWorldsOptions = {
  page?: number;
  limit?: number;
  surface?: WorldRuntimeSurface;
  query?: string;
};

export const WORLD_ASSET_PATH_PREFIX = "/world-assets";
export const WORLD_SDK_PATH_PREFIX = "/js/sdk";

export class WorldApiRequestError extends Error {
  status: number;
  responseBody: unknown;

  constructor(message: string, status: number, responseBody: unknown) {
    super(message);
    this.name = "WorldApiRequestError";
    this.status = status;
    this.responseBody = responseBody;
  }
}

const parseResponseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) return "";
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
};

const errorMessage = (payload: unknown, status: number): string => {
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const message = record.message ?? record.error ?? record.detail ?? record.reason;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return `World request failed (HTTP ${String(status)}).`;
};

const assertOk = (response: Response, payload: unknown): void => {
  if (response.ok) return;
  throw new WorldApiRequestError(errorMessage(payload, response.status), response.status, payload);
};

export const buildWorldsApiUrl = (path = ""): string => {
  const suffix = path.trim();
  return buildServicesApiUrl(`/worlds${suffix ? `/${suffix.replace(/^\/+/, "")}` : ""}`);
};

const appendIntegerParam = (params: URLSearchParams, key: string, value: number | undefined) => {
  if (value === undefined || !Number.isFinite(value)) return;
  params.set(key, String(Math.max(0, Math.trunc(value))));
};

const buildListWorldsUrl = (options: ListWorldsOptions = {}): string => {
  const params = new URLSearchParams();
  appendIntegerParam(params, "page", options.page);
  appendIntegerParam(params, "limit", options.limit);
  if (options.surface) params.set("surface", options.surface);
  const query = options.query?.trim();
  if (query) params.set("q", query);
  const suffix = params.toString();
  return `${buildWorldsApiUrl()}${suffix ? `?${suffix}` : ""}`;
};

const buildServicesRoutedAssetUrl = (path: string): string => {
  const normalizedPath = `/${path.trim().replace(/^\/+/, "")}`;
  const servicesRelativePath = normalizedPath.startsWith("/services/")
    ? normalizedPath.slice("/services".length)
    : normalizedPath;
  return buildServicesApiUrl(servicesRelativePath);
};

export const buildWorldAssetUrl = (entryUrn: string): string => {
  const trimmed = entryUrn.trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed).toString();
  } catch {
    // Relative backend URN.
  }
  return buildServicesRoutedAssetUrl(trimmed);
};

export const buildWorldSdkAssetUrl = (assetPath: string): string => {
  const suffix = assetPath.trim().replace(/^\/+/, "");
  return buildServicesRoutedAssetUrl(`${WORLD_SDK_PATH_PREFIX}${suffix ? `/${suffix}` : ""}`);
};

const worldBundleFormData = (bundle: Blob, filename = "world-bundle.zip"): FormData => {
  const formData = new FormData();
  const name = typeof (bundle as { name?: unknown }).name === "string" ? (bundle as File).name : "";
  formData.append("bundle", bundle, name || filename);
  return formData;
};

export const listWorlds = async (
  options: ListWorldsOptions = {},
): Promise<BackendWorldDescriptor[]> => {
  const response = await fetch(buildListWorldsUrl(options));
  const payload = await parseResponseBody(response);
  assertOk(response, payload);
  return normalizeBackendWorldDescriptorList(payload);
};

export const getWorld = async (id: string): Promise<BackendWorldDescriptor> => {
  const response = await fetch(buildWorldsApiUrl(encodeURIComponent(id)));
  const payload = await parseResponseBody(response);
  assertOk(response, payload);
  return normalizeBackendWorldDescriptor(payload);
};

export const validateWorldBundle = async (bundle: Blob): Promise<BackendWorldValidateResponse> => {
  const response = await fetch(buildWorldsApiUrl("validate"), {
    method: "POST",
    body: worldBundleFormData(bundle),
  });
  const payload = await parseResponseBody(response);
  assertOk(response, payload);
  return normalizeBackendWorldValidateResponse(payload);
};

export const uploadWorldBundle = async (bundle: Blob): Promise<BackendWorldDescriptor> => {
  const response = await authFetch("/worlds/upload", {
    method: "POST",
    body: worldBundleFormData(bundle),
  });
  const payload = await parseResponseBody(response);
  assertOk(response, payload);
  return normalizeBackendWorldDescriptor(payload);
};

export const updateWorldBundle = async (
  id: string,
  bundle: Blob,
): Promise<BackendWorldDescriptor> => {
  const response = await authFetch(`/worlds/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: worldBundleFormData(bundle),
  });
  const payload = await parseResponseBody(response);
  assertOk(response, payload);
  return normalizeBackendWorldDescriptor(payload);
};

export const deleteWorld = async (id: string): Promise<void> => {
  const response = await authFetch(`/worlds/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const payload = await parseResponseBody(response);
  assertOk(response, payload);
};
