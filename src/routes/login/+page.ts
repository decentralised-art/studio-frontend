import { base } from "$app/paths";
import { redirect } from "@sveltejs/kit";

import { DEFAULT_AUTHENTICATED_ROUTE } from "$lib/auth/routeAccess";
import { hasAuthSession } from "$lib/auth/session";

export const ssr = false;

export const load = () => {
  if (hasAuthSession()) {
    throw redirect(307, `${base}${DEFAULT_AUTHENTICATED_ROUTE}`);
  }
};
