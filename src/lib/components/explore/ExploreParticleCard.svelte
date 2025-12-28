<script lang="ts">
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
    className = "",
  }: {
    particle: ExploreParticle;
    author: User;
    viewLabel?: string;
    selected?: boolean;
    onSelect?: (id: ExploreParticle["id"]) => void;
    onAuthorSelect?: (id: User["id"]) => void;
    className?: string;
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
  variant="soft"
  className={`transition hover:border-white/25 hover:bg-white/10 ${
    selected ? "border-emerald-400/40 bg-emerald-500/5 shadow-[0_0_24px_rgba(34,197,94,0.15)]" : ""
  } ${className}`}
>
  <div
    role="button"
    tabindex="0"
    aria-pressed={selected}
    onclick={handleSelect}
    onkeydown={handleKeydown}
    class="w-full text-left cursor-pointer focus:outline-none
    focus-visible:ring-2 focus-visible:ring-emerald-400/50
    focus-visible:ring-offset-2 focus-visible:ring-offset-black"
  >
    <div class="flex flex-col gap-4">
      <div class="flex gap-4">
        <div
          class="h-10 w-10 shrink-0 rounded-full border border-white/10 bg-white/10
          text-xs font-semibold text-white/70 flex items-center justify-center overflow-hidden"
        >
          {#if author.avatarUrl}
            <img
              src={author.avatarUrl}
              alt={author.nickname}
              class="h-full w-full object-cover"
              loading="lazy"
            />
          {:else}
            {getInitials(author.nickname)}
          {/if}
        </div>

        <div class="space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <Tag variant="accent">{viewLabel}</Tag>
            <span class="mono-label">{particle.createdLabel}</span>
          </div>

          <p class="text-sm text-white/70">
            Author:
            <button
              type="button"
              class="ml-1 text-white font-semibold hover:text-emerald-200 transition"
              onclick={handleAuthorSelect}
            >
              {author.nickname}
            </button>
          </p>

          <div>
            <h3 class="text-base font-semibold text-white">{particle.name}</h3>
            <p class="text-sm text-white/60">{particle.summary}</p>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-[0.65rem] uppercase tracking-[0.32em] text-white/40">
          Built from
        </span>
        <div class="flex flex-wrap gap-2">
          {#if particle.ingredients.length === 0}
            <Tag variant="outline">Original composition</Tag>
          {:else}
            {#each visibleIngredients as ingredient (ingredient)}
              <Tag variant="outline">{ingredient}</Tag>
            {/each}
            {#if extraCount > 0}
              <Tag variant="outline">+{extraCount} more</Tag>
            {/if}
          {/if}
        </div>
      </div>
    </div>
  </div>
</Card>
