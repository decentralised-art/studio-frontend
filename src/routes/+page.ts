import { base } from "$app/paths";
import { redirect } from "@sveltejs/kit";

import { DEFAULT_AUTHENTICATED_ROUTE, DEFAULT_UNAUTHENTICATED_ROUTE } from "$lib/auth/routeAccess";
import { hasAuthSession } from "$lib/auth/session";

export const ssr = false;

export const load = () => {
  throw redirect(
    307,
    `${base}${hasAuthSession() ? DEFAULT_AUTHENTICATED_ROUTE : DEFAULT_UNAUTHENTICATED_ROUTE}`,
  );
};
