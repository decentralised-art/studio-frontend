import { redirect } from "@sveltejs/kit";
import { base } from "$app/paths";

import { getToken } from "$lib/auth/session";

export const ssr = false;

export const load = () => {
  throw redirect(307, `${base}${getToken() ? "/network" : "/login"}`);
};
