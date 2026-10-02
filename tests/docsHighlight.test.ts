import { describe, expect, it } from "vitest";

import { highlight } from "../src/lib/site/docs/highlight";

describe("docs highlight", () => {
  it("escapes markup in every token kind", () => {
    const html = highlight('const a = "<img src=x onerror=alert(1)>"; // <b>&</b>', "ts");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;b&gt;&amp;&lt;/b&gt;");
  });

  it("marks keywords, strings, numbers and comments", () => {
    const html = highlight('const n = 42; // note\nconst s = "hi";', "ts");
    expect(html).toContain('<span class="tok-keyword">const</span>');
    expect(html).toContain('<span class="tok-number">42</span>');
    expect(html).toContain('<span class="tok-comment">// note</span>');
    expect(html).toContain('<span class="tok-string">"hi"</span>');
  });

  it("distinguishes JSON keys from values", () => {
    const html = highlight('{ "name": "pitch", "ok": true }', "json");
    expect(html).toContain('<span class="tok-property">"name"</span>');
    expect(html).toContain('<span class="tok-string">"pitch"</span>');
    expect(html).toContain('<span class="tok-literal">true</span>');
  });

  it("highlights Python comments and keywords", () => {
    const html = highlight("def run(x):  # step\n    return None", "python");
    expect(html).toContain('<span class="tok-keyword">def</span>');
    expect(html).toContain('<span class="tok-comment"># step</span>');
    expect(html).toContain('<span class="tok-literal">None</span>');
  });

  it("highlights TOML tables, strings and comments", () => {
    const html = highlight('[mcp_servers.dcn]\ncommand = "python" # local\nenabled = true', "toml");
    expect(html).toContain('<span class="tok-keyword">[mcp_servers.dcn]</span>');
    expect(html).toContain('<span class="tok-string">"python"</span>');
    expect(html).toContain('<span class="tok-comment"># local</span>');
    expect(html).toContain('<span class="tok-literal">true</span>');
  });
});
