<script lang="ts">
  import type { Snippet } from "svelte";
  import type { MouseEventHandler, KeyboardEventHandler } from "svelte/elements";

  type Variant = "default" | "soft" | "gradient-border";

  type OnClick<T extends EventTarget = HTMLElement> = MouseEventHandler<T> | null | undefined;
  type OnKeyDown<T extends EventTarget = HTMLElement> = KeyboardEventHandler<T> | undefined | null;

  const {
    variant = "default",
    tabindex,
    ariaPressed,
    ariaLabel,
    selected = false,
    children,
    onclick,
    onkeydown,
  }: {
    variant?: Variant;
    tabindex?: number;
    ariaPressed?: boolean;
    ariaLabel?: string;
    selected?: boolean;
    children?: Snippet;
    onclick?: OnClick;
    onkeydown?: OnKeyDown;
  } = $props();

  const isInteractive = typeof onclick === "function" || typeof onkeydown === "function";
</script>

{#if variant === "gradient-border"}
  <button
    class={`card-gradient-border ${selected ? "card-selected" : ""}
        ${isInteractive ? " card-hoverable" : ""}`}
    {onclick}
    {onkeydown}
    {tabindex}
    aria-pressed={ariaPressed}
    aria-label={ariaLabel}
  >
    <div class="card-inner">
      {@render children?.()}
    </div>
  </button>
{:else if variant === "soft"}
  <button
    class={`card-soft ${selected ? "card-selected" : ""}
        ${isInteractive ? " card-hoverable" : ""}`}
    {onclick}
    {onkeydown}
    {tabindex}
    aria-pressed={ariaPressed}
    aria-label={ariaLabel}
  >
    {@render children?.()}
  </button>
{:else}
  <button
    class={`card ${selected ? "card-selected" : ""}
        ${isInteractive ? " card-hoverable" : ""}`}
    {onclick}
    {onkeydown}
    {tabindex}
    aria-pressed={ariaPressed}
    aria-label={ariaLabel}
  >
    {@render children?.()}
  </button>
{/if}

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .card {
    @apply w-full relative rounded-3xl border border-white/10

      bg-white/5
      shadow-[0_18px_60px_rgba(15,23,42,0.85)]
      p-6;
  }

  .card-hoverable {
    @apply transition
    hover:border-emerald-400
    hover:shadow-lg
    focus-visible:ring-2
    focus-visible:ring-emerald-400/60;
  }

  .card-selected {
    @apply border  border-emerald-500/60 bg-emerald-500/10 text-emerald-300;
  }

  .card-soft {
    @apply rounded-2xl border border-white/10
      bg-white/5 p-4;
  }

  .card-gradient-border {
    position: relative;
    z-index: 0;
    border-radius: 1.5rem;
    padding: 1px;
    background:
      radial-gradient(circle at 0 0, #22c55e, transparent 55%),
      radial-gradient(circle at 100% 100%, #a855f7, transparent 55%);
  }

  .card-gradient-border > .card-inner {
    @apply rounded-[1.4rem] bg-black/80 border border-white/10
       p-6;
  }
</style>
