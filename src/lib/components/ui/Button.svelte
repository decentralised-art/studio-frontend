<script lang="ts">
  export let variant: 'primary' | 'ghost' | 'subtle' = 'primary';
  export let type: 'button' | 'submit' = 'button';
  export let disabled = false;
  export let className = '';
</script>

<button
  {type}
  {disabled}
  class={`btn ${
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'ghost'
      ? 'btn-ghost'
      : 'btn-subtle'
  } ${className}`}
>
  <slot />
</button>
