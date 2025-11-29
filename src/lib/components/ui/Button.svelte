<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "primary" | "ghost" | "subtle";
  type ButtonType = "button" | "submit";

  const props = $props<{
    variant?: Variant;
    type?: ButtonType;
    disabled?: boolean;
    className?: string;
    children?: Snippet; // <- slot content is a Snippet
  }>();

  const variant: Variant = props.variant ?? "primary";
  const type: ButtonType = props.type ?? "button";
  const disabled: boolean = props.disabled ?? false;
  const className: string = props.className ?? "";

  // Fallback snippet if there is no children
  const slot: Snippet = props.children ?? (() => null);

  const variants: Record<Variant, string> = {
    primary: "btn-primary",
    ghost: "btn-ghost",
    subtle: "btn-subtle",
  };
</script>

<button {type} {disabled} class={`btn ${variants[variant]} ${className}`}>
  {@render slot()}
</button>
