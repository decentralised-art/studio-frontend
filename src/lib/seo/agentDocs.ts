/**
 * Pages published as markdown for AI agents (/<slug>.md), listed in /llms.txt and concatenated
 * into /llms-full.txt in this order.
 */
export const MARKDOWN_PAGES = [
  { slug: "tutorial", section: "Docs" },
  { slug: "mcp", section: "Docs" },
  { slug: "sdk", section: "Docs" },
  { slug: "api-reference", section: "Docs" },
  { slug: "about", section: "About" },
  { slug: "roadmap", section: "About" },
] as const;

export type MarkdownPageSlug = (typeof MARKDOWN_PAGES)[number]["slug"];

export const isMarkdownPageSlug = (value: string): value is MarkdownPageSlug =>
  MARKDOWN_PAGES.some((page) => page.slug === value);

export const markdownPath = (slug: MarkdownPageSlug): string => `/${slug}.md`;

export const CHAIN_OPENAPI_PATH = "/openapi/chain.json";
