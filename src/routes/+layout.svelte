<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/stores";
  import "$lib/styles/style.css";
  import favicon from "$lib/assets/favicon.svg";
  import { getToken } from "$lib/auth/session";

  let { children } = $props();
  let isAuthenticated = $state(false);
  let currentPath = $state("");

  onMount(() => {
    const allowedPaths: Set<string> = new Set([resolve("/"), resolve("/login")]);

    const guardRoute = (path: string) => {
      if (getToken()) return;
      if (allowedPaths.has(path)) return;
      goto(resolve("/login"));
    };

    const syncAuth = () => {
      isAuthenticated = Boolean(getToken());
      currentPath = window.location.pathname;
      guardRoute(window.location.pathname);
    };

    syncAuth();
    window.addEventListener("auth:change", syncAuth);

    const unsubscribe = page.subscribe(($page) => {
      currentPath = $page.url.pathname;
      guardRoute($page.url.pathname);
    });

    return () => {
      window.removeEventListener("auth:change", syncAuth);
      unsubscribe();
    };
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen flex flex-col">
  <header
    class="sticky top-0 z-40 border-b backdrop-blur-[10px]"
    style="background: rgba(4, 14, 19, 0.58); border-bottom-color: rgba(233, 244, 244, 0.1);"
  >
    <nav class="max-w-6xl mx-auto h-14 px-4 flex items-center justify-between gap-4">
      <a href={resolve("/")} class="flex items-center gap-2">
        <!-- logo here -->
        <span class="text-sm font-semibold tracking-[0.08em] uppercase">
          Decentralised Creative Network
        </span>
      </a>

      <div class="flex items-center gap-4 text-sm text-white/70">
        {#if isAuthenticated}
          <a href="https://decentralised.art/" class="hover:text-white">Home</a>
          <a href={resolve("/")} class="hover:text-white">Network</a>
          <a href={resolve("/studio")} class="hover:text-white">Studio</a>
          <a href={resolve("/account")} class="hover:text-white">Account</a>
        {:else}
          <a href="https://decentralised.art/" class="hover:text-white">Home</a>
          <a href={resolve("/login")} class="hover:text-white">Login</a>
        {/if}
      </div>
    </nav>
  </header>

  <main class="flex-1 min-h-0 overflow-hidden flex flex-col">
    {@render children()}
  </main>

  {#if currentPath !== resolve("/studio") && currentPath !== resolve("/network")}
    <footer class="border-t border-white/10 text-white/40">
      <div
        class="max-w-6xl mx-auto px-4 py-[1.9rem] grid gap-6 md:flex md:items-start md:justify-between"
      >
        <div class="flex flex-col gap-[0.45rem]">
          <p
            class="m-0 text-white"
            style='font-family: "Syne", "Space Grotesk", system-ui, sans-serif; font-size: 1.1rem; letter-spacing: 0.01em;'
          >
            Decentralised Creative Network
          </p>
          <p class="m-0 text-[0.82rem] text-white/70">© 2026 decentralised.art</p>
        </div>
      </div>
    </footer>
  {/if}
</div>
