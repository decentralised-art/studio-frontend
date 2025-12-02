<script lang="ts">
  import type { Snippet } from "svelte";

  const {
    title = "",
    subtitle = "",
    className = "",
    dot = false,

    children,
    actions,
  }: {
    title?: string;
    subtitle?: string;
    className?: string;
    dot?: boolean;

    children?: Snippet; // default slot
    actions?: Snippet; // named slot: slot="actions"
  } = $props();
</script>

<section class={`section-shell ${className}`}>
  <header class="section-shell-header">
    <div class="flex items-center gap-3">
      {#if dot}
        <span class="section-shell-dot"></span>
      {/if}

      <div>
        <h2 class="section-shell-title">{title}</h2>
        {#if subtitle}
          <p class="section-shell-subtitle">{subtitle}</p>
        {/if}
      </div>
    </div>

    <div class="flex items-center gap-2">
      {@render actions?.()}
    </div>
  </header>

  <div class="space-y-4">
    {@render children?.()}
  </div>
</section>
