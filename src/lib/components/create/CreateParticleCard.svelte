<script lang="ts">
  import Card from "$lib/components/ui/Card.svelte";
  import type { ExploreParticle } from "$lib/data/exploreParticles";
  import type { User } from "$lib/data/users";

  const {
    particle,
    author,
    selected = false,
    draggable = false,
    onSelect,
    onAuthorSelect,
    onAdd,
    onToolbox,
    onDragStart,
    onOpen,
  }: {
    particle: ExploreParticle;
    author: User;
    selected?: boolean;
    draggable?: boolean;
    onSelect?: (id: ExploreParticle["id"]) => void;
    onAuthorSelect?: (id: User["id"]) => void;
    onAdd?: (particle: ExploreParticle) => void;
    onToolbox?: (particle: ExploreParticle) => void;
    onDragStart?: (event: DragEvent, particle: ExploreParticle) => void;
    onOpen?: (id: ExploreParticle["id"]) => void;
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

  const handleToolbox = (event: MouseEvent) => {
    event.stopPropagation();
    onToolbox?.(particle);
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelect();
    }
  };

  const handleOpen = (event: MouseEvent) => {
    event.stopPropagation();
    onOpen?.(particle.id);
  };

  const handleDragStart = (event: DragEvent) => {
    onDragStart?.(event, particle);
  };
</script>

<Card
  variant="compact"
  tabindex={0}
  ariaPressed={selected}
  onclick={handleSelect}
  ondblclick={handleOpen}
  onkeydown={handleKeydown}
  ondragstart={handleDragStart}
  {draggable}
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

    <div class="card-actions">
      <button class="icon-button" type="button" title="Add to toolbox" onclick={handleToolbox}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M19.5 12.572 12 20l-7.5-7.428a4.5 4.5 0 0 1 6.364-6.364L12 7.5l1.136-1.292a4.5 4.5 0 0 1 6.364 6.364Z"
          ></path>
        </svg>
      </button>
      <button class="icon-button" type="button" title="Add to flow" onclick={handleAdd}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14"></path>
        </svg>
      </button>
    </div>
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

  .card-actions {
    @apply flex items-center gap-1;
  }

  .icon-button {
    @apply h-6 w-6 flex items-center justify-center
      rounded-md border border-white/10 bg-white/5
      text-white/60 hover:text-white hover:border-white/30;
  }

  .icon-button svg {
    @apply h-3.5 w-3.5;
    stroke: currentColor;
    stroke-width: 1.6;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
