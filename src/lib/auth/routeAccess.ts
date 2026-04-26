export const LOGIN_ROUTE = "/login";
export const DEFAULT_AUTHENTICATED_ROUTE = "/network";

const PUBLIC_ROUTE_IDS = new Set(["/", LOGIN_ROUTE]);

export const isPublicRouteId = (routeId: string | null | undefined): boolean =>
  typeof routeId === "string" && PUBLIC_ROUTE_IDS.has(routeId);
