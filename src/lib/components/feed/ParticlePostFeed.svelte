<script lang="ts">
  import SocialCodeEventCard from "$lib/components/social/SocialCodeEventCard.svelte";
  import SocialEventCard from "$lib/components/social/SocialEventCard.svelte";
  import type { NetworkFeedEvent } from "$lib/feed/particlePostData";

  const {
    events,
    loading = false,
    onParticleOpen,
    onAddToToolbox,
    toolboxParticleIds = new Set<string>(),
    emptyMessage = "No events to display yet.",
  }: {
    events: NetworkFeedEvent[];
    loading?: boolean;
    onParticleOpen?: ((particleId: string) => void) | undefined;
    onAddToToolbox?: ((particleId: string) => void) | undefined;
    toolboxParticleIds?: ReadonlySet<string>;
    emptyMessage?: string;
  } = $props();
</script>

<section class="social-feed" aria-label="Activity feed">
  {#if loading && events.length === 0}
    {#each Array.from({ length: 3 }) as _, index (`skeleton-${index}`)}
      <div class="feed-card-shell">
        <div class="feed-skeleton" aria-hidden="true">
          <div class="feed-skeleton-head">
            <div class="feed-skeleton-avatar shimmer"></div>
            <div class="feed-skeleton-lines">
              <div class="feed-skeleton-line shimmer line-lg"></div>
              <div class="feed-skeleton-line shimmer line-sm"></div>
            </div>
            <div class="feed-skeleton-icon shimmer"></div>
          </div>
          <div class="feed-skeleton-graph shimmer"></div>
          <div class="feed-skeleton-line shimmer line-md"></div>
        </div>
      </div>
    {/each}
  {:else if events.length === 0}
    <div class="feed-empty">
      <p>{emptyMessage}</p>
    </div>
  {:else}
    {#each events as event (event.id)}
      <div class="feed-card-shell">
        {#if event.type === "connector"}
          <SocialEventCard
            {event}
            {onParticleOpen}
            {onAddToToolbox}
            inToolbox={toolboxParticleIds.has(event.particleId)}
          />
        {:else}
          <SocialCodeEventCard {event} />
        {/if}
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

  .feed-skeleton {
    @apply rounded-3xl border border-white/10 bg-black/30 p-4 grid gap-3;
  }

  .feed-skeleton-head {
    @apply flex items-center gap-3;
  }

  .feed-skeleton-avatar {
    @apply h-10 w-10 rounded-xl border border-white/10 bg-white/5 shrink-0;
  }

  .feed-skeleton-lines {
    @apply min-w-0 flex-1 grid gap-2;
  }

  .feed-skeleton-line {
    @apply h-3 rounded-full bg-white/10;
  }

  .feed-skeleton-line.line-lg {
    width: min(78%, 22rem);
  }

  .feed-skeleton-line.line-md {
    width: min(62%, 18rem);
  }

  .feed-skeleton-line.line-sm {
    width: 7.5rem;
    height: 0.55rem;
  }

  .feed-skeleton-icon {
    @apply h-8 w-8 rounded-lg border border-white/10 bg-white/5 shrink-0;
  }

  .feed-skeleton-graph {
    @apply h-[18rem] rounded-2xl border border-white/5 bg-black/40;
  }

  .shimmer {
    animation: feed-skeleton-pulse 1.4s ease-in-out infinite;
  }

  @keyframes feed-skeleton-pulse {
    0%,
    100% {
      opacity: 0.45;
    }
    50% {
      opacity: 0.9;
    }
  }
</style>
