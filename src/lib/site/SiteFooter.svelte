<script lang="ts">
  import { onMount } from "svelte";
  import { resolve } from "$app/paths";

  const currentYear = new Date().getFullYear();
  const footerColors = ["#67d6ff", "#f7c86a", "#ff9b7a", "#8de58f"] as const;
  const links = [
    { href: "/", label: "Home" },
    { href: "/worlds", label: "Worlds" },
    { href: "/tutorial", label: "Tutorial" },
    { href: "/documentation", label: "API Documentation" },
    { href: "/api-status", label: "API Status" },
    { href: "/roadmap", label: "Roadmap" },
  ] as const;

  let footerBackground = $state("#000000");

  onMount(() => {
    footerBackground = footerColors[Math.floor(Math.random() * footerColors.length)] ?? "#000000";
  });
</script>

<footer class="site-footer" style={`--footer-bg: ${footerBackground}`}>
  <div class="site-footer-inner">
    <div class="site-footer-brand-wrap">
      <h2 class="site-footer-title">Decentralised Creative Network</h2>
      <p class="site-footer-copy">© {currentYear} decentralised.art</p>
    </div>

    <div class="site-footer-links-wrap">
      <p class="site-footer-label">Explore</p>
      <nav class="site-footer-links" aria-label="Footer links">
        {#each links as link (link.href)}
          <a href={resolve(link.href)}>{link.label}</a>
        {/each}
      </nav>
    </div>
  </div>
</footer>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .site-footer {
    margin-top: auto;
    background: var(--footer-bg, #000000);
    color: #ffffff;
    border-top: 1px solid rgba(255, 255, 255, 0.16);
  }

  :global(:root[data-theme="dark"]) .site-footer {
    background: #020617;
    border-top-color: var(--border-subtle);
  }

  .site-footer-inner {
    display: grid;
    gap: 1.4rem;
    max-width: 72rem;
    margin-left: auto;
    margin-right: auto;
    padding: 1.9rem 1rem;
  }

  .site-footer-brand-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .site-footer .site-footer-title {
    margin: 0;
    color: #ffffff !important;
    font-family: "Syne", "Space Grotesk", system-ui, sans-serif;
    font-size: 1.1rem;
    font-weight: 600;
    letter-spacing: 0;
  }

  .site-footer .site-footer-copy {
    margin: 0;
    color: #ffffff !important;
    font-size: 0.82rem;
  }

  .site-footer-label {
    margin: 0;
    color: rgba(255, 255, 255, 0.65);
    font-size: 0.7rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .site-footer-links-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.52rem;
  }

  .site-footer-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem 0.8rem;
  }

  .site-footer-links a {
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.86rem;
    text-decoration: none;
  }

  .site-footer-links a:hover {
    color: #ffffff;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  @media (min-width: 640px) {
    .site-footer-inner {
      padding-left: 1.5rem;
      padding-right: 1.5rem;
    }
  }

  @media (min-width: 768px) {
    .site-footer-inner {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
    }
  }

  @media (min-width: 1024px) {
    .site-footer-inner {
      padding-left: 2rem;
      padding-right: 2rem;
    }
  }

  @media (max-width: 640px) {
    .site-footer-inner {
      gap: 1.1rem;
      padding-top: 1.4rem;
      padding-bottom: 1.45rem;
    }

    .site-footer-title {
      font-size: 1rem;
    }

    .site-footer-links {
      gap: 0.35rem 0.65rem;
    }

    .site-footer-links a {
      font-size: 0.82rem;
    }
  }
</style>
