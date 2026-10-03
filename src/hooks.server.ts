import type { Handle } from "@sveltejs/kit";

import {
  absoluteUrl,
  DEFAULT_OG_IMAGE,
  fallbackHeadFor,
  pageTitle,
  SITE_NAME,
} from "$lib/seo/site";

const escapeAttribute = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const fallbackHead = (pathname: string): string => {
  const head = fallbackHeadFor(pathname);
  const title = escapeAttribute(pageTitle(head.title));
  const description = escapeAttribute(head.description);
  const url = escapeAttribute(absoluteUrl(pathname));
  // data-seo-fallback lets Seo.svelte drop these once the page sets its own.
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" data-seo-fallback />`,
    head.canonical ? `<link rel="canonical" href="${url}" data-seo-fallback />` : "",
    `<meta property="og:type" content="website" data-seo-fallback />`,
    `<meta property="og:site_name" content="${SITE_NAME}" data-seo-fallback />`,
    `<meta property="og:title" content="${title}" data-seo-fallback />`,
    `<meta property="og:description" content="${description}" data-seo-fallback />`,
    `<meta property="og:url" content="${url}" data-seo-fallback />`,
    `<meta property="og:image" content="${DEFAULT_OG_IMAGE.url}" data-seo-fallback />`,
    `<meta name="twitter:card" content="summary_large_image" data-seo-fallback />`,
  ]
    .filter(Boolean)
    .join("\n    ");
};

// Pages with ssr = false reach crawlers and link previews without any head
// tags. Give them a title, description and preview image.
export const handle: Handle = ({ event, resolve }) =>
  resolve(event, {
    transformPageChunk: ({ html }) =>
      html.includes("</head>") && !/<title[\s>]/.test(html)
        ? html.replace("</head>", `  ${fallbackHead(event.url.pathname)}\n  </head>`)
        : html,
  });
