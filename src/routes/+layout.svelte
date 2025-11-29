<script lang="ts">
  import { resolve } from "$app/paths";
  import "./layout.css";
  import favicon from "$lib/assets/favicon.svg";

  let { children } = $props();
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
        <a href={resolve("/explore")} class="hover:text-white">Explore</a>
        <a href={resolve("/create")} class="hover:text-white">Create</a>
        <a href={resolve("/account")} class="hover:text-white">Account</a>
      </div>
    </nav>
  </header>

  <main class="flex-1">
    {@render children()}
  </main>

  <footer class="border-t border-white/10 text-xs text-white/40">
    <div class="max-w-6xl mx-auto px-4 py-3 flex justify-between">
      <span>© {new Date().getFullYear()} hypermusic.ai </span>
      <a href="https://github.com/hypermusic-ai" class="hover:text-white"
        >GitHub</a
      >
    </div>
  </footer>
</div>
