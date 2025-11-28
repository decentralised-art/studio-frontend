<script lang="ts">
  export let label = '';
  export let help = '';
  export let id: string | undefined;
  export let type = 'text';
  export let value = '';
  export let placeholder = '';
  export let className = '';

  // We re-emit the DOM event by just forwarding it.
  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    value = target.value;
    // Re-emit the same event, but with new value
    // Svelte 5 automatically makes this available to parent components
    dispatchEvent(new InputEvent("input", { bubbles: true }));
  }
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
    on:input={handleInput}
  />

  {#if help}
    <p class="input-help">{help}</p>
  {/if}
</div>
