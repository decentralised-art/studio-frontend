<script lang="ts">
  import type { Snippet } from "svelte";

  const {
    children,
    onClose,
    onBack,
    canGoBack = false,
    className = "",
  }: {
    children?: Snippet;
    onClose?: () => void;
    onBack?: () => void;
    canGoBack?: boolean;
    className?: string;
  } = $props();
</script>

<section class={`section-shell relative max-w-none mx-0 ${className}`}>
  {#if onClose}
    <div class="flex items-center gap-2 pb-3">
      {#if canGoBack && onBack}
        <button
          type="button"
          aria-label="Back"
          onclick={onBack}
          class="h-9 px-3 rounded-full border border-white/10 bg-black/70
          text-xs font-semibold text-white/70 transition hover:text-white
          hover:border-white/20 focus:outline-none focus-visible:ring-2
          focus-visible:ring-emerald-400/60"
        >
          Back
        </button>
      {/if}

      <button
        type="button"
        aria-label="Close"
        onclick={onClose}
        class="ml-auto h-9 w-9 rounded-full border border-white/10 bg-black/70
        text-xs font-semibold text-white/70 transition hover:text-white
        hover:border-white/20 focus:outline-none focus-visible:ring-2
        focus-visible:ring-emerald-400/60"
      >
        X
      </button>
    </div>
  {/if}

  <div class="space-y-4">
    {@render children?.()}
  </div>
</section>
