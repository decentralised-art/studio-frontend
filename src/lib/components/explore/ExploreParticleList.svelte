<script lang="ts">
  import Card from "$lib/components/ui/Card.svelte";
  import ExploreParticleCard from "$lib/components/explore/ExploreParticleCard.svelte";
  import type { ExploreParticle, ParticleView } from "$lib/data/exploreParticles";
  import type { User } from "$lib/data/users";

  const {
    particles = [],
    views = [],
    usersById = {},
    selectedId,
    onSelect,
    onAuthorSelect,
  }: {
    particles?: ExploreParticle[];
    views?: ParticleView[];
    usersById?: Record<User["id"], User>;
    selectedId?: ExploreParticle["id"];
    onSelect?: (id: ExploreParticle["id"]) => void;
    onAuthorSelect?: (id: User["id"]) => void;
  } = $props();

  const getViewLabel = (id: ParticleView["id"]) =>
    views.find((view) => view.id === id)?.label ?? "Unknown view";

  const getAuthor = (id: User["id"]) =>
    usersById[id] ?? {
      id,
      kind: "human",
      address: "",
      nickname: "Unknown",
      avatarUrl: "",
      authored: {
        performativeTransactions: 0,
        features: 0,
        transformations: 0,
        conditions: 0,
      },
      toolbox: [],
    };
</script>

<div class="list">
  {#if particles.length === 0}
    <Card variant="soft">
      <p class="empty">No particles match these filters yet.</p>
    </Card>
  {:else}
    {#each particles as particle (particle.id)}
      <ExploreParticleCard
        {particle}
        author={getAuthor(particle.authorId)}
        viewLabel={getViewLabel(particle.viewId)}
        selected={particle.id === selectedId}
        {onSelect}
        {onAuthorSelect}
      />
    {/each}
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .list {
    @apply space-y-4;
  }

  .empty {
    @apply text-sm text-white/60;
  }
</style>
