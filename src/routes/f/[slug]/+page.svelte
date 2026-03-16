<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { resolve } from "$app/paths";
  import Button from "$lib/components/ui/Button.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import ParticlePostFeed from "$lib/components/feed/ParticlePostFeed.svelte";
  import {
    findParticlesByTerminalSet,
    listParticlePosts,
    syncParticlePostDataFromChain,
    type NetworkFeedEvent,
    type ParticleRecord,
  } from "$lib/feed/particlePostData";
  import {
    getLocalFormatBySlug,
    loadLocalFormats,
    type ParticleFormat,
  } from "$lib/formats/localFormats";
  import { mockCurrentUserId, mockUsersById } from "$lib/data/users";
  import { networkNodeStudioKind } from "$lib/network/mockNetworkGraph";

  let format = $state<ParticleFormat | null>(null);
  let loading = $state(true);
  let loadError = $state("");
  let matchingParticles = $state<ParticleRecord[]>([]);
  let relatedPosts = $state<NetworkFeedEvent[]>([]);
  let localToolboxParticles = $state<string[]>([
    ...(mockUsersById[mockCurrentUserId]?.toolbox ?? []),
  ]);

  const toolboxParticleIds = $derived.by(() => new Set(localToolboxParticles));
  const author = $derived.by(() => (format ? (mockUsersById[format.authorId] ?? null) : null));

  const loadFormatPage = async () => {
    loading = true;
    loadError = "";
    try {
      await syncParticlePostDataFromChain();
      const slug = ($page.params.slug ?? "").trim();
      const nextFormat = getLocalFormatBySlug(slug, loadLocalFormats());
      format = nextFormat;
      if (!nextFormat) {
        matchingParticles = [];
        relatedPosts = [];
        return;
      }
      matchingParticles = findParticlesByTerminalSet(nextFormat.terminalParticleIds);
      const matchingIds = new Set(matchingParticles.map((particle) => particle.id));
      relatedPosts = listParticlePosts().filter(
        (event) => event.type === "connector" && matchingIds.has(event.particleId),
      );
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Unable to load format page.";
    } finally {
      loading = false;
    }
  };

  const openParticleInStudio = (particleId: string) => {
    const base = resolve("/studio");
    const target = new URL(base, window.location.origin);
    target.searchParams.set("network_kind", networkNodeStudioKind("particle"));
    target.searchParams.set("network_id", particleId);
    window.open(target.toString(), "_blank", "noopener,noreferrer");
  };

  const addParticleToToolbox = (particleId: string) => {
    if (toolboxParticleIds.has(particleId)) return;
    localToolboxParticles = [...localToolboxParticles, particleId];
    const currentUser = mockUsersById[mockCurrentUserId];
    if (currentUser && !currentUser.toolbox.includes(particleId)) {
      currentUser.toolbox = [...currentUser.toolbox, particleId];
    }
  };

  onMount(() => {
    void loadFormatPage();
  });
</script>

<div class="format-page">
  {#if loading}
    <SectionShell className="page-card-shell">
      <div class="status">
        <p class="status-title">Loading format...</p>
        <p class="status-subtitle">Fetching chain-backed particles and local format data.</p>
      </div>
    </SectionShell>
  {:else if loadError}
    <SectionShell className="page-card-shell">
      <div class="status">
        <p class="status-title">Unable to load format</p>
        <p class="status-subtitle">{loadError}</p>
      </div>
      <div class="status-actions">
        <Button variant="primary" type="button" onclick={loadFormatPage}>Retry</Button>
      </div>
    </SectionShell>
  {:else if !format}
    <SectionShell className="page-card-shell">
      <div class="status">
        <p class="status-title">Format not found</p>
        <p class="status-subtitle">No local format matches this URL.</p>
      </div>
    </SectionShell>
  {:else}
    <section class="format-overview page-card-shell" aria-label="Format overview">
      <p class="format-kicker">Format Page</p>
      <h1 class="format-title">{format.name}</h1>
      <p class="format-meta">
        <span>{author?.nickname ?? format.authorId}</span>
        <span aria-hidden="true">•</span>
        <span>{format.terminalParticleIds.length} terminal particles</span>
      </p>

      <div class="terminal-particles" aria-label="Terminal particles">
        <p class="terminal-label">Terminal particles</p>
        <div class="terminal-list">
          {#each format.terminalParticleIds as particleId (particleId)}
            <a class="terminal-pill" href={resolve("/p/[id]", { id: particleId })}>{particleId}</a>
          {/each}
        </div>
      </div>
    </section>

    <section class="page-card-shell matches-section" aria-label="Matching particles">
      <div class="matches-head">
        <p class="matches-title">Matching particles</p>
        <p class="matches-subtitle">{matchingParticles.length} particles match this terminal set</p>
      </div>
      {#if matchingParticles.length === 0}
        <p class="matches-empty">No synced particles currently match this format.</p>
      {:else}
        <div class="matches-list">
          {#each matchingParticles as particle (particle.id)}
            <a class="match-row" href={resolve("/p/[id]", { id: particle.id })}>
              <div class="match-meta">
                <p class="match-name">{particle.name}</p>
                <p class="match-summary">{particle.summary}</p>
              </div>
              <Button
                variant="ghost"
                type="button"
                onclick={(event) => {
                  event.preventDefault();
                  openParticleInStudio(particle.id);
                }}
              >
                Open in Studio
              </Button>
            </a>
          {/each}
        </div>
      {/if}
    </section>

    <div class="page-card-shell">
      <ParticlePostFeed
        events={relatedPosts}
        onParticleOpen={openParticleInStudio}
        onAddToToolbox={addParticleToToolbox}
        {toolboxParticleIds}
        emptyMessage="No posts for particles in this format yet."
      />
    </div>
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .format-page {
    @apply space-y-4 pt-3 md:pt-4;
    --social-feed-card-width: min(50vw, 56rem);
  }

  .page-card-shell {
    @apply mx-auto;
    width: var(--social-feed-card-width);
    max-width: 100%;
  }

  .format-overview,
  .matches-section {
    @apply rounded-3xl border border-white/10 bg-black/35 backdrop-blur-sm p-4 md:p-5;
  }

  .format-kicker {
    @apply text-[0.62rem] uppercase tracking-[0.18em] text-white/45;
  }

  .format-title {
    @apply mt-1 text-2xl md:text-[1.8rem] font-semibold text-white leading-tight;
  }

  .format-meta {
    @apply mt-2 flex flex-wrap items-center gap-2 text-sm text-white/60;
  }

  .terminal-particles {
    @apply mt-4 grid gap-2;
  }

  .terminal-label {
    @apply text-[0.62rem] uppercase tracking-[0.16em] text-white/45;
  }

  .terminal-list {
    @apply flex flex-wrap gap-2;
  }

  .terminal-pill {
    @apply rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 no-underline hover:border-white/25 hover:text-white transition;
  }

  .matches-head {
    @apply flex flex-wrap items-baseline justify-between gap-2;
  }

  .matches-title {
    @apply text-base font-semibold text-white;
  }

  .matches-subtitle {
    @apply text-xs text-white/50;
  }

  .matches-empty {
    @apply mt-3 text-sm text-white/60;
  }

  .matches-list {
    @apply mt-3 grid gap-2;
  }

  .match-row {
    @apply flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 no-underline;
  }

  .match-meta {
    @apply min-w-0;
  }

  .match-name {
    @apply text-sm font-medium text-white;
  }

  .match-summary {
    @apply text-xs text-white/55 line-clamp-1;
  }

  .status {
    @apply space-y-2;
  }

  .status-title {
    @apply text-lg font-semibold text-white;
  }

  .status-subtitle {
    @apply text-sm text-white/60;
  }

  .status-actions {
    @apply mt-4 flex gap-2;
  }

  @media (max-width: 1200px) {
    .format-page {
      --social-feed-card-width: min(68vw, 56rem);
    }
  }

  @media (max-width: 900px) {
    .format-page {
      --social-feed-card-width: 100%;
    }

    .match-row {
      @apply flex-col items-stretch;
    }
  }
</style>
