<script lang="ts">
  export let label = '';
  export let help = '';
  export let id: string | undefined = undefined;
  export let type = 'text';
  export let value = '';
  export let placeholder = '';
  export let className = '';

  const handleInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    value = target.value;
    // re-emit
    const custom = new CustomEvent('change', { detail: value });
    dispatchEvent(custom);
  };
</script>

<div class={className}>
  {#if label}
    <label class="input-label" for={id}>{label}</label>
  {/if}

  <input
    class="input mt-1"
    bind:value
    {id}
    {type}
    {placeholder}
    on:input
  />

  {#if help}
    <p class="input-help">{help}</p>
  {/if}
</div>
