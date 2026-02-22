<script lang="ts">
  import Card from "$lib/components/ui/Card.svelte";
  import SocialParticleDependencyFlow from "$lib/components/social/SocialParticleDependencyFlow.svelte";
  import { mockUsersById } from "$lib/data/users";
  import { formatEventSummary, type SocialEvent } from "$lib/social/mockSocialFeed";
  const {
    event,
    onParticleOpen,
  }: {
    event: SocialEvent;
    onParticleOpen?: ((particleId: string) => void) | undefined;
  } = $props();

  const author = $derived.by(() => mockUsersById[event.authorId] ?? null);
  const summary = $derived.by(() => formatEventSummary(event));
</script>

<Card variant="soft">
  <article class="social-event-card">
    <header class="event-header">
      <div class="event-author">
        {#if author}
          <img class="author-avatar" src={author.avatarUrl} alt={`${author.nickname} avatar`} />
        {:else}
          <div class="author-avatar author-avatar--fallback" aria-hidden="true">?</div>
        {/if}
        <div class="author-meta">
          <div class="author-row">
            <p class="author-name">{author?.nickname ?? event.authorId}</p>
          </div>
          <p class="event-time">{event.createdLabel}</p>
        </div>
      </div>
    </header>

    <div class="event-graph">
      <SocialParticleDependencyFlow particleId={event.particleId} {onParticleOpen} />
    </div>

    <div class="event-body">
      <p class="event-summary">{summary}</p>
    </div>
  </article>
</Card>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  :global(.card-soft) {
    @apply w-full;
  }

  .social-event-card {
    @apply text-white/90 flex flex-col gap-2.5;
  }

  .event-header {
    @apply flex items-center gap-2;
  }

  .event-author {
    @apply flex items-center gap-2.5 min-w-0;
  }

  .author-avatar {
    @apply h-10 w-10 rounded-xl border border-white/10 bg-white/5 object-cover shrink-0;
  }

  .author-avatar--fallback {
    @apply flex items-center justify-center text-white/70 font-semibold;
  }

  .author-meta {
    @apply min-w-0;
  }

  .author-row {
    @apply flex items-center gap-2;
  }

  .author-name {
    @apply text-sm md:text-[0.95rem] font-semibold tracking-[0.03em] text-white;
  }

  .event-time {
    @apply mt-0.5 text-[0.62rem] uppercase tracking-[0.16em] text-white/45;
  }

  .event-body {
    @apply grid gap-1;
  }

  .event-summary {
    @apply text-sm leading-snug text-white/90;
  }

  .event-graph {
    @apply order-2;
  }

  @media (max-width: 768px) {
    .event-graph :global(.social-dependency-flow) {
      min-height: 260px;
    }
  }
</style>
