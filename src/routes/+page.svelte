<script lang="ts">
  import { onMount } from "svelte";

  import LandingHero from "$lib/site/LandingHero.svelte";

  let whenSection: HTMLElement | null = null;

  onMount(() => {
    const section = whenSection;
    if (!section) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    let frame: number | null = null;
    let isListening = false;

    const setVisuals = (progress: number) => {
      const p = clamp(progress, 0, 1);
      const scale = 0.96 + p * 0.04;
      const opacity = 0.8 + p * 0.2;
      section.style.setProperty("--landing-when-scale", scale.toFixed(4));
      section.style.setProperty("--landing-when-opacity", opacity.toFixed(4));
    };

    const updateFromViewport = () => {
      frame = null;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const start = vh * 0.95;
      const end = vh * 0.18;
      const progress = (start - rect.top) / (start - end);
      setVisuals(progress);
    };

    const requestUpdate = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(updateFromViewport);
    };

    const addListeners = () => {
      if (isListening) return;
      isListening = true;
      window.addEventListener("scroll", requestUpdate, { passive: true });
      window.addEventListener("resize", requestUpdate);
    };

    const removeListeners = () => {
      if (!isListening) return;
      isListening = false;
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };

    const applyMotionMode = () => {
      if (prefersReducedMotion.matches) {
        removeListeners();
        setVisuals(1);
        return;
      }
      addListeners();
      requestUpdate();
    };

    applyMotionMode();
    prefersReducedMotion.addEventListener("change", applyMotionMode);

    return () => {
      removeListeners();
      prefersReducedMotion.removeEventListener("change", applyMotionMode);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  });
</script>

<svelte:head>
  <title>decentralised.art</title>
  <meta
    name="description"
    content="A decentralised platform for worlds as artworks and reusable intelligence across them."
  />
  <link rel="canonical" href="https://decentralised.art/" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="decentralised.art" />
  <meta property="og:title" content="decentralised.art" />
  <meta
    property="og:description"
    content="A decentralised platform for worlds as artworks and reusable intelligence across them."
  />
  <meta property="og:url" content="https://decentralised.art/" />
  <meta property="og:image" content="https://decentralised.art/og-image.png" />
  <meta property="og:image:secure_url" content="https://decentralised.art/og-image.png" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="decentralised.art" />
  <meta
    name="twitter:description"
    content="A decentralised platform for worlds as artworks and reusable intelligence across them."
  />
  <meta name="twitter:image" content="https://decentralised.art/og-image.png" />
</svelte:head>

<main class="page landing-page">
  <LandingHero />

  <div class="minimal-wrap landing-wrap">
    <section
      id="when-do-i-want-dcn"
      class="minimal-section landing-when-animated"
      bind:this={whenSection}
    >
      <div class="tutorial-when-block">
        <div class="tutorial-when-intro">
          <h2>When do I want to use decentralised.art?</h2>
          <p>
            You use decentralised.art when you want behaviours to outlive apps, teams, and servers.
            When you care that an operation keeps working tomorrow, under explicit conditions, with
            no third party deciding whether it still runs.
          </p>
        </div>

        <ol class="tutorial-criteria-grid">
          <li class="tutorial-criteria-card">
            <span class="tutorial-criteria-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="7"></circle>
                <path d="M12 8.5v4l2.6 1.8"></path>
              </svg>
            </span>
            <div class="tutorial-criteria-content">
              <h3>Persistence matters</h3>
              <p>
                You want the operation to remain available as a stable reference (an address), not a
                link to a repo or a server that can disappear.
              </p>
            </div>
          </li>

          <li class="tutorial-criteria-card">
            <span class="tutorial-criteria-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 3l7 3.5V12c0 4.2-2.6 6.9-7 8.9C7.6 18.9 5 16.2 5 12V6.5L12 3z"></path>
                <path d="m9.3 12.3 1.9 1.9 3.5-3.5"></path>
              </svg>
            </span>
            <div class="tutorial-criteria-content">
              <h3>Autonomy matters</h3>
              <p>
                You want execution to depend on the operation's own logic and conditions, not on
                platform admins, service uptime, or API policy changes.
              </p>
            </div>
          </li>

          <li class="tutorial-criteria-card">
            <span class="tutorial-criteria-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M5 6h14"></path>
                <path d="M5 12h14"></path>
                <path d="M5 18h14"></path>
                <circle cx="9" cy="6" r="1.8"></circle>
                <circle cx="15" cy="12" r="1.8"></circle>
                <circle cx="11" cy="18" r="1.8"></circle>
              </svg>
            </span>
            <div class="tutorial-criteria-content">
              <h3>Conditioning matters</h3>
              <p>
                You need behaviours that trigger or constrain actions based on time, state,
                permissions, thresholds, identity, payments, governance signals, or external event
                feeds.
              </p>
            </div>
          </li>

          <li class="tutorial-criteria-card">
            <span class="tutorial-criteria-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M10 8.6 8.2 6.8a3 3 0 1 0-4.2 4.2l1.8 1.8a3 3 0 0 0 4.2 0l1.7-1.7"></path>
                <path d="m14 15.4 1.8 1.8a3 3 0 1 0 4.2-4.2l-1.8-1.8a3 3 0 0 0-4.2 0L12.3 13"
                ></path>
              </svg>
            </span>
            <div class="tutorial-criteria-content">
              <h3>Composability matters</h3>
              <p>
                You expect many small mechanisms to be chained through dependencies, forks, and
                reuse into larger constellations.
              </p>
            </div>
          </li>

          <li class="tutorial-criteria-card">
            <span class="tutorial-criteria-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="7" cy="7.6" r="2.1"></circle>
                <circle cx="17" cy="7.6" r="2.1"></circle>
                <path d="M3.7 17c.5-2.2 1.9-3.4 3.3-3.4s2.8 1.2 3.3 3.4"></path>
                <path d="M13.7 17c.5-2.2 1.9-3.4 3.3-3.4s2.8 1.2 3.3 3.4"></path>
              </svg>
            </span>
            <div class="tutorial-criteria-content">
              <h3>Multi-author contribution matters (humans + agents)</h3>
              <p>
                You want many contributors to add interoperable modules, and agents to assemble them
                through an API.
              </p>
            </div>
          </li>
        </ol>
      </div>
    </section>
  </div>
</main>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .page {
    min-height: 100vh;
  }

  .landing-page {
    --nav-offset: 3.5rem;
    margin-top: calc(-1 * var(--nav-offset));
    background: var(--surface-page);
    color: var(--text-primary);
    font-family: "Space Grotesk", system-ui, sans-serif;
    overflow-x: hidden;
  }

  .minimal-wrap {
    max-width: 64rem;
    margin-left: auto;
    margin-right: auto;
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .landing-wrap {
    max-width: 1020px;
  }

  .minimal-section {
    padding-top: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  .landing-when-animated {
    --landing-when-scale: 1;
    --landing-when-opacity: 1;
    transform-origin: center top;
    transform: scale(var(--landing-when-scale));
    opacity: var(--landing-when-opacity);
    will-change: transform, opacity;
  }

  .landing-page #when-do-i-want-dcn {
    padding-top: 1.75rem;
    padding-bottom: 4rem;
  }

  .landing-page #when-do-i-want-dcn .tutorial-when-block {
    margin-top: 0;
  }

  .tutorial-when-block {
    margin-top: 2.35rem;
    padding: 1.05rem;
    border: 1px solid var(--border-subtle);
    border-radius: 0.9rem;
    background:
      radial-gradient(circle at 10% -10%, rgba(103, 214, 255, 0.08), transparent 40%),
      radial-gradient(circle at 105% 15%, rgba(247, 200, 106, 0.08), transparent 45%),
      linear-gradient(180deg, var(--surface-panel-strong) 0%, var(--surface-panel) 100%);
  }

  .tutorial-when-intro {
    max-width: 860px;
    margin-bottom: 0.9rem;
  }

  .tutorial-when-intro h2 {
    margin: 0;
    color: var(--text-primary);
    font-family: "Syne", "Space Grotesk", system-ui, sans-serif;
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.25;
    letter-spacing: 0;
  }

  .tutorial-when-intro p {
    margin: 0.45rem 0 0 0;
    color: var(--text-secondary);
    font-size: 0.93rem;
    line-height: 1.56;
  }

  .tutorial-criteria-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.68rem;
    grid-template-columns: minmax(0, 1fr);
  }

  .tutorial-criteria-card {
    --criteria-accent: #2ea7d6;
    --criteria-soft: color-mix(in srgb, var(--criteria-accent) 18%, transparent);
    margin: 0 !important;
    border: 1px solid var(--border-subtle);
    position: relative;
    border-radius: 0.75rem;
    padding: 0.78rem 0.82rem;
    background: var(--surface-card);
    box-shadow: var(--shadow-soft);
    transition:
      transform 180ms ease,
      box-shadow 180ms ease,
      border-color 180ms ease;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.72rem;
    align-items: start;
  }

  .tutorial-criteria-card::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    border-radius: 0.75rem 0 0 0.75rem;
    background: var(--criteria-accent);
  }

  .tutorial-criteria-card:nth-child(2) {
    --criteria-accent: #c9992e;
  }

  .tutorial-criteria-card:nth-child(3) {
    --criteria-accent: #d66a48;
  }

  .tutorial-criteria-card:nth-child(4) {
    --criteria-accent: #4fa96a;
  }

  .tutorial-criteria-card:nth-child(5) {
    --criteria-accent: #4a7fc8;
  }

  .tutorial-criteria-card:hover {
    transform: translateY(-2px);
    border-color: var(--border-strong);
    box-shadow: var(--shadow-glow);
  }

  .tutorial-criteria-icon {
    width: 2rem;
    height: 2rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.55rem;
    color: var(--criteria-accent);
    background: var(--criteria-soft);
    border: 1px solid var(--border-subtle);
    margin-top: 0.02rem;
  }

  .tutorial-criteria-icon svg {
    width: 1.1rem;
    height: 1.1rem;
    stroke: currentColor;
  }

  .tutorial-criteria-content {
    min-width: 0;
  }

  .tutorial-criteria-card h3 {
    margin: 0 0 0.28rem 0;
    font-size: 0.9rem;
    line-height: 1.25;
    color: var(--criteria-accent) !important;
    font-family: "Syne", "Space Grotesk", system-ui, sans-serif;
    font-weight: 600;
    letter-spacing: 0;
  }

  .tutorial-criteria-card p {
    margin: 0;
    font-size: 0.84rem;
    line-height: 1.47;
    color: var(--text-secondary) !important;
  }

  :global(:root[data-theme="light"]) .landing-page {
    background: #ffffff;
    color: #111111;
  }

  :global(:root[data-theme="light"]) .minimal-section {
    border-bottom-color: #ececec;
  }

  :global(:root[data-theme="light"]) .tutorial-when-block {
    border-color: #ececec;
    background:
      radial-gradient(circle at 10% -10%, rgba(103, 214, 255, 0.08), transparent 40%),
      radial-gradient(circle at 105% 15%, rgba(247, 200, 106, 0.08), transparent 45%),
      linear-gradient(180deg, #ffffff 0%, #fbfbfb 100%);
  }

  :global(:root[data-theme="light"]) .tutorial-when-intro h2 {
    color: #111111;
  }

  :global(:root[data-theme="light"]) .tutorial-when-intro p {
    color: rgba(17, 17, 17, 0.8);
  }

  :global(:root[data-theme="light"]) .tutorial-criteria-card {
    --criteria-soft: #e8f7fd;
    border-color: #e8e8e8;
    background: #ffffff;
    box-shadow: 0 5px 14px rgba(17, 17, 17, 0.04);
  }

  :global(:root[data-theme="light"]) .tutorial-criteria-card:nth-child(2) {
    --criteria-soft: #fff5de;
  }

  :global(:root[data-theme="light"]) .tutorial-criteria-card:nth-child(3) {
    --criteria-soft: #fff0ea;
  }

  :global(:root[data-theme="light"]) .tutorial-criteria-card:nth-child(4) {
    --criteria-soft: #ebf9ef;
  }

  :global(:root[data-theme="light"]) .tutorial-criteria-card:nth-child(5) {
    --criteria-soft: #e9f1ff;
  }

  :global(:root[data-theme="light"]) .tutorial-criteria-card:hover {
    border-color: #dfdfdf;
    box-shadow: 0 10px 22px rgba(17, 17, 17, 0.07);
  }

  :global(:root[data-theme="light"]) .tutorial-criteria-icon {
    border-color: rgba(17, 17, 17, 0.08);
  }

  :global(:root[data-theme="light"]) .tutorial-criteria-card p {
    color: #383838 !important;
  }

  @media (min-width: 640px) {
    .minimal-wrap {
      padding-left: 1.5rem;
      padding-right: 1.5rem;
    }

    .minimal-section {
      padding-top: 2.5rem;
      padding-bottom: 2.5rem;
    }

    .landing-page #when-do-i-want-dcn {
      padding-top: 2.25rem;
      padding-bottom: 5rem;
    }
  }

  @media (min-width: 1024px) {
    .minimal-wrap {
      padding-left: 2rem;
      padding-right: 2rem;
    }
  }

  @media (max-width: 640px) {
    .landing-page {
      --nav-offset: 3.3rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .landing-when-animated {
      transform: none;
      opacity: 1;
      transition: none;
    }
  }
</style>
