import { CHAIN_OPENAPI_PATH, MARKDOWN_PAGES, markdownPath } from "$lib/seo/agentDocs";
import { htmlToMarkdownPage } from "$lib/seo/markdown";
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from "$lib/seo/site";

import type { RequestHandler } from "./$types";

// An index of the site for AI agents (https://llmstxt.org). Titles and descriptions come from
// the pages themselves.
export const prerender = true;

export const GET: RequestHandler = async ({ fetch }) => {
  const pages: { section: string; line: string }[] = [];
  // Internal fetches share SvelteKit's prerender request state. Read them in order
  // to avoid overlapping reroute state; clones preserve cached dependency bodies.
  for (const { slug, section } of MARKDOWN_PAGES) {
    const path = `/${slug}`;
    const page = htmlToMarkdownPage(await (await fetch(path)).clone().text(), path);
    pages.push({
      section,
      line: `- [${page.title}](${absoluteUrl(markdownPath(slug))}): ${page.description}`,
    });
  }
  const sections = [...new Set(pages.map((page) => page.section))].map(
    (section) =>
      `## ${section}\n\n${pages
        .filter((page) => page.section === section)
        .map((page) => page.line)
        .join("\n")}`,
  );

  const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

Operations (transformations, conditions and connectors) are published to Ethereum through the open Performative Transactions (PT) protocol; the platform is currently tested on the Sepolia test network. Reading, simulating and executing need no account. Creating drafts and publishing need an Ethereum key, and publishing is the only step that costs gas. AI agents connect through the MCP server; code uses the SDK; both call the chain API at https://api.decentralised.art/chain. Every page below is also available as HTML at the same address without ".md".

${sections.join("\n\n")}

## API

- [Chain API OpenAPI specification](${absoluteUrl(CHAIN_OPENAPI_PATH)}): OpenAPI 3.0 description of the chain API used by the SDK and the MCP server.

## Optional

- [All documentation in one file](${absoluteUrl("/llms-full.txt")}): the pages above concatenated as markdown.
`;

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
