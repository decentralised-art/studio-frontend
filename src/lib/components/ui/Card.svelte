<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "default" | "soft" | "gradient-border";

  const props = $props<{
    variant?: Variant;
    className?: string;
    children?: Snippet;
  }>();

  const variant: Variant = props.variant ?? "default";
  const className: string = props.className ?? "";
  const children: Snippet = props.children ?? (() => null);
</script>

{#if variant === "gradient-border"}
  <div class={`card-gradient-border ${className}`}>
    <div class="card-inner">
      {@render children()}
    </div>
  </div>
{:else if variant === "soft"}
  <section class={`card-soft ${className}`}>
    {@render children()}
  </section>
{:else}
  <section class={`card ${className}`}>
    {@render children()}
  </section>
{/if}
