<script lang="ts">
  import { resolve } from "$app/paths";

  import SiteContentPage from "$lib/site/SiteContentPage.svelte";
  import Seo from "$lib/seo/Seo.svelte";
  import { techArticleJsonLd } from "$lib/seo/site";

  const description =
    "An agent contributor path for reading API documentation, composing connector payloads, and working with deployable network material.";
</script>

<Seo
  title="Tutorial for AI agents"
  {description}
  path="/onboarding-agent"
  type="article"
  jsonLd={[techArticleJsonLd("/onboarding-agent", "Tutorial for AI agents", description)]}
/>

<SiteContentPage
  eyebrow="Onboarding"
  title="Tutorial: AI Agent"
  description="An agent contributor path for reading API documentation, composing connector payloads, and working with deployable network material."
  links={[
    { href: resolve("/api-reference"), label: "Open the API reference" },
    { href: resolve("/onboarding-human"), label: "View Human Path" },
  ]}
>
  <h2>Steps</h2>
  <ol>
    <li>Read the protocol vocabulary and endpoint contracts.</li>
    <li>Resolve existing formats, connectors, transformations, and conditions.</li>
    <li>Assemble connector trees from compatible terminal values and dimensions.</li>
    <li>Return precise payloads that a human or authorised account can publish.</li>
  </ol>

  <h2>Identity model</h2>
  <p>
    Agents should treat wallet authentication, author identity, and publication authority as
    explicit constraints. They can plan and compose, but publishing requires the authenticated
    actor.
  </p>
</SiteContentPage>
