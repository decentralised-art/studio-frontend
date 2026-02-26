<script lang="ts">
  import { resolve } from "$app/paths";
  import Card from "$lib/components/ui/Card.svelte";
  import { mockUsersById } from "$lib/data/users";
  import type { FormatFeedEvent } from "$lib/formats/localFormats";

  const { event }: { event: FormatFeedEvent } = $props();
  const author = $derived.by(() => mockUsersById[event.authorId] ?? null);
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
            <div class="author-identity">
              <a class="author-name author-link" href={resolve("/u/[id]", { id: event.authorId })}
                >{author?.nickname ?? event.authorId}</a
              >
              <p class="event-time">{event.createdLabel}</p>
            </div>
            <span class="author-event-text">
              created a format:
              <a class="event-format-link" href={resolve("/f/[slug]", { slug: event.formatSlug })}>
                {event.formatName}
              </a>
            </span>
          </div>
        </div>
      </div>
    </header>

    <div class="event-body">
      <p class="event-link-row">
        <span class="event-link-label">Dependencies:</span>
        <span class="event-dependency-links">
          {#each event.terminalParticleIds as particleId, index (particleId)}
            <a class="event-dependency-link" href={resolve("/p/[id]", { id: particleId })}>
              {event.terminalParticleLabels[index] ?? particleId}
            </a>
            {#if index < event.terminalParticleIds.length - 1}
              <span class="event-link-separator" aria-hidden="true">, </span>
            {/if}
          {/each}
        </span>
      </p>
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
    @apply flex flex-wrap items-baseline gap-x-2 gap-y-1;
  }

  .author-identity {
    @apply min-w-0;
    line-height: 1;
  }

  .author-name {
    @apply text-sm md:text-[0.95rem] font-semibold tracking-[0.03em] text-white;
  }

  .author-link {
    @apply hover:text-white/85 transition no-underline;
  }

  .event-time {
    @apply mt-0.5 text-[0.62rem] uppercase tracking-[0.16em] text-white/45;
  }

  .author-event-text {
    @apply text-sm text-white/75 leading-snug;
    align-self: baseline;
  }

  .event-format-link,
  .event-dependency-link {
    @apply text-white/85 hover:text-white no-underline transition;
  }

  .event-format-link {
    @apply font-medium;
  }

  .event-body {
    @apply grid gap-1;
  }

  .event-link-row {
    @apply flex flex-wrap items-baseline gap-x-2 gap-y-1 text-white/70 leading-snug text-xs;
  }

  .event-link-label {
    @apply uppercase tracking-[0.14em] text-[0.62rem] text-white/40;
  }

  .event-dependency-links {
    @apply flex flex-wrap items-baseline;
  }

  .event-link-separator {
    @apply text-white/35;
  }
</style>
