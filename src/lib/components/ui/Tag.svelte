<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "default" | "accent" | "outline";

  const props = $props<{
    variant?: Variant;
    className?: string;
    children?: Snippet;
  }>();

  const variant: Variant = props.variant ?? "default";
  const className: string = props.className ?? "";
  const children: Snippet = props.children ?? (() => null);

  const variants: Record<Variant, string> = {
    default: "tag",
    accent: "tag-accent",
    outline: "tag-outline",
  };
</script>

<span class={`tag ${variants[variant]} ${className}`}>
  {@render children()}
</span>
