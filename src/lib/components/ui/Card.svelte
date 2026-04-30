<script lang="ts">
  import type { Snippet } from "svelte";
  import type { DragEventHandler, MouseEventHandler, KeyboardEventHandler } from "svelte/elements";

  type Variant = "default" | "soft" | "gradient-border" | "compact";

  type OnClick<T extends EventTarget = HTMLElement> = MouseEventHandler<T> | null | undefined;
  type OnDblClick<T extends EventTarget = HTMLElement> = MouseEventHandler<T> | null | undefined;
  type OnKeyDown<T extends EventTarget = HTMLElement> = KeyboardEventHandler<T> | undefined | null;
  type OnDragStart<T extends EventTarget = HTMLElement> = DragEventHandler<T> | undefined | null;

  const {
    variant = "default",
    tabindex,
    ariaPressed,
    ariaLabel,
    selected = false,
    draggable,
    children,
    onclick,
    ondblclick,
    onkeydown,
    ondragstart,
  }: {
    variant?: Variant;
    tabindex?: number;
    ariaPressed?: boolean;
    ariaLabel?: string;
    selected?: boolean;
    draggable?: boolean;
    children?: Snippet;
    onclick?: OnClick;
    ondblclick?: OnDblClick;
    onkeydown?: OnKeyDown;
    ondragstart?: OnDragStart;
  } = $props();

  const isInteractive = $derived.by(
    () => typeof onclick === "function" || typeof onkeydown === "function",
  );
</script>

{#if variant === "gradient-border"}
  <button
    class={`card-gradient-border ${selected ? "card-selected" : ""}
        ${isInteractive ? " card-hoverable" : ""}`}
    {onclick}
    {ondblclick}
    {onkeydown}
    {tabindex}
    aria-pressed={ariaPressed}
    aria-label={ariaLabel}
    {draggable}
    {ondragstart}
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
    {ondblclick}
    {onkeydown}
    {tabindex}
    aria-pressed={ariaPressed}
    aria-label={ariaLabel}
    {draggable}
    {ondragstart}
  >
    {@render children?.()}
  </button>
{:else if variant === "compact"}
  <button
    class={`card-compact ${selected ? "card-selected" : ""}
        ${isInteractive ? " card-hoverable" : ""}`}
    {onclick}
    {ondblclick}
    {onkeydown}
    {tabindex}
    aria-pressed={ariaPressed}
    aria-label={ariaLabel}
    {draggable}
    {ondragstart}
  >
    {@render children?.()}
  </button>
{:else}
  <button
    class={`card ${selected ? "card-selected" : ""}
        ${isInteractive ? " card-hoverable" : ""}`}
    {onclick}
    {ondblclick}
    {onkeydown}
    {tabindex}
    aria-pressed={ariaPressed}
    aria-label={ariaLabel}
    {draggable}
    {ondragstart}
  >
    {@render children?.()}
  </button>
{/if}

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .card {
    @apply w-full relative rounded-3xl border p-6;
    background: var(--surface-card);
    border-color: var(--border-subtle);
    box-shadow: var(--shadow-soft);
    color: var(--text-primary);
  }

  .card-hoverable {
    @apply transition focus-visible:ring-2;
  }

  .card-hoverable:hover {
    border-color: var(--color-accent);
    background: var(--surface-card-hover);
  }

  .card-hoverable:focus-visible {
    --tw-ring-color: var(--focus-ring);
  }

  .card-selected {
    border-color: color-mix(in srgb, var(--color-accent) 58%, transparent);
    background: var(--color-accent-soft);
    color: var(--color-accent-strong);
  }

  .card-soft {
    @apply rounded-2xl border p-4;
    background: var(--surface-card);
    border-color: var(--border-subtle);
    color: var(--text-primary);
  }

  .card-compact {
    @apply w-full rounded-2xl border p-2;
    background: var(--surface-card);
    border-color: var(--border-subtle);
    color: var(--text-primary);
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
    @apply rounded-[1.4rem] border p-6;
    background: var(--surface-panel-strong);
    border-color: var(--border-subtle);
    color: var(--text-primary);
  }
</style>
