<script lang="ts">
  // Svelte 5 runes API
  let {
    label = "",
    help = "",
    id,
    type = "text",
    value = $bindable(""),
    placeholder = "",
    className = "",
  } = $props<{
    label?: string;
    help?: string;
    id?: string;
    type?: string;
    value?: string;
    placeholder?: string;
    className?: string;
  }>();
</script>

<div class={className}>
  {#if label}
    <label class="input-label" for={id}>{label}</label>
  {/if}

  <input class="input mt-1" bind:value {id} {type} {placeholder} />

  {#if help}
    <p class="input-help">{help}</p>
  {/if}
</div>
