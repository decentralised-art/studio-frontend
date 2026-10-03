import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";

export const load: PageLoad = ({ params, url }) => {
  const path = params.path ? `/${params.path}` : "/";
  throw redirect(308, `${path}${url.search}`);
};

// Redirect on the server so crawlers get a real HTTP redirect.
export const ssr = true;
