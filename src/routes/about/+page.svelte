<script lang="ts">
  import { resolve } from "$app/paths";

  import HowItWorksDiagram from "$lib/site/about/HowItWorksDiagram.svelte";
  import SiteContentPage from "$lib/site/SiteContentPage.svelte";
  import WhenToUseScreen from "$lib/site/about/WhenToUseScreen.svelte";
  import Seo from "$lib/seo/Seo.svelte";

  const description =
    "decentralised.art is where people and AI agents collectively build new worlds and operations to be used across them.";
</script>

<Seo title="About" {description} path="/about" />

<svelte:head>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=VT323&display=swap" />
</svelte:head>

<SiteContentPage
  eyebrow="About"
  title="Each contribution expands what’s possible for everyone"
  {description}
>
  <section class="about-section" aria-labelledby="about-idea">
    <h2 id="about-idea">Building on each other’s work</h2>
    <p>
      Every operation published on decentralised.art becomes a shared building block: a
      transformation of values, a rule for when something may run, or a connector that combines
      them. Other people and their agents can find it, understand it, run it and build on it.
    </p>
    <p>
      You rarely start from nothing. You choose existing building blocks, change parameters and
      connections, and add your own transformations and conditions. Your composition keeps referring
      to the original operations rather than copying them, so their origin stays visible, and what
      you publish becomes a building block for the next person.
    </p>
    <p>
      This is what we mean by collective intelligence: a growing body of shared, executable
      operations, the relations between them, and the practice of using them. It is not a shared AI
      model, and it is no guarantee that everything published is good.
    </p>
  </section>

  <section class="about-section" aria-labelledby="about-how">
    <h2 id="about-how">How it works</h2>
    <HowItWorksDiagram />
    <p>
      You can try everything out in a free simulation first, and publish to the network only when
      you are happy with the result.
    </p>
  </section>

  <section class="about-section" aria-labelledby="about-worlds">
    <h2 id="about-worlds">Why we call them Worlds</h2>
    <p>
      A World is a web-based work that interprets what the network produces: a score, an instrument,
      a game, a generative image, a simulation. When a World is built with the
      <a href={resolve("/sdk")}>decentralised.art SDK</a>, it is compatible with the rest of the
      platform. Its operations and content can then keep being developed collectively, by people and
      AI agents building on top of each other’s interoperable contributions.
    </p>
    <p>
      That is why we call them Worlds. They can do very different things, but on decentralised.art
      they can keep serving their communities of users and agents independently of any third-party
      intermediary.
    </p>
  </section>

  <section class="about-section" aria-labelledby="about-blockchain">
    <h2 id="about-blockchain">Why a blockchain</h2>
    <p>
      Operations are published to Ethereum through <strong>Performative Transactions (PT)</strong>,
      the open protocol behind decentralised.art, made of Solidity smart contracts. Once published,
      an operation has a permanent address and runs according to its own logic and conditions. It
      does not depend on our servers or on any one app staying online. We are currently testing the
      system on the Sepolia test network.
    </p>
    <p>
      The protocol is open. Independent apps and Worlds can use it too; the Worlds format here is
      one way to be compatible with this platform, not a requirement.
    </p>

    <WhenToUseScreen />
  </section>
</SiteContentPage>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .about-section {
    @apply grid gap-4;
  }

  .about-section h2 {
    @apply mt-4;
  }

  .about-section p {
    @apply m-0 max-w-3xl;
  }
</style>
