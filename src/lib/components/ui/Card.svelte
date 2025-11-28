<script lang="ts">
  export let variant: 'default' | 'soft' | 'gradient-border' = 'default';
  export let className = '';
</script>

{#if variant === 'gradient-border'}
  <div class={`card-gradient-border ${className}`}>
    <div class="card-inner">
      <slot />
    </div>
  </div>
{:else if variant === 'soft'}
  <section class={`card-soft ${className}`}>
    <slot />
  </section>
{:else}
  <section class={`card ${className}`}>
    <slot />
  </section>
{/if}
