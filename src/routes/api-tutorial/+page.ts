import { redirect } from "@sveltejs/kit";

export const load = () => {
  throw redirect(308, "/api-reference");
};

// Redirect on the server so crawlers get a real HTTP redirect.
export const ssr = true;
