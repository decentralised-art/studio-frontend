<script lang="ts">
  import type { Snippet } from "svelte";
  import type { DragEventHandler, MouseEventHandler, KeyboardEventHandler } from "svelte/elements";

  type Variant = "primary" | "ghost" | "subtle";
  type ButtonType = "button" | "submit";

  type OnClick<T extends EventTarget = HTMLButtonElement> = MouseEventHandler<T> | null | undefined;
  type OnKeyDown<T extends EventTarget = HTMLButtonElement> =
    | KeyboardEventHandler<T>
    | undefined
    | null;
  type OnDragStart<T extends EventTarget = HTMLButtonElement> =
    | DragEventHandler<T>
    | undefined
    | null;

  const {
    variant = "primary",
    type = "button",
    selected = false,
    disabled = false,
    tabindex,
    ariaPressed,
    ariaLabel,
    title,
    className = "",
    children,
    draggable = false,
    onclick,
    onkeydown,
    ondragstart,
  }: {
    variant?: Variant;
    type?: ButtonType;
    selected?: boolean;
    disabled?: boolean;
    tabindex?: number;
    ariaPressed?: boolean;
    ariaLabel?: string;
    title?: string;
    className?: string;
    children?: Snippet;
    draggable?: boolean;
    onclick?: OnClick;
    onkeydown?: OnKeyDown;
    ondragstart?: OnDragStart;
  } = $props();

  const variants: Record<Variant, string> = {
    primary: "btn-primary",
    ghost: "btn-ghost",
    subtle: "btn-subtle",
  };
</script>

<button
  {type}
  {disabled}
  class={`btn ${variants[variant]} ${selected ? "btn-selected" : ""} ${className}`}
  {tabindex}
  aria-pressed={ariaPressed}
  aria-label={ariaLabel}
  {title}
  {draggable}
  {onclick}
  {onkeydown}
  {ondragstart}
>
  {@render children?.()}
</button>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .btn {
    @apply inline-flex gap-2
      rounded-md text-sm font-semibold tracking-wide
      transition-all duration-150
      focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
      disabled:opacity-40
      disabled:cursor-not-allowed whitespace-nowrap;
    --tw-ring-color: var(--focus-ring);
    --tw-ring-offset-color: var(--surface-page);
  }

  .btn-selected {
    border: 1px solid color-mix(in srgb, var(--color-accent) 58%, transparent);
    background: var(--color-accent-soft);
    color: var(--color-accent-strong);
  }

  .btn-primary {
    @apply px-4 py-2
      shadow-md shadow-emerald-500/40
      hover:bg-emerald-400 hover:shadow-lg
      focus-visible:ring-emerald-400;
    background: var(--color-accent);
    color: var(--text-inverse);
  }

  .btn-ghost {
    @apply px-3 py-2 border;
    background: var(--surface-panel-soft);
    border-color: var(--border-subtle);
    color: var(--text-primary);
  }

  .btn-ghost:hover {
    background: var(--surface-card-hover);
    border-color: var(--border-strong);
  }

  .btn-subtle {
    @apply px-3 py-2;
    background: transparent;
    color: var(--text-muted);
  }

  .btn-subtle:hover {
    background: var(--surface-panel-soft);
    color: var(--text-primary);
  }
</style>
