<script lang="ts">
  import { onMount } from "svelte";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import "$lib/styles/style.css";
  import { isProtectedRouteId, isWorldRuntimeRouteId } from "$lib/auth/routeAccess";
  import { hasAuthSession } from "$lib/auth/session";
  import WalletAuthButton from "$lib/components/auth/WalletAuthButton.svelte";
  import ThemeToggle from "$lib/components/theme/ThemeToggle.svelte";

  let { children, data } = $props();
  let authRevision = $state(0);
  let hasMounted = $state(false);
  const hasCurrentAuthSession = $derived.by(() => {
    const revision = authRevision;
    return revision >= 0 && hasAuthSession();
  });
  const isAuthenticated = $derived.by(() =>
    hasMounted ? hasCurrentAuthSession : Boolean(data.isAuthenticated) || hasCurrentAuthSession,
  );
  const isWorldRuntimeRoute = $derived(isWorldRuntimeRouteId(page.route.id));
  const canRenderRoute = $derived(!isProtectedRouteId(page.route.id) || isAuthenticated);
  const shouldShowFooter = $derived.by(() => {
    const path = page.url.pathname;
    const worldsPath = resolve("/worlds");
    return (
      path !== resolve("/studio") &&
      path !== resolve("/network") &&
      path !== worldsPath &&
      !path.startsWith(`${worldsPath}/`)
    );
  });

  onMount(() => {
    const syncAuth = () => {
      hasMounted = true;
      authRevision += 1;
    };

    syncAuth();
    window.addEventListener("auth:change", syncAuth);
    window.addEventListener("storage", syncAuth);
    return () => {
      window.removeEventListener("auth:change", syncAuth);
      window.removeEventListener("storage", syncAuth);
    };
  });
</script>

{#if isWorldRuntimeRoute}
  {@render children()}
{:else}
  <ThemeToggle />

  <div class="app-shell min-h-screen flex flex-col">
    <header class="app-header sticky top-0 z-40 border-b backdrop-blur-[10px]">
      <nav class="max-w-6xl mx-auto h-14 px-4 flex items-center justify-between gap-4">
        <a href="https://decentralised.art/" class="flex items-center gap-2">
          <!-- logo here -->
          <span class="app-logo-text text-sm font-semibold tracking-[0.08em] uppercase">
            Decentralised Creative Network
          </span>
        </a>

        <div class="app-nav-links flex items-center gap-4 text-sm">
          <a href={resolve("/worlds")}>Worlds</a>
          {#if isAuthenticated}
            <a href={resolve("/")}>Network</a>
            <a href={resolve("/studio")}>Studio</a>
          {/if}
          <WalletAuthButton className="app-wallet-auth" />
        </div>
      </nav>
    </header>

    <main class="flex-1 min-h-0 overflow-hidden flex flex-col">
      {#if canRenderRoute}
        {@render children()}
      {:else}
        <div class="auth-gate-page" aria-live="polite">
          <div class="auth-gate">
            <p class="auth-gate-title">Login with MetaMask to continue.</p>
            <WalletAuthButton showLogout={false} />
          </div>
        </div>
      {/if}
    </main>

    {#if shouldShowFooter}
      <footer class="app-footer border-t">
        <div
          class="max-w-6xl mx-auto px-4 py-[1.9rem] grid gap-6 md:flex md:items-start md:justify-between"
        >
          <div class="flex flex-col gap-[0.45rem]">
            <p
              class="app-footer-title m-0"
              style="font-family: Syne, 'Space Grotesk', system-ui, sans-serif; font-size: 1.1rem; letter-spacing: 0.01em;"
            >
              Decentralised Creative Network
            </p>
            <p class="app-footer-meta m-0 text-[0.82rem]">© 2026 decentralised.art</p>
          </div>
        </div>
      </footer>
    {/if}
  </div>
{/if}

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .app-shell {
    background: var(--surface-page);
    color: var(--text-primary);
  }

  .auth-gate-page {
    @apply flex-1 min-h-0 flex items-center justify-center px-4 py-10 text-sm;
    color: var(--text-muted);
  }

  .auth-gate {
    @apply flex flex-col items-center gap-4 rounded-lg border px-6 py-5 text-center;
    background: var(--surface-card);
    border-color: var(--border-subtle);
    box-shadow: var(--shadow-soft);
  }

  .auth-gate-title {
    @apply text-sm font-medium;
    color: var(--text-primary);
  }

  .app-header {
    background: var(--surface-header);
    border-bottom-color: var(--border-subtle);
  }

  .app-logo-text,
  .app-footer-title {
    color: var(--text-primary);
  }

  .app-nav-links {
    color: var(--text-muted);
  }

  .app-nav-links a {
    transition: color 150ms ease;
  }

  .app-nav-links a:hover {
    color: var(--text-primary);
  }

  :global(.app-wallet-auth) {
    margin-left: 0.25rem;
  }

  .app-footer {
    color: var(--text-faint);
    border-top-color: var(--border-subtle);
  }

  .app-footer-meta {
    color: var(--text-muted);
  }
</style>
