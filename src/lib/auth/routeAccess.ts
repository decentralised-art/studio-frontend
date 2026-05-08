export const LOGIN_ROUTE = "/login";
export const DEFAULT_AUTHENTICATED_ROUTE = "/network";

const PUBLIC_ROUTE_IDS = new Set(["/", LOGIN_ROUTE]);
const PUBLIC_ROUTE_PREFIXES = ["/gallery", "/world-runtimes", "/worlds"];

export const isPublicRouteId = (routeId: string | null | undefined): boolean =>
  typeof routeId === "string" &&
  (PUBLIC_ROUTE_IDS.has(routeId) ||
    PUBLIC_ROUTE_PREFIXES.some((prefix) => routeId.startsWith(prefix)));

export const isWorldRuntimeRouteId = (routeId: string | null | undefined): boolean =>
  typeof routeId === "string" && routeId.startsWith("/world-runtimes");
