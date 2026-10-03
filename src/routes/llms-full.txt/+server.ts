import { MARKDOWN_PAGES, markdownPath } from "$lib/seo/agentDocs";
import { SITE_DESCRIPTION, SITE_NAME } from "$lib/seo/site";

import type { RequestHandler } from "./$types";

// Every markdown page in one file, for agents that want the whole documentation at once.
export const prerender = true;

export const GET: RequestHandler = async ({ fetch }) => {
  const pages = await Promise.all(
    MARKDOWN_PAGES.map(async ({ slug }) => (await fetch(markdownPath(slug))).text()),
  );
  const body = `# ${SITE_NAME}\n\n> ${SITE_DESCRIPTION}\n\n${pages.map((page) => page.trim()).join("\n\n---\n\n")}\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
