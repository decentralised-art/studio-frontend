<script lang="ts">
  import { resolve } from "$app/paths";
  import Card from "$lib/components/ui/Card.svelte";
  import SocialParticleDependencyFlow from "$lib/components/social/SocialParticleDependencyFlow.svelte";
  import { mockUsersById } from "$lib/data/users";
  import { formatEventSummary, type SocialEvent } from "$lib/social/mockSocialFeed";
  const {
    event,
    onParticleOpen,
    onAddToToolbox,
    inToolbox = false,
  }: {
    event: SocialEvent;
    onParticleOpen?: ((particleId: string) => void) | undefined;
    onAddToToolbox?: ((particleId: string) => void) | undefined;
    inToolbox?: boolean;
  } = $props();

  const author = $derived.by(() => mockUsersById[event.authorId] ?? null);
  const summary = $derived.by(() => formatEventSummary(event));
  const handleAddToToolbox = (eventClick: MouseEvent) => {
    eventClick.preventDefault();
    eventClick.stopPropagation();
    if (inToolbox) return;
    onAddToToolbox?.(event.particleId);
  };
</script>

<Card variant="soft">
  <article class="social-event-card">
    <button
      type="button"
      class={`toolbox-add-button ${inToolbox ? "is-saved" : ""}`}
      title={inToolbox ? "Already in toolbox" : "Add to toolbox"}
      aria-label={inToolbox ? "Particle already in toolbox" : "Add particle to toolbox"}
      aria-pressed={inToolbox}
      onclick={handleAddToToolbox}
      disabled={inToolbox}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14"></path>
      </svg>
    </button>

    <header class="event-header">
      <div class="event-author">
        {#if author}
          <img class="author-avatar" src={author.avatarUrl} alt={`${author.nickname} avatar`} />
        {:else}
          <div class="author-avatar author-avatar--fallback" aria-hidden="true">?</div>
        {/if}
        <div class="author-meta">
          <div class="author-row">
            <a class="author-name author-link" href={resolve("/u/[id]", { id: event.authorId })}
              >{author?.nickname ?? event.authorId}</a
            >
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
    @apply relative text-white/90 flex flex-col gap-2.5;
  }

  .toolbox-add-button {
    @apply absolute top-0.5 right-0.5 z-10 h-8 w-8 rounded-lg border border-white/12 bg-black/45
      text-white/70 transition;
    display: grid;
    place-items: center;
    backdrop-filter: blur(8px);
  }

  .toolbox-add-button:hover:not(:disabled) {
    @apply border-white/30 text-white bg-black/65;
  }

  .toolbox-add-button:disabled {
    @apply cursor-default opacity-100;
  }

  .toolbox-add-button.is-saved {
    @apply border-[#8de58f]/45 bg-[#8de58f]/15 text-[#8de58f];
  }

  .toolbox-add-button svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .event-header {
    @apply flex items-center gap-2 pr-10;
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

  .author-link {
    @apply hover:text-white/85 transition;
    text-decoration: none;
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
