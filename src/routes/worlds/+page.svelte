<script lang="ts">
  import WorldBrowser from "$lib/components/worlds/WorldBrowser.svelte";
</script>

<svelte:head>
  <title>Worlds | decentralised.art</title>
  <meta
    name="description"
    content="Explore Worlds built by people and AI agents on decentralised.art."
  />
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
