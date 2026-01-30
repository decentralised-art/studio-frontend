<script lang="ts">
  import type { Snippet } from "svelte";

  const {
    title = "",
    position = "left",
    inline = false,
    onHide,
    children,
  }: {
    title?: string;
    position?: "left" | "right" | "top" | "bottom";
    inline?: boolean;
    onHide?: () => void;
    children?: Snippet;
  } = $props();
</script>

<section class={`dock dock--${position}`}>
  <header class="dock-head">
    <span class="dock-title">{title}</span>
    {#if inline}
      <div class="dock-inline">
        {@render children?.()}
      </div>
    {/if}
    <button class="dock-btn" type="button" onclick={onHide}>Hide</button>
  </header>

  {#if !inline && children}
    <div class="dock-body">
      {@render children?.()}
    </div>
  {/if}
</section>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .dock {
    @apply flex flex-col min-h-0 border border-white/10 bg-black/70;
  }

  .dock-head {
    @apply flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2;
  }

  .dock-title {
    @apply text-[0.6rem] uppercase tracking-[0.28em] text-white/55;
  }

  .dock-inline {
    @apply flex flex-wrap items-center gap-2 min-w-0;
  }

  .dock-btn {
    @apply text-[0.55rem] uppercase tracking-[0.2em] text-white/50 hover:text-white/80;
  }

  .dock-body {
    @apply flex-1 min-h-0 overflow-auto p-2 text-sm text-white/70;
  }

  .dock--left,
  .dock--right {
    @apply h-full;
  }

  .dock--top,
  .dock--bottom {
    @apply w-full;
  }
</style>
