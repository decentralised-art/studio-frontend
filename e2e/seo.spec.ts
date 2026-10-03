import { expect, test } from "@playwright/test";

// Crawlers, AI agents and link previews read the HTML without running
// JavaScript, so these checks use plain HTTP requests.

const pages = [
  { path: "/", title: "decentralised.art · Collective performative intelligence", canonical: "/" },
  { path: "/worlds", title: "Worlds · decentralised.art", canonical: "/" },
  { path: "/about", title: "About · decentralised.art", canonical: "/about" },
  { path: "/sdk", title: "SDK · decentralised.art", canonical: "/sdk" },
  { path: "/mcp", title: "MCP · decentralised.art", canonical: "/mcp" },
  {
    path: "/api-reference",
    title: "API reference · decentralised.art",
    canonical: "/api-reference",
  },
  { path: "/roadmap", title: "Roadmap · decentralised.art", canonical: "/roadmap" },
  { path: "/studio", title: "Studio · decentralised.art", canonical: "/studio" },
];

for (const { path, title, canonical } of pages) {
  test(`serves head tags for ${path} without JavaScript`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const html = await response.text();

    expect(html).toContain(`<title>${title}</title>`);
    expect(html).toMatch(/<meta name="description" content="[^"]+/);
    expect(html).toContain(`<link rel="canonical" href="https://decentralised.art${canonical}"`);
    expect(html).toContain('property="og:image" content="https://decentralised.art/og-image.png"');
  });
}

test("serves documentation content and structured data without JavaScript", async ({ request }) => {
  const html = await (await request.get("/sdk")).text();

  expect(html).toMatch(/<h1[^>]*>\s*SDK\s*<\/h1>/);
  expect(html).toContain("is a typed client for the chain API");
  expect(html).toContain('"@type":"TechArticle"');
});

test("does not tell crawlers that no Worlds exist before they load", async ({ request }) => {
  const html = await (await request.get("/")).text();

  expect(html).not.toContain("No Worlds have been published yet.");
  expect(html).toContain('"@type":"Organization"');
});

test("publishes robots.txt and sitemap.xml", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Sitemap: https://decentralised.art/sitemap.xml");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.headers()["content-type"]).toContain("xml");
  expect(await sitemap.text()).toContain("<loc>https://decentralised.art/sdk</loc>");
});

test("redirects legacy URLs on the server", async ({ request }) => {
  for (const [from, to] of [
    ["/documentation", "/api-reference"],
    ["/tutorial", "/about"],
    ["/network", "/studio"],
  ]) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(response.status());
    expect(response.headers()["location"]).toBe(to);
  }
});
