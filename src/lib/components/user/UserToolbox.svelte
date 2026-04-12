<script lang="ts">
  import Tag from "$lib/components/ui/Tag.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import type { User } from "$lib/data/users";
  import { mockExploreParticles } from "$lib/data/exploreParticles";

  const { user }: { user: User } = $props();

  const toolboxParticles = $derived.by(() =>
    user.toolbox
      .map((id) => mockExploreParticles.find((p) => p.id === id))
      .filter((p): p is (typeof mockExploreParticles)[number] => Boolean(p)),
  );
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
    {#if toolboxParticles.length === 0}
      <Tag variant="outline">No saved connectors yet</Tag>
    {:else}
      {#each toolboxParticles as particle (particle.id)}
        <Tag variant="outline" preserveCase>{particle.name}</Tag>
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
