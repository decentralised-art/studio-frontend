<script lang="ts">
  import type { Snippet } from "svelte";
  import type { MouseEventHandler, KeyboardEventHandler } from "svelte/elements";

  type Variant = "primary" | "ghost" | "subtle";
  type ButtonType = "button" | "submit";

  type OnClick<T extends EventTarget = HTMLButtonElement> = MouseEventHandler<T> | null | undefined;
  type OnKeyDown<T extends EventTarget = HTMLButtonElement> =
    | KeyboardEventHandler<T>
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
    children,
    onclick,
    onkeydown,
  }: {
    variant?: Variant;
    type?: ButtonType;
    selected?: boolean;
    disabled?: boolean;
    tabindex?: number;
    ariaPressed?: boolean;
    ariaLabel?: string;
    children?: Snippet;
    onclick?: OnClick;
    onkeydown?: OnKeyDown;
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
  class={`btn ${variants[variant]} ${selected ? "btn-selected" : ""}`}
  {tabindex}
  aria-pressed={ariaPressed}
  aria-label={ariaLabel}
  {onclick}
  {onkeydown}
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
      focus-visible:ring-offset-black disabled:opacity-40
      disabled:cursor-not-allowed whitespace-nowrap;
  }

  .btn-selected {
    @apply border border-emerald-500/60 bg-emerald-500/10 text-emerald-300;
  }

  .btn-primary {
    @apply px-4 py-2
      bg-emerald-500 text-black
      shadow-md shadow-emerald-500/40
      hover:bg-emerald-400 hover:shadow-lg
      focus-visible:ring-emerald-400;
  }

  .btn-ghost {
    @apply px-3 py-2
      bg-white/5 text-white
      border border-white/10
      hover:bg-white/10 hover:border-white/20;
  }

  .btn-subtle {
    @apply px-3 py-2
      bg-white/0 text-white/70
      hover:bg-white/5 hover:text-white;
  }
</style>
