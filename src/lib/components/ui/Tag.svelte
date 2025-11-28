<script lang="ts">
  export let variant: 'default' | 'accent' | 'outline' = 'default';
  export let className = '';
</script>

<span
  class={`tag ${
    variant === 'accent'
      ? 'tag-accent'
      : variant === 'outline'
      ? 'tag-outline'
      : 'tag'
  } ${className}`}
>
  <slot />
</span>
