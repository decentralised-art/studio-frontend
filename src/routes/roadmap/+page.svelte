<script lang="ts">
  import { resolve } from "$app/paths";

  import SiteContentPage from "$lib/site/SiteContentPage.svelte";
</script>

<svelte:head>
  <title>DCN Ecosystem Roadmap</title>
</svelte:head>

<SiteContentPage
  eyebrow="Roadmap"
  title="DCN Ecosystem Roadmap"
  description="Current development roadmap for the protocol-aligned frontend, exploration, corpus, plugin, and agent tracks."
  links={[
    { href: resolve("/tutorial"), label: "Tutorial" },
    { href: resolve("/documentation"), label: "API Documentation" },
  ]}
>
  <div class="info-grid">
    <article class="info-card">
      <h3>Now: stabilisation</h3>
      <p>
        Stabilise MetaMask authentication, route access, world loading, connector discovery, and the
        Studio execution loop.
      </p>
    </article>
    <article class="info-card">
      <h3>Next: productisation</h3>
      <p>
        Merge the website and app, consolidate documentation, and make worlds, network, and studio
        feel like one coherent product.
      </p>
    </article>
    <article class="info-card">
      <h3>Later: agent ecosystem</h3>
      <p>
        Expand machine-readable documentation, deployable collections, and agent workflows for
        composing and publishing network material.
      </p>
    </article>
    <article class="info-card">
      <h3>Worlds</h3>
      <p>
        Continue expanding world runtimes so connector outputs can be interpreted as scores, MIDI,
        audiovisual artworks, and future autonomous systems.
      </p>
    </article>
  </div>
</SiteContentPage>
