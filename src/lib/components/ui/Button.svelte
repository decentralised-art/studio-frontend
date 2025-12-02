<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "primary" | "ghost" | "subtle";
  type ButtonType = "button" | "submit";

  const {
    variant = "primary",
    type = "button",
    disabled = false,
    className = "",
    children,
  }: {
    variant?: Variant;
    type?: ButtonType;
    disabled?: boolean;
    className?: string;
    children?: Snippet;
  } = $props();

  const variants: Record<Variant, string> = {
    primary: "btn-primary",
    ghost: "btn-ghost",
    subtle: "btn-subtle",
  };
</script>

<button {type} {disabled} class={`btn ${variants[variant]} ${className}`}>
  {@render children?.()}
</button>
