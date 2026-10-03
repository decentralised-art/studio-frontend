<script lang="ts">
  import { onMount } from "svelte";

  import {
    absoluteUrl,
    DEFAULT_OG_IMAGE,
    pageTitle,
    SITE_NAME,
    type SeoImage,
  } from "$lib/seo/site";

  type Props = {
    /** Page title without the site suffix; omit for the home page. */
    title?: string;
    description: string;
    /** Canonical path, e.g. "/sdk". */
    path: string;
    type?: "website" | "article";
    image?: SeoImage;
    jsonLd?: Record<string, unknown>[];
    /** Path of the page's markdown version for AI agents, e.g. "/sdk.md". */
    markdownPath?: string;
  };

  const {
    title,
    description,
    path,
    type = "website",
    image = DEFAULT_OG_IMAGE,
    jsonLd = [],
    markdownPath,
  }: Props = $props();

  // Browser-only pages arrive with fallback tags from hooks.server.ts; this
  // component's tags replace them. The <title> element stays: Svelte updates it.
  onMount(() => {
    document.head
      .querySelectorAll("meta[data-seo-fallback], link[data-seo-fallback]")
      .forEach((node) => node.remove());
  });

  const fullTitle = $derived(pageTitle(title));
  const url = $derived(absoluteUrl(path));
  // Escape "<" so page content can never close the script element early.
  const jsonLdScript = $derived(
    jsonLd.length
      ? `<script type="application/ld+json">${JSON.stringify({
          "@context": "https://schema.org",
          "@graph": jsonLd,
        }).replace(/</g, "\\u003c")}</` + "script>"
      : "",
  );
</script>

<svelte:head>
  <title>{fullTitle}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={url} />
  {#if markdownPath}
    <link rel="alternate" type="text/markdown" href={absoluteUrl(markdownPath)} />
  {/if}
  <meta property="og:type" content={type} />
  <meta property="og:site_name" content={SITE_NAME} />
  <meta property="og:locale" content="en_US" />
  <meta property="og:title" content={fullTitle} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={url} />
  <meta property="og:image" content={image.url} />
  {#if image.width && image.height}
    <meta property="og:image:width" content={String(image.width)} />
    <meta property="og:image:height" content={String(image.height)} />
  {/if}
  {#if image.alt}
    <meta property="og:image:alt" content={image.alt} />
  {/if}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={fullTitle} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={image.url} />
  {#if jsonLdScript}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON.stringify output with "<" escaped -->
    {@html jsonLdScript}
  {/if}
</svelte:head>
