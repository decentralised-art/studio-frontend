<script lang="ts">
  import { onMount } from "svelte";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import WalletAuthButton from "$lib/components/auth/WalletAuthButton.svelte";

  type Props = {
    isAuthenticated: boolean;
  };

  const { isAuthenticated }: Props = $props();

  let menuOpen = $state(false);
  let docsMenuOpen = $state(false);
  let navElement: HTMLElement | null = null;
  const isLandingRoute = $derived(page.route.id === "/");

  const primaryLinks = [
    { href: "/", label: "Home" },
    { href: "/worlds", label: "Worlds" },
  ] as const;

  const authenticatedLinks = [
    { href: "/network", label: "Network" },
    { href: "/studio", label: "Studio" },
  ] as const;

  const docsLinks = [
    { href: "/tutorial", label: "Tutorial" },
    { href: "/documentation", label: "API Docs" },
  ] as const;

  type NavHref =
    | (typeof primaryLinks)[number]["href"]
    | (typeof authenticatedLinks)[number]["href"]
    | (typeof docsLinks)[number]["href"];

  const isActive = (href: NavHref) => {
    const current = page.url.pathname.replace(/\/+$/, "") || "/";
    const target = resolve(href).replace(/\/+$/, "") || "/";
    return current === target || (target !== "/" && current.startsWith(`${target}/`));
  };

  const isDocsActive = $derived(docsLinks.some((link) => isActive(link.href)));

  const toggleDocsMenu = () => {
    docsMenuOpen = !docsMenuOpen;
  };

  const closeMenu = () => {
    menuOpen = false;
    docsMenuOpen = false;
  };

  $effect(() => {
    document.body.classList.toggle("nav-menu-open", menuOpen);
    return () => {
      document.body.classList.remove("nav-menu-open");
    };
  });

  onMount(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if ((!menuOpen && !docsMenuOpen) || !navElement) return;
      if (event.target instanceof Node && navElement.contains(event.target)) return;
      closeMenu();
    };
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeydown);
    };
  });
</script>

<header class:is-landing={isLandingRoute} class:is-open={menuOpen} class="site-nav">
  <div class="page-container">
    <nav class="site-nav-inner" aria-label="Primary" bind:this={navElement}>
      <a href={resolve("/")} class="site-brand" aria-label="decentralised.art home">
        decentralised.art
      </a>

      <button
        type="button"
        class="site-nav-toggle"
        aria-expanded={menuOpen}
        aria-controls="site-primary-links"
        aria-label="Toggle navigation menu"
        onclick={() => {
          menuOpen = !menuOpen;
        }}
      >
        <span class="site-nav-toggle-open" aria-hidden="true">☰</span>
        <span class="site-nav-toggle-close" aria-hidden="true">✕</span>
      </button>

      <div class="site-links" id="site-primary-links">
        {#each primaryLinks as link (link.href)}
          <a
            class:active={isActive(link.href)}
            class="site-link"
            href={resolve(link.href)}
            aria-current={isActive(link.href) ? "page" : undefined}
            onclick={closeMenu}
          >
            {link.label}
          </a>
        {/each}

        {#if isAuthenticated}
          {#each authenticatedLinks as link (link.href)}
            <a
              class:active={isActive(link.href)}
              class="site-link"
              href={resolve(link.href)}
              aria-current={isActive(link.href) ? "page" : undefined}
              onclick={closeMenu}
            >
              {link.label}
            </a>
          {/each}
        {/if}

        <div class="site-docs-menu">
          <button
            type="button"
            class:active={isDocsActive}
            class="site-link site-docs-trigger"
            aria-haspopup="menu"
            aria-expanded={docsMenuOpen}
            onclick={toggleDocsMenu}
          >
            <span>Docs</span>
            <span class="site-docs-caret" aria-hidden="true"></span>
          </button>

          {#if docsMenuOpen}
            <div class="site-docs-menu-list" role="menu">
              {#each docsLinks as link (link.href)}
                <a
                  class:active={isActive(link.href)}
                  class="site-docs-menu-item"
                  role="menuitem"
                  href={resolve(link.href)}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  onclick={closeMenu}
                >
                  {link.label}
                </a>
              {/each}
            </div>
          {/if}
        </div>

        <WalletAuthButton className="site-wallet-auth" />
      </div>
    </nav>
  </div>
</header>
<button
  type="button"
  class:is-visible={menuOpen}
  class="site-nav-backdrop"
  aria-label="Close navigation menu"
  tabindex="-1"
  onclick={closeMenu}
></button>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .site-nav {
    position: sticky;
    top: 0;
    z-index: 40;
    background: var(--surface-header);
    border-bottom: 1px solid var(--border-subtle);
    color: var(--text-primary);
    backdrop-filter: blur(12px);
  }

  .site-nav.is-landing {
    background: linear-gradient(180deg, rgba(13, 15, 18, 0.5) 0%, rgba(13, 15, 18, 0.24) 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(12px);
  }

  .page-container {
    max-width: 72rem;
    margin-left: auto;
    margin-right: auto;
    padding-left: 1rem;
    padding-right: calc(1rem + 2.75rem);
  }

  .site-nav-inner {
    height: 3.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .site-brand {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: none;
    color: var(--text-primary);
  }

  .site-nav.is-landing .site-brand,
  .site-nav.is-landing .site-link {
    color: #ffffff;
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
  }

  .site-links {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    overflow: visible;
  }

  .site-link {
    font-size: 0.75rem;
    padding: 0.375rem 0.75rem;
    border-radius: 0.25rem;
    white-space: nowrap;
    transition:
      background 150ms ease,
      color 150ms ease,
      border-color 150ms ease;
    color: var(--text-muted);
    border: 1px solid transparent;
  }

  button.site-link {
    cursor: pointer;
    font-family: inherit;
    background: transparent;
  }

  .site-link:hover,
  .site-link.active {
    color: var(--text-primary);
    background: var(--surface-card-hover);
    border-color: var(--border-subtle);
  }

  .site-nav.is-landing .site-link:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.16);
  }

  .site-nav.is-landing .site-link.active {
    color: #ffffff;
    background: transparent;
  }

  .site-docs-menu {
    position: relative;
  }

  .site-docs-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.42rem;
  }

  .site-docs-caret {
    width: 0;
    height: 0;
    border-left: 0.22rem solid transparent;
    border-right: 0.22rem solid transparent;
    border-top: 0.28rem solid currentColor;
    opacity: 0.72;
  }

  .site-docs-menu-list {
    position: absolute;
    top: calc(100% + 0.45rem);
    left: 0;
    z-index: 90;
    display: grid;
    min-width: 9rem;
    overflow: hidden;
    border: 1px solid var(--border-subtle);
    border-radius: 0.35rem;
    padding: 0.22rem;
    background: var(--surface-floating-hover);
    box-shadow: var(--shadow-soft);
  }

  .site-docs-menu-item {
    display: block;
    padding: 0.45rem 0.6rem;
    border-radius: 0.25rem;
    color: var(--text-secondary);
    font-size: 0.75rem;
    white-space: nowrap;
    transition:
      background 150ms ease,
      color 150ms ease;
  }

  .site-docs-menu-item:hover,
  .site-docs-menu-item:focus-visible,
  .site-docs-menu-item.active {
    background: var(--surface-card-hover);
    color: var(--text-primary);
  }

  .site-nav.is-landing .site-docs-menu-list {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(10, 13, 16, 0.88);
  }

  .site-nav.is-landing .site-docs-menu-item {
    color: rgba(255, 255, 255, 0.84);
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
  }

  .site-nav.is-landing .site-docs-menu-item:hover,
  .site-nav.is-landing .site-docs-menu-item:focus-visible,
  .site-nav.is-landing .site-docs-menu-item.active {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.16);
  }

  .site-nav-toggle {
    display: none;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid var(--border-subtle);
    border-radius: 0.35rem;
    background: var(--surface-card);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 0.95rem;
    line-height: 1;
  }

  .site-nav.is-landing .site-nav-toggle {
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.32);
    background: rgba(8, 12, 14, 0.35);
  }

  .site-nav-toggle:hover {
    background: var(--surface-card-hover);
  }

  .site-nav.is-landing .site-nav-toggle:hover {
    background: rgba(255, 255, 255, 0.18);
  }

  .site-nav-toggle-open,
  .site-nav-toggle-close {
    display: inline-block;
  }

  .site-nav-toggle-close,
  .site-nav.is-open .site-nav-toggle-open {
    display: none;
  }

  .site-nav.is-open .site-nav-toggle-close {
    display: inline-block;
  }

  .site-nav-backdrop {
    display: none;
  }

  :global(.site-wallet-auth) {
    margin-left: 0.25rem;
  }

  :global(.site-wallet-auth .wallet-login-trigger),
  :global(.site-wallet-auth .wallet-menu-trigger) {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 2rem;
    min-height: 2rem;
    max-height: 2rem;
    border-radius: 0.25rem;
    border: 1px solid rgba(17, 17, 17, 0.16);
    padding: 0 0.75rem !important;
    background: #8de58f !important;
    color: #06130c !important;
    box-shadow: none;
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.25;
    letter-spacing: 0;
    text-shadow: none;
  }

  :global(.site-wallet-auth .wallet-login-trigger:hover),
  :global(.site-wallet-auth .wallet-menu-trigger:hover),
  :global(.site-wallet-auth .wallet-menu-trigger[aria-expanded="true"]) {
    background: color-mix(in srgb, #8de58f 88%, #ffffff 12%) !important;
    color: #06130c !important;
  }

  .site-nav.is-landing :global(.site-wallet-auth .wallet-login-trigger),
  .site-nav.is-landing :global(.site-wallet-auth .wallet-menu-trigger) {
    border-color: rgba(17, 17, 17, 0.2);
  }

  :global(.site-wallet-auth .wallet-menu-list) {
    background: var(--surface-floating-hover);
    border-color: var(--border-subtle);
    box-shadow: var(--shadow-soft);
  }

  :global(.site-wallet-auth .wallet-menu-item) {
    color: var(--text-secondary);
  }

  :global(.site-wallet-auth .wallet-menu-item:hover),
  :global(.site-wallet-auth .wallet-menu-item:focus-visible) {
    background: var(--surface-card-hover);
    color: var(--text-primary);
  }

  @media (min-width: 640px) {
    .page-container {
      padding-left: 1.5rem;
      padding-right: calc(1.5rem + 2.75rem);
    }
  }

  @media (min-width: 1024px) {
    .page-container {
      padding-left: 2rem;
      padding-right: calc(2rem + 2.75rem);
    }
  }

  @media (max-width: 900px) {
    :global(body.nav-menu-open) {
      overflow: hidden;
    }

    :global(body main),
    :global(body .site-footer) {
      transition: filter 180ms ease;
    }

    :global(body.nav-menu-open main),
    :global(body.nav-menu-open .site-footer) {
      filter: blur(6px);
    }

    .site-nav {
      overflow: visible;
    }

    .site-nav-inner {
      position: relative;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      column-gap: 0.6rem;
      height: 3.5rem;
      min-height: 3.5rem;
      padding-top: 0;
      padding-bottom: 0;
      z-index: 3;
    }

    .site-nav-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 39;
      opacity: 0;
      pointer-events: none;
      border: 0;
      margin: 0;
      padding: 0;
      background: color-mix(in srgb, var(--surface-page) 72%, transparent);
      backdrop-filter: blur(7px);
      transition: opacity 180ms ease;
    }

    .site-nav-backdrop.is-visible {
      opacity: 1;
      pointer-events: auto;
    }

    .site-nav.is-landing + .site-nav-backdrop {
      background: rgba(6, 10, 12, 0.34);
    }

    .site-brand {
      grid-column: 1;
      max-width: calc(100% - 2.8rem);
      line-height: 1.25;
    }

    .site-nav-toggle {
      grid-column: 2;
      display: inline-flex;
      margin-left: 0;
    }

    .site-links {
      grid-column: auto;
      position: absolute;
      top: calc(100% + 0.35rem);
      left: 0;
      right: 0;
      z-index: 80;
      display: none;
      width: auto;
      overflow: visible;
      flex-direction: column;
      align-items: stretch;
      gap: 0.26rem;
      padding: 0.35rem;
      border-radius: 0.5rem;
      border: 1px solid var(--border-subtle);
      background: var(--surface-floating-hover);
      box-shadow: var(--shadow-soft);
      backdrop-filter: blur(8px);
    }

    .site-nav.is-open .site-links {
      display: flex;
    }

    .site-nav.is-landing .site-links {
      border-color: rgba(255, 255, 255, 0.2);
      background: rgba(10, 13, 16, 0.82);
    }

    .site-link {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      text-align: left;
      border-radius: 0.35rem;
      padding: 0.46rem 0.62rem;
      background: var(--surface-card);
      border: 1px solid var(--border-subtle);
    }

    .site-docs-menu {
      width: 100%;
    }

    .site-docs-trigger {
      justify-content: space-between;
    }

    .site-docs-menu-list {
      position: static;
      z-index: auto;
      min-width: 0;
      margin-top: 0.26rem;
      border-radius: 0.35rem;
      box-shadow: none;
    }

    .site-docs-menu-item {
      white-space: normal;
    }

    .site-nav.is-landing .site-link {
      background: rgba(10, 13, 16, 0.42);
      border-color: rgba(255, 255, 255, 0.18);
    }

    .site-nav.is-landing .site-link:hover {
      background: rgba(255, 255, 255, 0.16);
      border-color: rgba(255, 255, 255, 0.25);
    }

    .site-nav.is-landing .site-link.active {
      background: rgba(10, 13, 16, 0.42);
      border-color: rgba(255, 255, 255, 0.18);
    }

    :global(.site-wallet-auth) {
      width: 100%;
      margin-left: 0;
      justify-content: stretch;
    }

    :global(.site-wallet-auth .wallet-login-trigger),
    :global(.site-wallet-auth .wallet-menu),
    :global(.site-wallet-auth .wallet-menu-trigger) {
      width: 100%;
      max-width: 100%;
      justify-content: flex-start;
    }
  }

  @media (max-width: 640px) {
    .site-nav-inner {
      height: 3.3rem;
      min-height: 3.3rem;
    }

    .site-brand {
      font-size: 0.72rem;
      letter-spacing: 0.06em;
    }
  }
</style>
