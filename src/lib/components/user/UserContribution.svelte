<script lang="ts">
  import Card from "$lib/components/ui/Card.svelte";
  import Tag from "$lib/components/ui/Tag.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import type { User } from "$lib/data/users";

  const { user }: { user: User } = $props();
</script>

<SectionShell>
  <div class="header">
    <p class="title">Authored contributions</p>
    <Tag variant="outline">Counts</Tag>
  </div>

  <div class="grid">
    <Card variant="default">
      <p class="mono-label">PTs</p>
      <p class="value">{user.authored.performativeTransactions}</p>
    </Card>

    <Card variant="default">
      <p class="mono-label">Connectors</p>
      <p class="value">{user.authored.features}</p>
    </Card>

    <Card variant="default">
      <p class="mono-label">Transformations</p>
      <p class="value">{user.authored.transformations}</p>
    </Card>

    <Card variant="default">
      <p class="mono-label">Conditions</p>
      <p class="value">{user.authored.conditions}</p>
    </Card>
  </div>
</SectionShell>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .header {
    @apply flex items-center justify-between gap-3;
  }

  .title {
    @apply text-sm font-semibold text-white;
  }

  .grid {
    @apply mt-4 grid gap-3 sm:grid-cols-2;
  }

  .value {
    @apply text-xl font-semibold text-white;
  }

  .mono-label {
    @apply text-[0.7rem] font-mono tracking-[0.28em] uppercase text-white/40;
  }
</style>
