<script lang="ts">
  import { onMount } from "svelte";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import "$lib/styles/style.css";
  import { isProtectedRouteId, isWorldRuntimeRouteId } from "$lib/auth/routeAccess";
  import { hasAuthSession } from "$lib/auth/session";
  import WalletAuthButton from "$lib/components/auth/WalletAuthButton.svelte";
  import SiteFooter from "$lib/site/SiteFooter.svelte";
  import SiteNav from "$lib/site/SiteNav.svelte";

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
  const isLandingRoute = $derived(page.route.id === "/" || page.route.id === "/worlds");
  const isDocumentRoute = $derived.by(() => {
    const routeId = page.route.id ?? "";
    return (
      routeId === "/" ||
      routeId === "/worlds" ||
      routeId === "/about" ||
      routeId === "/sdk" ||
      routeId === "/mcp" ||
      routeId === "/api-reference" ||
      routeId === "/api-status" ||
      routeId === "/api-tutorial" ||
      routeId === "/documentation" ||
      routeId === "/onboarding" ||
      routeId === "/onboarding-agent" ||
      routeId === "/onboarding-human" ||
      routeId === "/roadmap" ||
      routeId === "/tutorial" ||
      routeId.startsWith("/tutorial/")
    );
  });
  const canRenderRoute = $derived(!isProtectedRouteId(page.route.id) || isAuthenticated);
  const shouldShowFooter = $derived.by(() => {
    const path = page.url.pathname;
    const worldsPath = resolve("/worlds");
    return (
      !isLandingRoute &&
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

  $effect(() => {
    document.body.classList.toggle("landing-immersive", isLandingRoute);

    return () => {
      document.body.classList.remove("landing-immersive");
    };
  });
</script>

{#if isWorldRuntimeRoute}
  {@render children()}
{:else}
  <div class="app-shell min-h-screen flex flex-col" class:landing-shell={isLandingRoute}>
    <SiteNav />

    <main
      class="app-main flex-1 min-h-0 flex flex-col"
      class:landing-main={isLandingRoute}
      class:document-main={isDocumentRoute}
    >
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
      <SiteFooter />
    {/if}
  </div>
{/if}

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .app-shell {
    background: var(--surface-page);
    color: var(--text-primary);
  }

  .app-shell.landing-shell {
    background: var(--surface-page);
    color: var(--text-primary);
  }

  :global(body.landing-immersive) {
    background: var(--surface-page);
    color: var(--text-primary);
    font-family: "Space Grotesk", system-ui, sans-serif;
  }

  :global(body.landing-immersive)::before {
    content: none;
  }

  .app-main {
    overflow: hidden;
  }

  .app-main.landing-main,
  .app-main.document-main {
    display: block;
    flex: 1 0 auto;
    min-height: auto;
    overflow: visible;
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
</style>
