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

const getChainApiBaseUrl = (): string => buildChainApiUrl("").replace(/\/+$/, "");

const withChainFetchDefaults =
  (baseFetch: typeof fetch): typeof fetch =>
  (input, init = {}) => {
    const method = (init.method ?? "GET").toUpperCase();
    return baseFetch(input, {
      ...(method === "GET" ? { cache: "no-store" as RequestCache } : {}),
      ...init,
    });
  };

export const createDcnClient = (options: DcnClientFactoryOptions = {}): DcnClient =>
  new DcnClient({
    baseUrl: getChainApiBaseUrl(),
    accessToken: options.accessToken ?? getChainToken(),
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
