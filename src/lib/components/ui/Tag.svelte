<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "default" | "accent" | "outline";

  const {
    variant = "default",
    preserveCase = false,
    children,
  }: {
    variant?: Variant;
    preserveCase?: boolean;
    children?: Snippet;
  } = $props();

  const variants: Record<Variant, string> = {
    default: "tag",
    accent: "tag-accent",
    outline: "tag-outline",
  };
</script>

<span class={`tag ${variants[variant]} ${preserveCase ? "tag-preserve-case" : ""}`}>
  {@render children?.()}
</span>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .tag {
    @apply inline-flex items-center gap-1 rounded-full
      border
      px-2.5 py-1 text-[0.7rem] uppercase
      tracking-[0.15em];
    background: var(--surface-panel-soft);
    border-color: var(--border-subtle);
    color: var(--text-muted);
  }

  .tag-accent {
    border-color: color-mix(in srgb, var(--color-accent) 58%, transparent);
    background: var(--color-accent-soft);
    color: var(--color-accent-strong);
  }

  .tag-outline {
    background: transparent;
    border-color: var(--border-strong);
    color: var(--text-muted);
  }

  .tag-preserve-case {
    text-transform: none;
    letter-spacing: 0.02em;
  }
</style>
