import spec from "$lib/site/docs/chain-openapi.json";

import type { RequestHandler } from "./$types";

// The chain API specification the API reference and SDK are built from.
export const prerender = true;

export const GET: RequestHandler = () =>
  new Response(JSON.stringify(spec, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
