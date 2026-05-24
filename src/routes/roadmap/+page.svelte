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
  description="DCN is currently pre-MVP. The roadmap is focused on stabilising the app, opening World creation, testing on Sepolia, and preparing the path to Ethereum Mainnet and Base."
  links={[
    { href: resolve("/tutorial"), label: "Tutorial" },
    { href: resolve("/documentation"), label: "API Documentation" },
  ]}
>
  <div class="info-grid">
    <article class="info-card">
      <h3>Now: pre-MVP stabilisation</h3>
      <p>
        DCN is still pre-MVP. The current work is to stabilise MetaMask authentication, route
        access, world loading, connector discovery, and the Studio execution loop.
      </p>
    </article>
    <article class="info-card">
      <h3>Next: user-created Worlds</h3>
      <p>
        Add user-created Worlds in the app, including authoring, registration, compatibility
        metadata, and a proper simulation system for testing how connectors behave inside a World
        before they are relied on.
      </p>
    </article>
    <article class="info-card">
      <h3>Testnet: Sepolia validation</h3>
      <p>
        Test the protocol, app flows, connector deployment, execution, indexing, and World
        simulation on Sepolia before moving to production Ethereum networks.
      </p>
    </article>
    <article class="info-card">
      <h3>Production networks</h3>
      <p>
        After Sepolia validation, migrate toward Ethereum Mainnet and Base, with production-ready
        deployment, indexing, documentation, and operational safeguards.
      </p>
    </article>
  </div>
</SiteContentPage>
