<script lang="ts">
  import { resolve } from "$app/paths";
  import Card from "$lib/components/ui/Card.svelte";
  import SocialParticleDependencyFlow from "$lib/components/social/SocialParticleDependencyFlow.svelte";
  import { displayUsersById } from "$lib/data/users";
  import type { SocialEvent } from "$lib/social/mockSocialFeed";
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

  const author = $derived.by(() => displayUsersById[event.authorId] ?? null);
  const usedParticles = $derived.by(() =>
    event.usedParticleIds.map((id, index) => ({
      id,
      label: event.usedParticleLabels[index] ?? id,
    })),
  );
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
        <path
          d="M12 20.4c-.3 0-.7-.1-.9-.3C7.6 17.2 4 14.2 4 9.9 4 7.1 6.1 5 8.9 5c1.4 0 2.7.6 3.6 1.6C13.4 5.6 14.7 5 16.1 5 18.9 5 21 7.1 21 9.9c0 4.3-3.6 7.3-7.1 10.2-.2.2-.6.3-.9.3Z"
        ></path>
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
            <div class="author-identity">
              <a class="author-name author-link" href={resolve("/u/[id]", { id: event.authorId })}
                >{author?.nickname ?? event.authorId}</a
              >
              {#if event.createdLabel}
                <p class="event-time">{event.createdLabel}</p>
              {/if}
            </div>
            <span class="author-event-text">
              created a new particle:
              <a class="event-particle-link" href={resolve("/p/[id]", { id: event.particleId })}>
                {event.particleLabel}
              </a>
            </span>
          </div>
        </div>
      </div>
    </header>

    <div class="event-graph">
      <SocialParticleDependencyFlow particleId={event.particleId} {onParticleOpen} />
    </div>

    <div class="event-body">
      <div class="event-links" aria-label="Particle dependencies">
        {#if usedParticles.length > 0}
          <p class="event-link-row">
            <span class="event-link-label">Dependencies:</span>
            <span class="event-dependency-links">
              {#each usedParticles as particleRef, index (particleRef.id)}
                <a class="event-dependency-link" href={resolve("/p/[id]", { id: particleRef.id })}>
                  {particleRef.label}
                </a>
                {#if index < usedParticles.length - 1}
                  <span class="event-link-separator" aria-hidden="true">, </span>
                {/if}
              {/each}
            </span>
          </p>
        {/if}
      </div>
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

  .toolbox-add-button:not(.is-saved) svg {
    fill: transparent;
  }

  .toolbox-add-button.is-saved svg {
    fill: currentColor;
    fill-opacity: 0.15;
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
    @apply hover:text-white/85 transition;
    text-decoration: none;
  }

  .event-time {
    @apply mt-0.5 text-[0.62rem] uppercase tracking-[0.16em] text-white/45;
  }

  .author-event-text {
    @apply text-sm text-white/75 leading-snug;
    align-self: baseline;
  }

  .event-body {
    @apply grid gap-1;
  }

  .event-links {
    @apply grid gap-1 text-xs;
  }

  .event-link-row {
    @apply flex flex-wrap items-baseline gap-x-2 gap-y-1 text-white/70 leading-snug;
  }

  .event-link-label {
    @apply uppercase tracking-[0.14em] text-[0.62rem] text-white/40;
  }

  .event-particle-link,
  .event-dependency-link {
    @apply text-white/85 hover:text-white no-underline transition;
  }

  .event-particle-link {
    @apply font-medium;
  }

  .event-dependency-links {
    @apply flex flex-wrap items-baseline;
  }

  .event-link-separator {
    @apply text-white/35;
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
