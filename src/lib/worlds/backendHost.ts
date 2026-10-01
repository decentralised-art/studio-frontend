import { getChainToken } from "$lib/auth/session";
import { buildChainApiUrl } from "$lib/url/url";

import { buildWorldSdkAssetUrl } from "./api";
import type { WorldBackendValueLimits, WorldPermission, WorldRuntimeInput } from "./types";

export type BackendWorldHost = {
  worldUrl: (url: string) => string;
  pushState: (state: { payload?: WorldRuntimeInput }) => void;
  dispose: () => void;
};

type CanonicalHostModule = {
  DecentralisedArtClient: new (options: {
    baseUrl: string;
    accessToken: string | null;
    fetch: typeof fetch;
  }) => unknown;
  createWorldHost: (options: {
    client: unknown;
    iframe: HTMLIFrameElement;
    permissions: WorldPermission[];
    valueLimits?: WorldBackendValueLimits;
    expectedOrigin: "null";
    onReady: () => void;
    onRendered: () => void;
    onError: (message: { message: string }) => void;
  }) => BackendWorldHost;
};

let hostModulePromise: Promise<CanonicalHostModule> | null = null;

const loadHostModule = (): Promise<CanonicalHostModule> => {
  hostModulePromise ??= (
    import(
      /* @vite-ignore */ buildWorldSdkAssetUrl("world-host.js")
    ) as Promise<CanonicalHostModule>
  ).catch((error) => {
    hostModulePromise = null;
    throw error;
  });
  return hostModulePromise;
};

export const createBackendWorldHost = async (options: {
  iframe: HTMLIFrameElement;
  permissions: WorldPermission[];
  valueLimits?: WorldBackendValueLimits;
  onReady: () => void;
  onRendered: () => void;
  onError: (message: { message: string }) => void;
}): Promise<BackendWorldHost> => {
  const sdk = await loadHostModule();
  const client = new sdk.DecentralisedArtClient({
    baseUrl: new URL(buildChainApiUrl(""), window.location.href).toString().replace(/\/+$/, ""),
    accessToken: getChainToken(),
    fetch: globalThis.fetch.bind(globalThis),
  });
  return sdk.createWorldHost({
    client,
    iframe: options.iframe,
    permissions: options.permissions.map((permission) =>
      permission.startsWith("dcn.")
        ? (permission.replace(/^dcn\./, "decentralised.art.") as WorldPermission)
        : permission,
    ),
    valueLimits: options.valueLimits,
    expectedOrigin: "null",
    onReady: options.onReady,
    onRendered: options.onRendered,
    onError: options.onError,
  });
};
