<script lang="ts">
  import Button from "$lib/components/ui/Button.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Tag from "$lib/components/ui/Tag.svelte";
  import type { ExploreParticle } from "$lib/data/exploreParticles";
  import type { User } from "$lib/data/users";

  const {
    particle,
    author,
    viewLabel = "Unknown view",
    selected = false,
    onSelect,
    onAuthorSelect,
  }: {
    particle: ExploreParticle;
    author: User;
    viewLabel?: string;
    selected?: boolean;
    onSelect?: (id: ExploreParticle["id"]) => void;
    onAuthorSelect?: (id: User["id"]) => void;
  } = $props();

  const getInitials = (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");

  const visibleIngredients = particle.ingredients.slice(0, 3);
  const extraCount = particle.ingredients.length - visibleIngredients.length;

  const handleSelect = () => {
    onSelect?.(particle.id);
  };

  const handleAuthorSelect = (event: MouseEvent) => {
    event.stopPropagation();
    onAuthorSelect?.(author.id);
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelect();
    }
  };
</script>

<Card
  tabindex={0}
  ariaPressed={selected}
  onclick={handleSelect}
  onkeydown={handleKeydown}
  {selected}
>
  <div class="card-root">
    <div class="header-row">
      <div class="avatar">
        {#if author.avatarUrl}
          <img src={author.avatarUrl} alt={author.nickname} class="avatar-img" loading="lazy" />
        {:else}
          <span class="avatar-fallback">
            {getInitials(author.nickname)}
          </span>
        {/if}
      </div>

      <div class="meta">
        <div class="meta-top">
          <Tag variant="accent">{viewLabel}</Tag>
          <span class="mono-label">{particle.createdLabel}</span>
        </div>

        <div class="author-row">
          <span class="author-label">Author:</span>
          <Button type="button" variant="subtle" onclick={handleAuthorSelect}>
            {author.nickname}
          </Button>
        </div>

        <div class="title-block">
          <h3 class="title">{particle.name}</h3>
          <p class="summary">{particle.summary}</p>
        </div>
      </div>
    </div>

    <div class="ingredients">
      <span class="ingredients-label">Built from</span>

      <div class="ingredients-tags">
        {#if particle.ingredients.length === 0}
          <Tag variant="outline">Original composition</Tag>
        {:else}
          {#each visibleIngredients as ingredient (ingredient)}
            <Tag variant="outline" preserveCase>{ingredient}</Tag>
          {/each}
          {#if extraCount > 0}
            <Tag variant="outline">+{extraCount} more</Tag>
          {/if}
        {/if}
      </div>
    </div>
  </div>
</Card>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .card-root {
    @apply flex flex-col gap-4;
  }

  .header-row {
    @apply flex gap-4;
  }

  .avatar {
    @apply h-10 w-10 shrink-0 rounded-full
      border border-white/10 bg-white/10
      flex items-center justify-center
      overflow-hidden text-xs font-semibold text-white/70;
  }

  .avatar-img {
    @apply h-full w-full object-cover;
  }

  .avatar-fallback {
    @apply select-none;
  }

  .meta {
    @apply space-y-2;
  }

  .meta-top {
    @apply flex flex-wrap items-center gap-2;
  }

  .author-row {
    @apply flex items-center gap-2;
  }

  .author-label {
    @apply text-sm text-white/70;
  }

  .title-block {
    @apply flex flex-col items-start text-left;
  }

  .title {
    @apply text-base font-semibold text-white;
  }

  .summary {
    @apply text-sm text-white/60;
  }

  .ingredients {
    @apply flex flex-col gap-2;
  }

  .ingredients-label {
    @apply inline-flex text-[0.65rem] uppercase tracking-[0.32em] text-white/40;
  }

  .ingredients-tags {
    @apply flex flex-wrap gap-2;
  }

  .mono-label {
    @apply text-[0.7rem] font-mono tracking-[0.28em] uppercase text-white/40;
  }
</style>
