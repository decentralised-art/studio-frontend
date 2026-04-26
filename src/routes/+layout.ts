import { base } from "$app/paths";
import { redirect, type LoadEvent } from "@sveltejs/kit";

import { isPublicRouteId, LOGIN_ROUTE } from "$lib/auth/routeAccess";
import { hasAuthSession } from "$lib/auth/session";

export const ssr = false;

export const load = ({ route }: LoadEvent) => {
  const isAuthenticated = hasAuthSession();

  if (!isAuthenticated && !isPublicRouteId(route.id)) {
    throw redirect(307, `${base}${LOGIN_ROUTE}`);
  }

  return { isAuthenticated };
};
