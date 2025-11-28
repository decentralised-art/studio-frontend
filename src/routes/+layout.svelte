<script lang="ts">
  import "./layout.css";
  import favicon from "$lib/assets/favicon.svg";
  
  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen flex flex-col">
  <header class="mb-4 border-b border-white/10">
    <nav class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <a href="/" class="flex items-center gap-2">
        <!-- logo here -->
        <span class="font-semibold tracking-wide">Hypermusic.ai</span>
      </a>

      <div class="flex gap-4 text-sm text-white/70">
        <a href="/docs" class="hover:text-white">Docs</a>
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
