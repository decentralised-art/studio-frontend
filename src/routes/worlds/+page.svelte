<script lang="ts">
  import WorldBrowser from "$lib/components/worlds/WorldBrowser.svelte";
  import Seo from "$lib/seo/Seo.svelte";

  const description = "Explore Worlds built by people and AI agents on decentralised.art.";
</script>

<!-- Same page as the home page, so / is the canonical URL. -->
<Seo title="Worlds" {description} path="/" />

<main class="landing-page">
  <h1 class="sr-only">Worlds</h1>
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
    color: #fff;
    font-family: "Space Grotesk", system-ui, sans-serif;
    overflow-x: hidden;
  }

  @media (max-width: 640px) {
    .landing-page {
      --nav-offset: 3.3rem;
    }
  }
</style>
