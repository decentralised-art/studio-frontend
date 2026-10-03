import { describe, expect, it } from "vitest";

import { handle } from "../src/hooks.server";
import {
  absoluteUrl,
  fallbackHeadFor,
  pageTitle,
  SITE_DESCRIPTION,
  SITEMAP_PATHS,
  techArticleJsonLd,
} from "../src/lib/seo/site";
import { GET as sitemap } from "../src/routes/sitemap.xml/+server";

type HandleInput = Parameters<typeof handle>[0];

const renderThroughHook = async (pathname: string, html: string): Promise<string> => {
  let output = "";
  const event = { url: new URL(`https://decentralised.art${pathname}`) } as HandleInput["event"];
  await handle({
    event,
    resolve: async (_event, options) => {
      output = (await options?.transformPageChunk?.({ html, done: true })) ?? html;
      return new Response(output);
    },
  });
  return output;
};

describe("SEO helpers", () => {
  it("builds page titles with the site name", () => {
    expect(pageTitle("SDK")).toBe("SDK · decentralised.art");
    expect(pageTitle()).toBe("decentralised.art · Collective performative intelligence");
  });

  it("builds absolute URLs on the production origin", () => {
    expect(absoluteUrl("/sdk")).toBe("https://decentralised.art/sdk");
    expect(absoluteUrl("/")).toBe("https://decentralised.art/");
  });

  it("describes documentation pages as TechArticles", () => {
    expect(techArticleJsonLd("/mcp", "MCP", "About MCP")).toMatchObject({
      "@type": "TechArticle",
      url: "https://decentralised.art/mcp",
      headline: "MCP",
    });
  });

  it("only gives known browser-only pages a canonical URL", () => {
    expect(fallbackHeadFor("/studio")).toMatchObject({ title: "Studio", canonical: true });
    expect(fallbackHeadFor("/u/0xabc")).toEqual({
      description: SITE_DESCRIPTION,
      canonical: false,
    });
  });
});

describe("sitemap.xml", () => {
  it("lists every indexed page and leaves out the /worlds duplicate", async () => {
    const response = sitemap();
    const body = await response.text();

    expect(response.headers.get("Content-Type")).toContain("application/xml");
    for (const path of SITEMAP_PATHS) {
      expect(body).toContain(`<loc>${absoluteUrl(path)}</loc>`);
    }
    expect(body).not.toContain("https://decentralised.art/worlds<");
  });
});

describe("fallback head tags", () => {
  const emptyShell = '<html><head><meta charset="utf-8" /></head><body></body></html>';

  it("adds a title, description and preview tags to browser-only pages", async () => {
    const html = await renderThroughHook("/studio", emptyShell);

    expect(html).toContain("<title>Studio · decentralised.art</title>");
    expect(html).toContain('<link rel="canonical" href="https://decentralised.art/studio"');
    expect(html).toContain('property="og:image" content="https://decentralised.art/og-image.png"');
    expect(html).toContain("data-seo-fallback");
  });

  it("leaves pages that already have a title untouched", async () => {
    const page = "<html><head><title>SDK · decentralised.art</title></head><body></body></html>";

    expect(await renderThroughHook("/sdk", page)).toBe(page);
  });
});
