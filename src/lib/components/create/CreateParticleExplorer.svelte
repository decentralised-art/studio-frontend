<script lang="ts">
  import CreateParticleCard from "$lib/components/create/CreateParticleCard.svelte";
  import type { ExploreParticle, ParticleView } from "$lib/data/exploreParticles";
  import type { User } from "$lib/data/users";

  type ViewFilter = ParticleView["id"] | "all";
  type AuthorFilter = User["id"] | "all";

  let {
    particles = [],
    views = [],
    usersById = {},
    authors = [],
    selectedId,
    selectedViewId = $bindable("all"),
    selectedAuthorId = $bindable("all"),
    onSelect,
    onAuthorSelect,
    onAdd,
  }: {
    particles?: ExploreParticle[];
    views?: ParticleView[];
    usersById?: Record<User["id"], User>;
    authors?: User[];
    selectedId?: ExploreParticle["id"];
    selectedViewId?: ViewFilter;
    selectedAuthorId?: AuthorFilter;
    onSelect?: (id: ExploreParticle["id"]) => void;
    onAuthorSelect?: (id: User["id"]) => void;
    onAdd?: (particle: ExploreParticle) => void;
  } = $props();

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

<section class="explorer">
  <div class="explorer-header">
    <div class="header-text">
      <span class="eyebrow">Particle explorer</span>
      <h2 class="title">Particles</h2>
    </div>
    <span class="count">{particles.length}</span>
  </div>

  <div class="filters">
    <label class="filter">
      <span class="filter-label">View</span>
      <div class="select-wrap">
        <select class="select" bind:value={selectedViewId}>
          <option value="all">All views</option>
          {#each views as view (view.id)}
            <option value={view.id}>{view.label}</option>
          {/each}
        </select>
        <span class="select-icon" aria-hidden="true">v</span>
      </div>
    </label>

    <label class="filter">
      <span class="filter-label">Author</span>
      <div class="select-wrap">
        <select class="select" bind:value={selectedAuthorId}>
          <option value="all">All authors</option>
          {#each authors as author (author.id)}
            <option value={author.id}>{author.nickname}</option>
          {/each}
        </select>
        <span class="select-icon" aria-hidden="true">v</span>
      </div>
    </label>
  </div>

  <div class="list">
    {#if particles.length === 0}
      <p class="empty">No particles match these filters yet.</p>
    {:else}
      {#each particles as particle (particle.id)}
        <CreateParticleCard
          {particle}
          author={getAuthor(particle.authorId)}
          selected={particle.id === selectedId}
          {onSelect}
          {onAuthorSelect}
          {onAdd}
        />
      {/each}
    {/if}
  </div>
</section>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .explorer {
    @apply flex flex-col flex-1 min-h-0 gap-3
      rounded-2xl border border-white/10 bg-black/70 p-3;
  }

  .explorer-header {
    @apply flex items-center justify-between gap-2;
  }

  .header-text {
    @apply flex flex-col;
  }

  .eyebrow {
    @apply text-[0.55rem] font-mono uppercase tracking-[0.28em] text-white/40;
  }

  .title {
    @apply text-sm font-semibold text-white;
  }

  .count {
    @apply text-[0.55rem] uppercase tracking-[0.24em] text-white/40;
  }

  .filters {
    @apply flex flex-col gap-2;
  }

  .filter {
    @apply flex flex-col gap-1;
  }

  .filter-label {
    @apply text-[0.6rem] uppercase tracking-[0.22em] text-white/40;
  }

  .select-wrap {
    @apply relative;
  }

  .select {
    @apply w-full rounded-lg border border-white/15 bg-black
      px-2.5 py-1.5 text-[0.72rem] text-white
      focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400
      focus-visible:border-emerald-400/60;
    padding-right: 1.5rem;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
  }

  .select-icon {
    @apply pointer-events-none absolute right-2 top-1/2 -translate-y-1/2
      text-[0.55rem] text-white/50;
  }

  .list {
    @apply flex-1 min-h-0 overflow-y-auto space-y-1 pr-1;
  }

  .empty {
    @apply text-[0.7rem] text-white/50;
  }
</style>
