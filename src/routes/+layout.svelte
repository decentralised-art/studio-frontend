<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import "$lib/styles/style.css";
  import favicon from "$lib/assets/favicon.svg";
  import { getToken } from "$lib/auth/session";

  let { children } = $props();
  let isAuthenticated = $state(false);
  const allowedRouteIds = new Set(["/", "/login"]);
  const guardRoute = (routeId: string | null) => {
    if (getToken()) return;
    if (routeId === null) return;
    if (allowedRouteIds.has(routeId)) return;
    goto(resolve("/login"));
  };

  onMount(() => {
    const syncAuth = () => {
      isAuthenticated = Boolean(getToken());
      guardRoute(page.route.id);
    };

    syncAuth();
    window.addEventListener("auth:change", syncAuth);

    return () => {
      window.removeEventListener("auth:change", syncAuth);
    };
  });

  $effect(() => {
    if (!isAuthenticated) guardRoute(page.route.id);
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen flex flex-col">
  <header class="border-b border-white/10">
    <nav class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <a href={resolve("/")} class="flex items-center gap-2">
        <!-- logo here -->
        <span class="font-semibold tracking-wide">Hypermusic.ai</span>
      </a>

      <div class="flex gap-4 text-sm text-white/70">
        {#if isAuthenticated}
          <a href={resolve("/explore")} class="hover:text-white">Explore</a>
          <a href={resolve("/create")} class="hover:text-white">Create</a>
          <a href={resolve("/studio")} class="hover:text-white">Studio</a>
          <a href={resolve("/account")} class="hover:text-white">Account</a>
        {:else}
          <a href={resolve("/login")} class="hover:text-white">Login</a>
        {/if}
      </div>
    </nav>
  </header>

  <main class="flex-1 min-h-0 overflow-hidden flex flex-col">
    {@render children()}
  </main>

  <footer class="border-t border-white/10 text-xs text-white/40">
    <div class="max-w-6xl mx-auto px-4 py-3 flex justify-between">
      <span>© {new Date().getFullYear()} hypermusic.ai </span>
      <a href="https://github.com/hypermusic-ai" class="hover:text-white">GitHub</a>
    </div>
  </footer>
</div>
