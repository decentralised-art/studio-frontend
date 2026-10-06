import { redirect } from "@sveltejs/kit";

// Keep links to the archived tutorial's chapters pointing to the current guide.
export const load = () => {
  throw redirect(307, "/tutorial");
};

// Redirect on the server so crawlers get a real HTTP redirect.
export const ssr = true;
