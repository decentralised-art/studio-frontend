export const SITE_URL = "https://decentralised.art";
export const SITE_NAME = "decentralised.art";
export const SITE_DESCRIPTION =
  "decentralised.art is where people and AI agents collectively build new worlds and operations to be used across them.";
export const SITE_STRAPLINE = "Collective performative intelligence";
export const GITHUB_URL = "https://github.com/decentralised-art";

export const DEFAULT_OG_IMAGE = {
  url: `${SITE_URL}/og-image.png`,
  width: 1200,
  height: 630,
  alt: "decentralised.art",
} as const;

export type SeoImage = {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
};

export const absoluteUrl = (path: string): string => new URL(path, SITE_URL).href;

export const pageTitle = (title?: string): string =>
  title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} · ${SITE_STRAPLINE}`;

export const organizationJsonLd = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/favicon.svg`,
  sameAs: [GITHUB_URL],
} as const;

export const websiteJsonLd = {
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  description: SITE_DESCRIPTION,
  inLanguage: "en",
  publisher: { "@id": organizationJsonLd["@id"] },
} as const;

/** JSON-LD for a documentation page. */
export const techArticleJsonLd = (path: string, headline: string, description: string) => ({
  "@type": "TechArticle",
  "@id": `${absoluteUrl(path)}#article`,
  headline,
  description,
  url: absoluteUrl(path),
  inLanguage: "en",
  isPartOf: { "@id": websiteJsonLd["@id"] },
  publisher: { "@id": organizationJsonLd["@id"] },
});

/**
 * Pages listed in sitemap.xml. /worlds is omitted because it is the same page
 * as / and declares / as its canonical URL. llms.txt is listed so crawlers find
 * the agent docs; the .md pages are not, to avoid duplicates of the HTML pages.
 */
export const SITEMAP_PATHS = [
  "/",
  "/about",
  "/studio",
  "/sdk",
  "/mcp",
  "/api-reference",
  "/api-status",
  "/roadmap",
  "/onboarding-agent",
  "/onboarding-human",
  "/llms.txt",
] as const;

export const STUDIO_DESCRIPTION =
  "Studio is the decentralised.art workspace for browsing the network and creating, simulating and publishing operations and connectors.";

type FallbackHead = { title?: string; description: string; canonical: boolean };

/**
 * Head tags for pages rendered only in the browser (ssr = false). The server
 * response for those pages has no <title>, so hooks.server.ts injects these.
 */
export const fallbackHeadFor = (pathname: string): FallbackHead => {
  if (pathname === "/studio") {
    return {
      title: "Studio",
      description: STUDIO_DESCRIPTION,
      canonical: true,
    };
  }
  return { description: SITE_DESCRIPTION, canonical: false };
};
