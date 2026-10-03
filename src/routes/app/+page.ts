import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";

export const load: PageLoad = ({ url }) => {
  throw redirect(308, `/${url.search}`);
};

// Redirect on the server so crawlers get a real HTTP redirect.
export const ssr = true;
