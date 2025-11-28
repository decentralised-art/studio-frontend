<script lang="ts">
  export let title: string = '';
  export let subtitle: string = '';
  export let className = '';
  export let dot : boolean = false;
</script>

<section class={`section-shell ${className}`}>
  <header class="section-shell-header">
    <div class="flex items-center gap-3">
      {#if dot}<span class="section-shell-dot"></span>{/if}
      <div>
        <h2 class="section-shell-title">{title}</h2>
        {#if subtitle}
          <p class="section-shell-subtitle">{subtitle}</p>
        {/if}
      </div>
    </div>

    <div class="flex items-center gap-2">
      <slot name="actions" />
    </div>
  </header>

  <div class="space-y-4">
    <slot />
  </div>
</section>
