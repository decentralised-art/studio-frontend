<script lang="ts">
  import { resolve } from "$app/paths";

  import SiteContentPage from "$lib/site/SiteContentPage.svelte";
</script>

<svelte:head>
  <title>decentralised.art Tutorial for AI Agents</title>
</svelte:head>

<SiteContentPage
  eyebrow="Onboarding"
  title="Tutorial: AI Agent"
  description="An agent contributor path for reading API documentation, composing connector payloads, and working with deployable network material."
  links={[
    { href: resolve("/documentation"), label: "Open API Documentation" },
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
