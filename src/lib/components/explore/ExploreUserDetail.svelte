<script lang="ts">
  import Card from "$lib/components/ui/Card.svelte";
  import Tag from "$lib/components/ui/Tag.svelte";
  import type { ExploreParticle } from "$lib/data/exploreParticles";
  import type { User } from "$lib/data/users";

  const {
    user,
    particlesById = {},
  }: {
    user: User;
    particlesById?: Record<ExploreParticle["id"], ExploreParticle>;
  } = $props();

  const kindLabel = user.kind === "agent" ? "AI agent" : "Human";
  const shortAddress =
    user.address.length > 12
      ? `${user.address.slice(0, 6)}...${user.address.slice(-4)}`
      : user.address;

  const toolboxParticles = user.toolbox
    .map((id) => particlesById[id])
    .filter((particle): particle is ExploreParticle => Boolean(particle));
</script>

<div class="space-y-4">
  <Card variant="soft">
    <div class="flex flex-wrap items-start gap-4">
      <div class="h-14 w-14 rounded-full border border-white/10 bg-white/10 overflow-hidden">
        {#if user.avatarUrl}
          <img src={user.avatarUrl} alt={user.nickname} class="h-full w-full object-cover" />
        {:else}
          <div
            class="h-full w-full flex items-center justify-center text-sm font-semibold text-white/70"
          >
            {user.nickname.slice(0, 2).toUpperCase()}
          </div>
        {/if}
      </div>

      <div class="space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="text-lg font-semibold text-white">{user.nickname}</h3>
          <Tag variant="outline">{kindLabel}</Tag>
        </div>

        <div class="text-xs text-white/50 uppercase tracking-[0.2em]">Ethereum address</div>
        <div class="font-mono text-sm text-white/70">{shortAddress}</div>

        {#if user.bio}
          <p class="text-sm text-white/60">{user.bio}</p>
        {/if}
      </div>
    </div>
  </Card>

  <Card variant="soft">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm font-semibold text-white">Authored contributions</p>
      <Tag variant="outline">Counts</Tag>
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p class="mono-label">PTs</p>
        <p class="text-xl font-semibold text-white">
          {user.authored.performativeTransactions}
        </p>
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p class="mono-label">Features</p>
        <p class="text-xl font-semibold text-white">{user.authored.features}</p>
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p class="mono-label">Transformations</p>
        <p class="text-xl font-semibold text-white">{user.authored.transformations}</p>
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p class="mono-label">Conditions</p>
        <p class="text-xl font-semibold text-white">{user.authored.conditions}</p>
      </div>
    </div>
  </Card>

  <Card variant="soft">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-sm font-semibold text-white">Toolbox</p>
        <p class="text-xs text-white/50">
          Stored particles tied to {user.nickname}'s address.
        </p>
      </div>
      <Tag variant="outline">{user.toolbox.length} particles</Tag>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      {#if toolboxParticles.length === 0}
        <Tag variant="outline">No saved particles yet</Tag>
      {:else}
        {#each toolboxParticles as particle (particle.id)}
          <Tag variant="outline">{particle.name}</Tag>
        {/each}
      {/if}
    </div>
  </Card>
</div>
