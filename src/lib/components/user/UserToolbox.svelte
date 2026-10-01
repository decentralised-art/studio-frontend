<script lang="ts">
  import Tag from "$lib/components/ui/Tag.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import type { User } from "$lib/data/users";
  const { user }: { user: User } = $props();
</script>

<SectionShell>
  <div class="header">
    <div class="header-text">
      <p class="title">Toolbox</p>
      <p class="subtitle">Stored connectors tied to {user.nickname}'s address.</p>
    </div>

    <Tag variant="outline">{user.toolbox.length} connectors</Tag>
  </div>

  <div class="content">
    {#if user.toolbox.length === 0}
      <Tag variant="outline">No saved connectors yet</Tag>
    {:else}
      {#each user.toolbox as connectorId (connectorId)}
        <Tag variant="outline" preserveCase>{connectorId}</Tag>
      {/each}
    {/if}
  </div>
</SectionShell>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .header {
    @apply flex items-center justify-between gap-3;
  }

  .header-text {
    @apply min-w-0;
  }

  .title {
    @apply text-sm font-semibold text-white;
  }

  .subtitle {
    @apply text-xs text-white/50;
  }

  .content {
    @apply mt-4 flex flex-wrap gap-2;
  }
</style>
