<script lang="ts">
  import SocialCodeEventCard from "$lib/components/social/SocialCodeEventCard.svelte";
  import SocialEventCard from "$lib/components/social/SocialEventCard.svelte";
  import SocialFormatEventCard from "$lib/components/social/SocialFormatEventCard.svelte";
  import type { NetworkFeedEvent } from "$lib/feed/particlePostData";

  const {
    events,
    loading = false,
    loadingMore = false,
    hasMore = false,
    onLoadMore,
    onParticleOpen,
    onAddToToolbox,
    toolboxParticleIds = new Set<string>(),
    authorLabelById,
    authorAvatarUrlById,
    emptyMessage = "No events to display yet.",
  }: {
    events: NetworkFeedEvent[];
    loading?: boolean;
    loadingMore?: boolean;
    hasMore?: boolean;
    onLoadMore?: (() => void | Promise<void>) | undefined;
    onParticleOpen?: ((particleId: string) => void) | undefined;
    onAddToToolbox?: ((particleId: string) => void) | undefined;
    toolboxParticleIds?: ReadonlySet<string>;
    authorLabelById?: Readonly<Record<string, string>>;
    authorAvatarUrlById?: Readonly<Record<string, string>>;
    emptyMessage?: string;
  } = $props();

  let loadMorePending = false;
  const loadMoreThresholdPx = 160;

  const requestLoadMore = async () => {
    if (!onLoadMore || loadMorePending || loading || loadingMore || !hasMore) return;
    loadMorePending = true;
    try {
      await onLoadMore();
    } finally {
      loadMorePending = false;
    }
  };

  const handleFeedScroll = (event: Event) => {
    const container = event.currentTarget as HTMLElement | null;
    if (!container) return;
    const remaining = container.scrollHeight - (container.scrollTop + container.clientHeight);
    if (remaining <= loadMoreThresholdPx) {
      void requestLoadMore();
    }
  };
</script>

<section class="social-feed" aria-label="Activity feed" onscroll={handleFeedScroll}>
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
            {authorLabelById}
            {authorAvatarUrlById}
            inToolbox={toolboxParticleIds.has(event.particleId)}
          />
        {:else if event.type === "format"}
          <SocialFormatEventCard {event} {authorLabelById} {authorAvatarUrlById} />
        {:else}
          <SocialCodeEventCard {event} {authorLabelById} {authorAvatarUrlById} />
        {/if}
      </div>
    {/each}
    {#if loadingMore}
      <div class="feed-load-more">Loading more…</div>
    {:else if hasMore}
      <button type="button" class="feed-load-more-btn" onclick={() => void requestLoadMore()}>
        Load more
      </button>
    {/if}
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

  .feed-load-more {
    @apply text-xs uppercase tracking-[0.18em] text-white/45 py-1;
  }

  .feed-load-more-btn {
    @apply rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em]
      text-white/70 transition;
  }

  .feed-load-more-btn:hover {
    @apply border-white/30 bg-white/10 text-white;
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
