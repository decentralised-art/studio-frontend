<script lang="ts">
  import { onMount } from "svelte";
  import { resolve } from "$app/paths";
  import { docsNavLinks, primaryNavLinks } from "$lib/site/navigation";

  const currentYear = new Date().getFullYear();
  const footerColors = ["#67d6ff", "#f7c86a", "#ff9b7a", "#8de58f"] as const;
  let footerBackground = $state("#000000");

  onMount(() => {
    footerBackground = footerColors[Math.floor(Math.random() * footerColors.length)] ?? "#000000";
  });
</script>

<footer class="site-footer" style={`--footer-bg: ${footerBackground}`}>
  <div class="site-footer-inner">
    <div class="site-footer-brand-wrap">
      <h2 class="site-footer-title">decentralised.art</h2>
      <p class="site-footer-copy">© {currentYear} decentralised.art</p>
      <a
        class="site-footer-discord"
        href="https://discord.com/channels/1555735738870407190/1555735743828066396"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open decentralised.art on Discord (opens in a new tab)"
        title="Discord"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
          <path
            d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"
          ></path>
        </svg>
      </a>
    </div>

    <div class="site-footer-links-wrap">
      <nav class="site-footer-links" aria-label="Footer navigation">
        <div class="site-footer-link-group">
          <p class="site-footer-label">Explore</p>
          <div class="site-footer-link-list">
            {#each primaryNavLinks as link (link.href)}
              <a href={resolve(link.href)}>{link.label}</a>
            {/each}
          </div>
        </div>
        <div class="site-footer-link-group">
          <p class="site-footer-label">Docs</p>
          <div class="site-footer-link-list">
            {#each docsNavLinks as link (link.href)}
              <a href={resolve(link.href)}>{link.label}</a>
            {/each}
          </div>
        </div>
        <div class="site-footer-link-group">
          <p class="site-footer-label">For AI agents</p>
          <div class="site-footer-link-list">
            <a href={resolve("/llms.txt")} data-sveltekit-reload>llms.txt</a>
          </div>
        </div>
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

  .site-footer-discord {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: flex-start;
    width: 2.75rem;
    height: 2.75rem;
    color: #ffffff;
    border-radius: 0.5rem;
  }

  .site-footer-discord svg {
    width: 1.5rem;
    height: 1.5rem;
  }

  .site-footer-discord:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .site-footer-discord:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  .site-footer-links-wrap {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 1.4rem;
  }

  .site-footer-links {
    display: flex;
    flex-wrap: wrap;
    gap: 1.4rem;
  }

  .site-footer-link-group {
    display: flex;
    flex-direction: column;
    gap: 0.52rem;
  }

  .site-footer-link-list {
    display: grid;
    justify-items: start;
    gap: 0.35rem;
  }

  .site-footer-link-list a {
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.86rem;
    text-decoration: none;
  }

  .site-footer-link-list a:hover {
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

    .site-footer-links-wrap {
      justify-content: flex-end;
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
      gap: 1rem;
    }

    .site-footer-link-list a {
      font-size: 0.82rem;
    }
  }
</style>
