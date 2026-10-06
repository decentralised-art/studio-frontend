import { expect, test } from "@playwright/test";

// Crawlers, AI agents and link previews read the HTML without running
// JavaScript, so these checks use plain HTTP requests.

const pages = [
  { path: "/", title: "decentralised.art · Collective performative intelligence", canonical: "/" },
  { path: "/worlds", title: "Worlds · decentralised.art", canonical: "/" },
  { path: "/about", title: "About · decentralised.art", canonical: "/about" },
  { path: "/tutorial", title: "Tutorial · decentralised.art", canonical: "/tutorial" },
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

  expect(robots).toContain("https://decentralised.art/llms.txt");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.headers()["content-type"]).toContain("xml");
  const urls = await sitemap.text();
  expect(urls).toContain("<loc>https://decentralised.art/sdk</loc>");
  expect(urls).toContain("<loc>https://decentralised.art/tutorial</loc>");
  expect(urls).toContain("<loc>https://decentralised.art/llms.txt</loc>");
  expect(urls).not.toContain(".md</loc>");
});

test("links the agent docs from the footer and the MCP and API reference pages", async ({
  request,
}) => {
  for (const path of ["/about", "/mcp", "/api-reference"]) {
    const html = await (await request.get(path)).text();
    // Prerendered links are relative ("./llms.txt").
    expect(html).toMatch(/<a href="\.?\/llms\.txt"[^>]*>llms\.txt<\/a>/);
  }
  expect(await (await request.get("/mcp.md")).text()).toContain(
    "[llms.txt](https://decentralised.art/llms.txt)",
  );
});

test("redirects legacy URLs on the server", async ({ request }) => {
  for (const [from, to] of [
    ["/documentation", "/api-reference"],
    ["/tutorial/intro", "/tutorial"],
    ["/network", "/studio"],
  ]) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(response.status());
    expect(response.headers()["location"]).toBe(to);
  }
});

test("publishes llms.txt linking the markdown docs and the OpenAPI specification", async ({
  request,
}) => {
  const llms = await request.get("/llms.txt");
  expect(llms.status()).toBe(200);
  const body = await llms.text();

  expect(body).toMatch(/^# decentralised\.art\n\n> /);
  for (const path of [
    "/mcp.md",
    "/sdk.md",
    "/api-reference.md",
    "/about.md",
    "/tutorial.md",
    "/roadmap.md",
  ]) {
    expect(body).toContain(`](https://decentralised.art${path}): `);
  }
  expect(body).toContain("https://decentralised.art/openapi/chain.json");
  expect(body).toContain("https://decentralised.art/llms-full.txt");
});

test("serves docs pages as markdown with every code language", async ({ request }) => {
  const response = await request.get("/sdk.md");
  expect(response.headers()["content-type"]).toContain("text/markdown");
  const markdown = await response.text();

  expect(markdown).toMatch(/^# SDK\n/);
  expect(markdown).toContain("JavaScript:\n\n```ts");
  expect(markdown).toContain("Python:\n\n```python");
  expect(markdown).not.toContain("On this page");
  expect((await request.get("/studio.md")).status()).toBe(404);

  const full = await (await request.get("/llms-full.txt")).text();
  expect(full).toContain("# MCP");
  expect(full).toContain("# API reference");
  expect(full).toContain("# Tutorial");
});

test("serves the tutorial as readable HTML and markdown without JavaScript", async ({
  request,
}) => {
  const html = await (await request.get("/tutorial")).text();
  expect(html).toMatch(/<h1[^>]*>\s*Tutorial\s*<\/h1>/);
  expect(html).toContain(
    '<link rel="alternate" type="text/markdown" href="https://decentralised.art/tutorial.md"',
  );

  const response = await request.get("/tutorial.md");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/markdown");
  const markdown = await response.text();
  expect(markdown).toMatch(/^# Tutorial\n/);
  expect(markdown).toMatch(/palette/i);
  expect(markdown).toMatch(/condition/i);
  expect(markdown).toContain("https://decentralised.art/mcp");
  expect(markdown).not.toContain("On this page");

  // Every route must be available to agents, including the tabs hidden in the UI.
  for (const heading of [
    "### Run four values in Studio",
    "### Run four values with your agent",
    "### Run four values with API calls",
    "### Run four values with the SDK",
    "## Create your own transformations and conditions",
    "## Practise on Sepolia. What changes on Mainnet?",
    "## How makers shape an economy",
  ]) {
    expect(markdown).toContain(heading);
  }
  expect(markdown).toContain("JavaScript:\n\n```ts");
  expect(markdown).toContain("Python:\n\n```python");
  expect(markdown).toContain("tutorial_threshold_pass_v1");
  expect(markdown).toContain("tutorial_threshold_fail_v1");
  expect(markdown).toContain("tutorial_divisible_pass_v1");
  expect(markdown).toContain("tutorial_divisible_fail_v1");
  expect(markdown).toContain("Execution rejected: Condition not met");
  expect(markdown).toContain("return (x + 1) % 4;");
  expect(markdown).toContain("https://decentralised.art/sdk#worlds");

  const full = await request.get("/llms-full.txt");
  expect(full.status()).toBe(200);
  // Check the complete export, rather than only finding its title in the bundle.
  expect(await full.text()).toContain(markdown.trim());
});

test("links each docs page to its markdown version", async ({ request }) => {
  const html = await (await request.get("/mcp")).text();
  expect(html).toContain(
    '<link rel="alternate" type="text/markdown" href="https://decentralised.art/mcp.md"',
  );
});

test("serves the chain API OpenAPI specification", async ({ request }) => {
  const spec = await (await request.get("/openapi/chain.json")).json();
  expect(spec.openapi).toMatch(/^3\./);
  expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
});
