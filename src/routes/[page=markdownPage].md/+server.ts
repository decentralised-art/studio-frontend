import { error } from "@sveltejs/kit";

import { MARKDOWN_PAGES } from "$lib/seo/agentDocs";
import { htmlToMarkdownPage } from "$lib/seo/markdown";

import type { EntryGenerator, RequestHandler } from "./$types";

// Built from the rendered HTML page, so the docs have a single source.
export const prerender = true;

export const entries: EntryGenerator = () => MARKDOWN_PAGES.map(({ slug }) => ({ page: slug }));

export const GET: RequestHandler = async ({ params, fetch }) => {
  const path = `/${params.page}`;
  const response = await fetch(path);
  if (!response.ok) error(response.status, `Could not render ${path}`);
  const { markdown } = htmlToMarkdownPage(await response.clone().text(), path);
  return new Response(markdown, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
};
