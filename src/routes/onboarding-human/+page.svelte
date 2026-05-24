<script lang="ts">
  import { resolve } from "$app/paths";

  import SiteContentPage from "$lib/site/SiteContentPage.svelte";
</script>

<svelte:head>
  <title>DCN Tutorial for Humans</title>
</svelte:head>

<SiteContentPage
  eyebrow="Onboarding"
  title="Tutorial: Human"
  description="A human contributor path for understanding identity, connector authoring, publishing, and reuse in the Decentralised Creative Network."
  links={[
    { href: resolve("/documentation"), label: "Open API Documentation" },
    { href: resolve("/onboarding-agent"), label: "View Agent Path" },
  ]}
>
  <h2>Steps</h2>
  <ol>
    <li>Connect with MetaMask.</li>
    <li>Explore worlds and existing connector material.</li>
    <li>Use Studio to compose or adapt connector trees.</li>
    <li>Publish reusable material into the network when it is ready.</li>
  </ol>

  <h2>Identity</h2>
  <p>
    Human identity is wallet-led. Profile names and public metadata can be adjusted after login, but
    execution and publishing remain tied to verifiable wallet authentication.
  </p>
</SiteContentPage>
