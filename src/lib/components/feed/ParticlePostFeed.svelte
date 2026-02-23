<script lang="ts">
  import SocialEventCard from "$lib/components/social/SocialEventCard.svelte";
  import type { SocialEvent } from "$lib/social/mockSocialFeed";

  const {
    events,
    onParticleOpen,
    onAddToToolbox,
    toolboxParticleIds = new Set<string>(),
    emptyMessage = "No events to display yet.",
  }: {
    events: SocialEvent[];
    onParticleOpen?: ((particleId: string) => void) | undefined;
    onAddToToolbox?: ((particleId: string) => void) | undefined;
    toolboxParticleIds?: ReadonlySet<string>;
    emptyMessage?: string;
  } = $props();
</script>

<section class="social-feed" aria-label="Activity feed">
  {#if events.length === 0}
    <div class="feed-empty">
      <p>{emptyMessage}</p>
    </div>
  {:else}
    {#each events as event (event.id)}
      <div class="feed-card-shell">
        <SocialEventCard
          {event}
          {onParticleOpen}
          {onAddToToolbox}
          inToolbox={toolboxParticleIds.has(event.particleId)}
        />
      </div>
    {/each}
  {/if}
</section>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .social-feed {
    @apply min-h-0 overflow-y-auto grid gap-3 pb-2 justify-items-center pr-1;
    align-content: start;
  }

  .feed-card-shell {
    @apply mx-auto;
    width: var(--social-feed-card-width, min(50vw, 56rem));
    max-width: 100%;
  }

  .feed-empty {
    @apply rounded-3xl border border-white/10 bg-black/40 p-6 text-center text-white/70 mx-auto;
    width: var(--social-feed-card-width, min(50vw, 56rem));
    max-width: 100%;
  }
</style>
