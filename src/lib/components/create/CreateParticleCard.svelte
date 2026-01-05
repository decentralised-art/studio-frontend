<script lang="ts">
  import Card from "$lib/components/ui/Card.svelte";
  import type { ExploreParticle } from "$lib/data/exploreParticles";
  import type { User } from "$lib/data/users";

  const {
    particle,
    author,
    selected = false,
    onSelect,
    onAuthorSelect,
    onAdd,
  }: {
    particle: ExploreParticle;
    author: User;
    selected?: boolean;
    onSelect?: (id: ExploreParticle["id"]) => void;
    onAuthorSelect?: (id: User["id"]) => void;
    onAdd?: (particle: ExploreParticle) => void;
  } = $props();

  const handleSelect = () => {
    onSelect?.(particle.id);
  };

  const handleAuthorSelect = (event: MouseEvent) => {
    event.stopPropagation();
    onAuthorSelect?.(author.id);
  };

  const handleAdd = (event: MouseEvent) => {
    event.stopPropagation();
    onAdd?.(particle);
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelect();
    }
  };
</script>

<Card
  variant="compact"
  tabindex={0}
  ariaPressed={selected}
  onclick={handleSelect}
  onkeydown={handleKeydown}
  {selected}
>
  <div class="card-row">
    <div class="card-text">
      <span class="particle-name">{particle.name}</span>
      <span class="by-label">by</span>
      <button class="author" type="button" onclick={handleAuthorSelect}>
        {author.nickname}
      </button>
    </div>

    <button class="add-button" type="button" onclick={handleAdd}>Add</button>
  </div>
</Card>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .card-row {
    @apply flex items-center justify-between gap-2;
  }

  .card-text {
    @apply min-w-0 flex items-center gap-2 text-[0.72rem] text-white/70;
  }

  .particle-name {
    @apply min-w-0 font-semibold text-white truncate;
  }

  .by-label {
    @apply text-[0.6rem] uppercase tracking-[0.2em] text-white/40 whitespace-nowrap;
  }

  .author {
    @apply min-w-0 text-white/60 truncate;
  }

  .add-button {
    @apply text-[0.6rem] uppercase tracking-[0.2em]
      rounded-md border border-emerald-500/40 px-2 py-1
      text-emerald-200 hover:bg-emerald-500/10;
  }
</style>
