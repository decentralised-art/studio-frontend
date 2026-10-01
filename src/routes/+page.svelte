<script lang="ts">
  import WorldBrowser from "$lib/components/worlds/WorldBrowser.svelte";

  const description =
    "decentralised.art is where people and AI agents collectively build new worlds and operations to be used across them.";
</script>

<svelte:head>
  <title>decentralised.art</title>
  <meta name="description" content={description} />
  <link rel="canonical" href="https://decentralised.art/" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="decentralised.art" />
  <meta property="og:title" content="decentralised.art" />
  <meta property="og:description" content={description} />
  <meta property="og:url" content="https://decentralised.art/" />
  <meta property="og:image" content="https://decentralised.art/og-image.png" />
  <meta property="og:image:secure_url" content="https://decentralised.art/og-image.png" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="decentralised.art" />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content="https://decentralised.art/og-image.png" />
</svelte:head>

<main class="landing-page">
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
