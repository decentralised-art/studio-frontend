const defaultApiOrigin = "https://api.decentralised.art";
const isDev = import.meta.env.DEV;

const normalizeBase = (rawBase: string, fallbackBase: string): string =>
  (rawBase.trim().length > 0 ? rawBase.trim() : fallbackBase).replace(/\/+$/, "");

const servicesBase = normalizeBase(
  import.meta.env.VITE_SERVICES_API_BASE_URL?.toString() ??
    import.meta.env.VITE_API_BASE_URL?.toString() ??
    "",
  isDev ? "/services" : `${defaultApiOrigin}/services`,
);

const chainBase = normalizeBase(
  import.meta.env.VITE_CHAIN_API_BASE_URL?.toString() ?? "",
  isDev ? "/chain" : `${defaultApiOrigin}/chain`,
);

const joinUrl = (base: string, path: string): string =>
  `${base}${path.startsWith("/") ? path : `/${path}`}`;

export const buildServicesApiUrl = (path: string): string => joinUrl(servicesBase, path);
export const buildChainApiUrl = (path: string): string => joinUrl(chainBase, path);
