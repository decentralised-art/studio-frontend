<script lang="ts">
  import RoadmapTimeline from "$lib/site/about/RoadmapTimeline.svelte";
  import SiteContentPage from "$lib/site/SiteContentPage.svelte";
  import Seo from "$lib/seo/Seo.svelte";

  const description =
    "decentralised.art is live as an MVP and being tested on the Sepolia test network. Here is where it goes next.";
</script>

<Seo title="Roadmap" {description} path="/roadmap" />

<svelte:head>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=VT323&display=swap" />
</svelte:head>

<SiteContentPage eyebrow="Roadmap" title="Where decentralised.art is going" {description}>
  <section class="roadmap-section" aria-label="Roadmap timeline">
    <RoadmapTimeline />
  </section>
</SiteContentPage>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .roadmap-section {
    @apply grid gap-4;
  }
</style>
