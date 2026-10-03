<script lang="ts">
  import WorldBrowser from "$lib/components/worlds/WorldBrowser.svelte";
  import Seo from "$lib/seo/Seo.svelte";
  import {
    organizationJsonLd,
    SITE_DESCRIPTION,
    SITE_NAME,
    SITE_STRAPLINE,
    websiteJsonLd,
  } from "$lib/seo/site";
</script>

<Seo description={SITE_DESCRIPTION} path="/" jsonLd={[organizationJsonLd, websiteJsonLd]} />

<main class="landing-page">
  <h1 class="sr-only">{SITE_NAME}: {SITE_STRAPLINE}</h1>
  <WorldBrowser />
</main>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .landing-page {
    position: relative;
    --nav-offset: 3.5rem;
    min-height: 100vh;
    margin-top: calc(-1 * var(--nav-offset));
    background: #070b0e;
    color: #ffffff;
    font-family: "Space Grotesk", system-ui, sans-serif;
    overflow-x: hidden;
  }

  @media (max-width: 640px) {
    .landing-page {
      --nav-offset: 3.3rem;
    }
  }
</style>
