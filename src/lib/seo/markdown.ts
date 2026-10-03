import { parseHTML } from "linkedom";
import TurndownService from "turndown";

import { SITE_URL } from "$lib/seo/site";

export type MarkdownPage = {
  title: string;
  description: string;
  url: string;
  markdown: string;
};

const isElement = (node: Node): node is Element => node.nodeType === 1;

const createTurndown = (): TurndownService => {
  const service = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
  });

  service.remove(["script", "style", "noscript", "button", "canvas", "template", "iframe"]);
  service.remove((node) => node.nodeName.toLowerCase() === "svg");

  // CodeBlock renders every language; hidden tabs are kept as labelled fences.
  service.addRule("codeBlock", {
    filter: (node) => isElement(node) && node.hasAttribute("data-code-block"),
    replacement: (_content, node) => {
      const block = node as Element;
      const caption = block.getAttribute("data-code-caption");
      const samples = Array.from(block.querySelectorAll("pre[data-code-lang]")).map((pre) => {
        const label = pre.getAttribute("data-code-label");
        const lang = pre.getAttribute("data-code-lang") ?? "";
        const code = (pre.textContent ?? "").replace(/\n+$/, "");
        const fence = code.includes("```") ? "````" : "```";
        return `${label ? `${label}:\n\n` : ""}${fence}${lang}\n${code}\n${fence}`;
      });
      return `\n\n${caption ? `${caption}:\n\n` : ""}${samples.join("\n\n")}\n\n`;
    },
  });

  service.addRule("table", {
    filter: "table",
    replacement: (_content, node) => {
      const rows = Array.from((node as Element).querySelectorAll("tr")).map((row) =>
        Array.from(row.querySelectorAll("th, td")).map((cell) =>
          service
            .turndown(cell as HTMLElement)
            .replace(/\s*\n+\s*/g, " ")
            .replace(/\|/g, "\\|")
            .trim(),
        ),
      );
      if (rows.length === 0) return "";
      const width = Math.max(...rows.map((cells) => cells.length));
      const line = (cells: string[]) =>
        `| ${Array.from({ length: width }, (_, i) => cells[i] ?? "").join(" | ")} |`;
      const [head, ...body] = rows;
      return `\n\n${[line(head), line(Array(width).fill("---")), ...body.map(line)].join("\n")}\n\n`;
    },
  });

  return service;
};

const turndown = createTurndown();

/** Converts a rendered page to markdown, keeping only its [data-markdown-root] content. */
export const htmlToMarkdownPage = (html: string, path: string): MarkdownPage => {
  const { document } = parseHTML(html);
  const url = new URL(path, SITE_URL).href;
  const root = document.querySelector("[data-markdown-root]");
  if (!root) throw new Error(`${path} has no [data-markdown-root] element`);

  // Removed from the DOM rather than skipped by a rule, so list numbering ignores them.
  // aria-hidden content is decorative.
  for (const node of Array.from(
    root.querySelectorAll('[data-markdown-skip], [aria-hidden="true"]'),
  )) {
    node.remove();
  }

  // Links and images must work outside the site.
  for (const link of Array.from(root.querySelectorAll("a[href]"))) {
    link.setAttribute("href", new URL(link.getAttribute("href") ?? "", url).href);
  }
  for (const image of Array.from(root.querySelectorAll("img[src]"))) {
    image.setAttribute("src", new URL(image.getAttribute("src") ?? "", url).href);
  }

  // The short page name ("About"), not the page's headline.
  const title = document.title.split(" · ")[0].trim();
  const description =
    document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ?? "";
  const markdown = turndown
    .turndown(root as HTMLElement)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title, description, url, markdown: `${markdown}\n\nSource: ${url}\n` };
};
