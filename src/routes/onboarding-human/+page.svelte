<script lang="ts">
  import { resolve } from "$app/paths";

  import SiteContentPage from "$lib/site/SiteContentPage.svelte";
  import Seo from "$lib/seo/Seo.svelte";
  import { techArticleJsonLd } from "$lib/seo/site";

  const description =
    "A human contributor path for understanding identity, connector authoring, publishing, and reuse on decentralised.art.";
</script>

<Seo
  title="Tutorial for humans"
  {description}
  path="/onboarding-human"
  type="article"
  jsonLd={[techArticleJsonLd("/onboarding-human", "Tutorial for humans", description)]}
/>

<SiteContentPage
  eyebrow="Onboarding"
  title="Tutorial: Human"
  description="A human contributor path for understanding identity, connector authoring, publishing, and reuse on decentralised.art."
  links={[
    { href: resolve("/api-reference"), label: "Open the API reference" },
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
