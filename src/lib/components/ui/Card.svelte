<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "default" | "soft" | "gradient-border";

  const {
    variant = "default",
    className = "",
    children,
  }: {
    variant?: Variant;
    className?: string;
    children?: Snippet;
  } = $props();
</script>

{#if variant === "gradient-border"}
  <div class={`card-gradient-border ${className}`}>
    <div class="card-inner">
      {@render children?.()}
    </div>
  </div>
{:else if variant === "soft"}
  <section class={`card-soft ${className}`}>
    {@render children?.()}
  </section>
{:else}
  <section class={`card ${className}`}>
    {@render children?.()}
  </section>
{/if}
