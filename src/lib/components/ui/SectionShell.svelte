<script lang="ts">
  import type { Snippet } from "svelte";
  type Variant = "primary" | "subtle";

  const {
    title = "",
    subtitle = "",
    variant = "primary",
    className = "",
    dot = false,
    children,
    actions,
  }: {
    title?: string;
    subtitle?: string;
    variant?: Variant;
    className?: string;
    dot?: boolean;
    children?: Snippet; // default slot
    actions?: Snippet; // named slot: slot="actions"
  } = $props();
</script>

<section
  class={`section-shell ${variant === "primary" ? "section-primary" : "section-subtle"} ${className}`}
>
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

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .section-shell {
    @apply relative w-full max-w-6xl mx-auto
      rounded-[1.75rem];
  }

  .section-shell-header {
    @apply mb-6 flex flex-wrap items-center justify-between gap-3;
  }

  .section-shell-title {
    @apply text-base sm:text-lg font-semibold tracking-wide;
    color: var(--text-primary);
  }

  .section-shell-subtitle {
    @apply text-xs sm:text-sm max-w-xl;
    color: var(--text-muted);
  }

  /* little glowing dot for section headers */
  .section-shell-dot {
    @apply h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(34,197,94,0.8)];
  }

  .section-primary {
    @apply border p-6 sm:p-8;
    background: linear-gradient(180deg, var(--surface-card), var(--surface-panel));
    border-color: var(--border-subtle);
    box-shadow: var(--shadow-soft);
  }

  .section-subtle {
  }
</style>
