import { redirect } from "@sveltejs/kit";

export const load = () => {
  throw redirect(308, "/worlds");
};

// Redirect on the server so crawlers get a real HTTP redirect.
export const ssr = true;
