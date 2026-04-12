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
      border border-white/10 bg-white/5
      px-2.5 py-1 text-[0.7rem] uppercase
      tracking-[0.15em] text-white/60;
  }

  .tag-accent {
    @apply border-emerald-500/60 bg-emerald-500/10 text-emerald-300;
  }

  .tag-outline {
    @apply border-white/30 bg-transparent text-white/70;
  }

  .tag-preserve-case {
    text-transform: none;
    letter-spacing: 0.02em;
  }
</style>
