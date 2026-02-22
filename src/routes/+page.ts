import { redirect } from "@sveltejs/kit";

import { getToken } from "$lib/auth/session";

export const ssr = false;

export const load = () => {
  throw redirect(307, getToken() ? "/network" : "/login");
};
