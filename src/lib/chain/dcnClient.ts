import { getChainToken } from "$lib/auth/session";
import { buildChainApiUrl } from "$lib/url/url";
import { DcnClient } from "dcn";

export type DcnApiErrorLike = {
  status: number;
  body: unknown;
};

export type DcnClientFactoryOptions = {
  accessToken?: string | null;
  fetch?: typeof fetch;
};

const defaultChainApiBaseUrl = "https://api.decentralised.art/chain";

const stripTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

const isAbsoluteUrl = (value: string): boolean => /^[a-z][a-z\d+\-.]*:\/\//i.test(value);

const getRuntimeOrigin = (): string | null => {
  const origin = globalThis.location?.origin;
  return typeof origin === "string" && origin.length > 0 ? origin : null;
};

export const resolveDcnClientBaseUrl = (rawBaseUrl: string): string => {
  const baseUrl = stripTrailingSlashes(rawBaseUrl.trim());
  if (baseUrl.length === 0) return defaultChainApiBaseUrl;
  if (isAbsoluteUrl(baseUrl)) return baseUrl;

  const origin = getRuntimeOrigin() ?? defaultChainApiBaseUrl;
  const absolutePath = baseUrl.startsWith("/") ? baseUrl : `/${baseUrl}`;
  return stripTrailingSlashes(new URL(absolutePath, origin).toString());
};

const getChainApiBaseUrl = (): string => resolveDcnClientBaseUrl(buildChainApiUrl(""));

const withChainFetchDefaults =
  (baseFetch: typeof fetch): typeof fetch =>
  (input, init = {}) => {
    const method = (init.method ?? "GET").toUpperCase();
    return baseFetch(input, {
      ...(method === "GET" ? { cache: "no-store" as RequestCache } : {}),
      ...init,
    });
  };

const resolveAccessToken = (options: DcnClientFactoryOptions): string | null =>
  Object.prototype.hasOwnProperty.call(options, "accessToken")
    ? (options.accessToken ?? null)
    : getChainToken();

export const createDcnClient = (options: DcnClientFactoryOptions = {}): DcnClient =>
  new DcnClient({
    baseUrl: getChainApiBaseUrl(),
    accessToken: resolveAccessToken(options),
    fetch: withChainFetchDefaults(options.fetch ?? globalThis.fetch.bind(globalThis)),
  });

export const createDcnStatusTrackingClient = (options: DcnClientFactoryOptions = {}) => {
  let lastResponseStatus: number | null = null;
  const baseFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const trackingFetch: typeof fetch = async (input, init) => {
    const response = await baseFetch(input, init);
    lastResponseStatus = response.status;
    return response;
  };

  return {
    client: createDcnClient({
      ...options,
      fetch: trackingFetch,
    }),
    getLastResponseStatus: () => lastResponseStatus,
  };
};

export const isDcnApiError = (error: unknown): error is DcnApiErrorLike => {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  return (
    record.name === "DcnApiError" &&
    typeof record.status === "number" &&
    Object.prototype.hasOwnProperty.call(record, "body")
  );
};
