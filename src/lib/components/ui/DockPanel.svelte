<script lang="ts">
  import { onDestroy } from "svelte";
  import type { Snippet } from "svelte";

  const {
    title = "",
    position = "left",
    inline = false,
    resizable = false,
    sizePx,
    minSizePx = 180,
    maxSizePx = 920,
    contentScale = 1,
    onResize,
    onHide,
    children,
  }: {
    title?: string;
    position?: "left" | "right" | "top" | "bottom";
    inline?: boolean;
    resizable?: boolean;
    sizePx?: number;
    minSizePx?: number;
    maxSizePx?: number;
    contentScale?: number;
    onResize?: (nextSize: number) => void;
    onHide?: () => void;
    children?: Snippet;
  } = $props();

  let resizing = $state(false);
  const canResize = $derived(
    resizable && (position === "left" || position === "right") && typeof onResize === "function",
  );
  const clampedScale = $derived(Math.max(0.6, Math.min(1.25, contentScale)));

  const clampSize = (value: number) => Math.max(minSizePx, Math.min(maxSizePx, Math.round(value)));

  const updateSizeFromPointer = (event: PointerEvent) => {
    if (!canResize) return;
    const viewport = window.innerWidth || 0;
    const rawSize = position === "left" ? event.clientX : viewport - event.clientX;
    onResize?.(clampSize(rawSize));
  };

  const stopResize = () => {
    if (!resizing) return;
    resizing = false;
    window.removeEventListener("pointermove", updateSizeFromPointer);
    window.removeEventListener("pointerup", stopResize);
    window.removeEventListener("pointercancel", stopResize);
    document.body.style.removeProperty("user-select");
    document.body.style.removeProperty("cursor");
  };

  const startResize = (event: PointerEvent) => {
    if (!canResize) return;
    event.preventDefault();
    event.stopPropagation();
    resizing = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", updateSizeFromPointer);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
    updateSizeFromPointer(event);
  };

  onDestroy(() => {
    stopResize();
  });
</script>

<section
  class={`dock dock--${position} ${canResize ? "dock--resizable" : ""}`}
  style={`--dock-size-px:${sizePx ?? 0}; --dock-content-scale:${clampedScale};`}
>
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
      <div class="dock-body-scale">
        {@render children?.()}
      </div>
    </div>
  {/if}

  {#if canResize}
    <div
      class={`dock-resize-handle dock-resize-handle--${position} ${resizing ? "is-active" : ""}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={position === "left" ? "Resize left panel" : "Resize right panel"}
      tabindex="-1"
      onpointerdown={startResize}
    ></div>
  {/if}
</section>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .dock {
    @apply relative flex flex-col min-h-0 border border-white/10 bg-black/70;
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

  .dock-body-scale {
    --_scale: var(--dock-content-scale, 1);
    transform-origin: top left;
    transform: scale(var(--_scale));
    width: calc(100% / var(--_scale));
    min-height: calc(100% / var(--_scale));
  }

  .dock--left,
  .dock--right {
    @apply h-full;
  }

  .dock--top,
  .dock--bottom {
    @apply w-full;
  }

  .dock-resize-handle {
    @apply absolute top-0 bottom-0 z-20;
    width: 10px;
    touch-action: none;
    cursor: col-resize;
  }

  .dock-resize-handle::before {
    content: "";
    @apply absolute top-0 bottom-0 left-1/2 -translate-x-1/2;
    width: 2px;
    background: rgba(255, 255, 255, 0.12);
    transition: background-color 140ms ease;
  }

  .dock-resize-handle:hover::before,
  .dock-resize-handle.is-active::before {
    background: rgba(52, 211, 153, 0.68);
  }

  .dock-resize-handle--left {
    right: -5px;
  }

  .dock-resize-handle--right {
    left: -5px;
  }
</style>
