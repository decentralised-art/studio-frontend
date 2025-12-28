<script lang="ts">
  import type { Snippet } from "svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";

  const {
    children,
    onClose,
    onBack,
    canGoBack = false,
  }: {
    children?: Snippet;
    onClose?: () => void;
    onBack?: () => void;
    canGoBack?: boolean;
  } = $props();
</script>

<SectionShell>
  {#if onClose}
    <div class="panel-header">
      {#if canGoBack && onBack}
        <Button type="button" variant="ghost" ariaLabel="Back" onclick={onBack}>Back</Button>
      {/if}

      <div class="panel-spacer">
        <Button type="button" variant="ghost" ariaLabel="Close" onclick={onClose}>X</Button>
      </div>
    </div>
  {/if}

  <div class="panel-content">
    {@render children?.()}
  </div>
</SectionShell>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .panel-header {
    @apply flex items-center gap-2 pb-3;
  }

  .panel-spacer {
    @apply ml-auto;
  }

  .panel-content {
    @apply space-y-4;
  }
</style>
