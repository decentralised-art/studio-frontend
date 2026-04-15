import { base } from "$app/paths";
import { redirect } from "@sveltejs/kit";

import { hasAuthSession } from "$lib/auth/session";

export const ssr = false;

export const load = () => {
  throw redirect(307, `${base}${hasAuthSession() ? "/network" : "/login"}`);
};
