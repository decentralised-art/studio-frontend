import { describe, expect, it } from "vitest";

import { isMarkdownPageSlug, MARKDOWN_PAGES, markdownPath } from "../src/lib/seo/agentDocs";
import { htmlToMarkdownPage } from "../src/lib/seo/markdown";

const page = (body: string) => `<!doctype html>
<html><head>
  <title>SDK · decentralised.art</title>
  <meta name="description" content="Official SDKs." />
</head><body>
  <header class="site-nav"><a href="/">decentralised.art</a></header>
  <main data-markdown-root>
    <p data-markdown-skip>Docs</p>
    <h1>SDK</h1>
    ${body}
  </main>
  <footer>© decentralised.art</footer>
</body></html>`;

describe("htmlToMarkdownPage", () => {
  it("keeps only the marked content and takes metadata from the page", () => {
    const result = htmlToMarkdownPage(page("<p>Hello.</p>"), "/sdk");

    expect(result.title).toBe("SDK");
    expect(result.description).toBe("Official SDKs.");
    expect(result.url).toBe("https://decentralised.art/sdk");
    expect(result.markdown).toBe("# SDK\n\nHello.\n\nSource: https://decentralised.art/sdk\n");
  });

  it("drops skipped and aria-hidden content without breaking list numbering", () => {
    const html = page(`<ol>
      <li>One</li>
      <li aria-hidden="true"></li>
      <li>Two</li>
    </ol>`);
    const { markdown } = htmlToMarkdownPage(html, "/sdk");

    expect(markdown).toMatch(/1\.\s+One\n2\.\s+Two/);
    expect(markdown).not.toContain("Docs");
  });

  it("writes every code tab as a labelled fence and keeps captions", () => {
    const html = page(`
      <div class="code-block" data-code-block>
        <div class="code-bar" data-markdown-skip><button>JavaScript</button></div>
        <pre data-code-label="JavaScript" data-code-lang="ts"><code><span>const a = 1;</span></code></pre>
        <pre hidden data-code-label="Python" data-code-lang="python"><code>a = 1</code></pre>
      </div>
      <div class="code-block" data-code-block data-code-caption="Request">
        <pre data-code-lang="bash"><code>curl /version</code></pre>
      </div>`);
    const { markdown } = htmlToMarkdownPage(html, "/sdk");

    expect(markdown).toContain("JavaScript:\n\n```ts\nconst a = 1;\n```");
    expect(markdown).toContain("Python:\n\n```python\na = 1\n```");
    expect(markdown).toContain("Request:\n\n```bash\ncurl /version\n```");
  });

  it("converts tables and makes links absolute", () => {
    const html = page(`
      <p>See <a href="/mcp#tools">MCP tools</a> and <a href="#install">install</a>.</p>
      <table>
        <thead><tr><th>Variable</th><th>Default</th></tr></thead>
        <tbody><tr><td><code>API_BASE</code></td><td>a | b</td></tr></tbody>
      </table>`);
    const { markdown } = htmlToMarkdownPage(html, "/sdk");

    expect(markdown).toContain("[MCP tools](https://decentralised.art/mcp#tools)");
    expect(markdown).toContain("[install](https://decentralised.art/sdk#install)");
    expect(markdown).toContain("| Variable | Default |\n| --- | --- |\n| `API_BASE` | a \\| b |");
  });

  it("fails loudly when a page has no marked content", () => {
    expect(() => htmlToMarkdownPage("<html><body><p>x</p></body></html>", "/x")).toThrow(
      "/x has no [data-markdown-root] element",
    );
  });
});

describe("markdown pages", () => {
  it("only matches the published pages", () => {
    expect(MARKDOWN_PAGES.map(({ slug }) => markdownPath(slug))).toContain("/sdk.md");
    expect(isMarkdownPageSlug("sdk")).toBe(true);
    expect(isMarkdownPageSlug("studio")).toBe(false);
  });
});
