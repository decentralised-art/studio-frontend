<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { dev } from "$app/environment";
  import { page } from "$app/state";
  import "$lib/styles/style.css";
  import { isPublicRouteId, LOGIN_ROUTE } from "$lib/auth/routeAccess";
  import { hasAuthSession } from "$lib/auth/session";

  let { children, data } = $props();
  let authRevision = $state(0);
  let currentPath = $state("");
  const devBypass = dev && import.meta.env.VITE_DEV_BYPASS_AUTH === "true";
  const hasCurrentAuthSession = $derived.by(() => {
    const revision = authRevision;
    return revision >= 0 && hasAuthSession();
  });
  const isAuthenticated = $derived.by(() => {
    return devBypass || Boolean(data.isAuthenticated) || hasCurrentAuthSession;
  });
  const canRenderRoute = $derived(isAuthenticated || devBypass || isPublicRouteId(page.route.id));
  const guardRoute = (routeId: string | null) => {
    if (devBypass) return;
    if (isAuthenticated) return;
    if (isPublicRouteId(routeId)) return;
    goto(resolve(LOGIN_ROUTE), { replaceState: true });
  };

  onMount(() => {
    const syncAuth = () => {
      authRevision += 1;
      currentPath = window.location.pathname;
      guardRoute(page.route.id);
    };

    syncAuth();
    window.addEventListener("auth:change", syncAuth);
    return () => {
      window.removeEventListener("auth:change", syncAuth);
    };
  });

  $effect(() => {
    currentPath = page.url.pathname;
    if (!isAuthenticated) guardRoute(page.route.id);
  });
</script>

<div class="min-h-screen flex flex-col">
  <header
    class="sticky top-0 z-40 border-b backdrop-blur-[10px]"
    style="background: rgba(4, 14, 19, 0.58); border-bottom-color: rgba(233, 244, 244, 0.1);"
  >
    <nav class="max-w-6xl mx-auto h-14 px-4 flex items-center justify-between gap-4">
      <a href="https://decentralised.art/" class="flex items-center gap-2">
        <!-- logo here -->
        <span class="text-sm font-semibold tracking-[0.08em] uppercase">
          Decentralised Creative Network
        </span>
      </a>

      <div class="flex items-center gap-4 text-sm text-white/70">
        {#if isAuthenticated}
          <a href={resolve("/")} class="hover:text-white">Network</a>
          <a href={resolve("/studio")} class="hover:text-white">Studio</a>
          <a href={resolve("/account")} class="hover:text-white">Account</a>
        {:else}
          <a href={resolve("/login")} class="hover:text-white">Login</a>
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

  {#if currentPath !== resolve("/studio") && currentPath !== resolve("/network")}
    <footer class="border-t border-white/10 text-white/40">
      <div
        class="max-w-6xl mx-auto px-4 py-[1.9rem] grid gap-6 md:flex md:items-start md:justify-between"
      >
        <div class="flex flex-col gap-[0.45rem]">
          <p
            class="m-0 text-white"
            style="font-family: Syne, 'Space Grotesk', system-ui, sans-serif; font-size: 1.1rem; letter-spacing: 0.01em;"
          >
            Decentralised Creative Network
          </p>
          <p class="m-0 text-[0.82rem] text-white/70">© 2026 decentralised.art</p>
        </div>
      </div>
    </footer>
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .auth-redirect-page {
    @apply flex-1 min-h-0 flex items-center justify-center px-4 py-10 text-sm text-white/70;
  }
</style>
