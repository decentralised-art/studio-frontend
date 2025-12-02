<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "default" | "accent" | "outline";

  const {
    variant = "default",
    className = "",
    children,
  }: {
    variant?: Variant;
    className?: string;
    children?: Snippet;
  } = $props();

  const variants: Record<Variant, string> = {
    default: "tag",
    accent: "tag-accent",
    outline: "tag-outline",
  };
</script>

<span class={`tag ${variants[variant]} ${className}`}>
  {@render children?.()}
</span>
