<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { dev } from "$app/environment";
  import { page } from "$app/state";
  import "$lib/styles/style.css";
  import { isPublicRouteId, isWorldRuntimeRouteId, LOGIN_ROUTE } from "$lib/auth/routeAccess";
  import { hasAuthSession } from "$lib/auth/session";
  import ThemeToggle from "$lib/components/theme/ThemeToggle.svelte";

  let { children, data } = $props();
  let authRevision = $state(0);
  let hasMounted = $state(false);
  const devBypass = dev && import.meta.env.VITE_DEV_BYPASS_AUTH === "true";
  const hasCurrentAuthSession = $derived.by(() => {
    const revision = authRevision;
    return revision >= 0 && hasAuthSession();
  });
  const isAuthenticated = $derived.by(() => {
    if (devBypass) return true;
    return hasMounted
      ? hasCurrentAuthSession
      : Boolean(data.isAuthenticated) || hasCurrentAuthSession;
  });
  const canRenderRoute = $derived(isAuthenticated || devBypass || isPublicRouteId(page.route.id));
  const isWorldRuntimeRoute = $derived(isWorldRuntimeRouteId(page.route.id));
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
  const guardRoute = (routeId: string | null) => {
    if (devBypass) return;
    if (isAuthenticated) return;
    if (isPublicRouteId(routeId)) return;
    goto(resolve(LOGIN_ROUTE), { replaceState: true });
  };

  onMount(() => {
    const syncAuth = () => {
      hasMounted = true;
      authRevision += 1;
      guardRoute(page.route.id);
    };

    syncAuth();
    window.addEventListener("auth:change", syncAuth);
    window.addEventListener("storage", syncAuth);
    return () => {
      window.removeEventListener("auth:change", syncAuth);
      window.removeEventListener("storage", syncAuth);
    };
  });

  $effect(() => {
    if (!isAuthenticated) guardRoute(page.route.id);
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
            <a href={resolve("/account")}>Account</a>
          {:else}
            <a href={resolve("/login")}>Login</a>
          {/if}
        </div>
      </nav>
    </header>

    <main class="flex-1 min-h-0 overflow-hidden flex flex-col">
      {#if canRenderRoute}
        {@render children()}
      {:else}
        <div class="auth-redirect-page" aria-live="polite">Opening login...</div>
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

  .auth-redirect-page {
    @apply flex-1 min-h-0 flex items-center justify-center px-4 py-10 text-sm;
    color: var(--text-muted);
  }

  .app-shell {
    background: var(--surface-page);
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

  .app-footer {
    color: var(--text-faint);
    border-top-color: var(--border-subtle);
  }

  .app-footer-meta {
    color: var(--text-muted);
  }
</style>
