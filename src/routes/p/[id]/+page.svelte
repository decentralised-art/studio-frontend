<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { resolve } from "$app/paths";

  import ParticlePostFeed from "$lib/components/feed/ParticlePostFeed.svelte";
  import {
    ensureParticleRecordLoadedById,
    getParticleRecordById,
    listParticlePostsReferencingParticle,
    syncParticlePostDataFromChain,
    type ParticlePostEvent,
    type ParticleRecord,
  } from "$lib/feed/particlePostData";
  import SocialParticleDependencyFlow from "$lib/components/social/SocialParticleDependencyFlow.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import { addConnectorToCurrentUserToolbox, getCurrentUserToolboxLibrary } from "$lib/auth/api";
  import { displayUsersById, mockCurrentUserId, mockUsersById } from "$lib/data/users";
  import { getChainFormatDisplayName } from "$lib/formats/chainFormats";
  import { networkNodeStudioKind } from "$lib/network/mockNetworkGraph";

  let localToolboxParticles = $state<string[]>([
    ...(mockUsersById[mockCurrentUserId]?.toolbox ?? []),
  ]);
  let particle = $state<ParticleRecord | null>(null);
  let relatedEvents = $state<ParticlePostEvent[]>([]);
  let particleLoading = $state(true);

  const toolboxParticleIds = $derived.by(() => new Set(localToolboxParticles));
  const particleId = $derived.by(() => $page.params.id?.trim() ?? "");
  const author = $derived.by(() =>
    particle ? (displayUsersById[particle.authorId] ?? null) : null,
  );
  const particleFormatName = $derived.by(() =>
    particle?.formatHash ? getChainFormatDisplayName(particle.formatHash) : "",
  );

  const openParticleInStudio = (targetParticleId: string) => {
    const base = resolve("/studio");
    const target = new URL(base, window.location.origin);
    target.searchParams.set("network_kind", networkNodeStudioKind("feature"));
    target.searchParams.set("network_id", targetParticleId);
    window.open(target.toString(), "_blank", "noopener,noreferrer");
  };

  const addParticleToToolbox = (targetParticleId: string) => {
    if (toolboxParticleIds.has(targetParticleId)) return;
    const previous = [...localToolboxParticles];
    localToolboxParticles = [...localToolboxParticles, targetParticleId];
    const currentUser = mockUsersById[mockCurrentUserId];
    if (currentUser && !currentUser.toolbox.includes(targetParticleId)) {
      currentUser.toolbox = [...currentUser.toolbox, targetParticleId];
    }
    void addConnectorToCurrentUserToolbox(targetParticleId).catch((err) => {
      console.error("[Connector page] Failed to persist toolbox update.", err);
      localToolboxParticles = previous;
    });
  };

  const loadParticlePageData = async () => {
    particleLoading = true;
    try {
      await syncParticlePostDataFromChain();
    } finally {
      particle = getParticleRecordById(particleId);
      if (!particle && particleId) {
        particle = await ensureParticleRecordLoadedById(particleId);
      }
      relatedEvents = listParticlePostsReferencingParticle(particleId);
      particleLoading = false;
    }
  };

  onMount(() => {
    void getCurrentUserToolboxLibrary()
      .then((toolbox) => {
        localToolboxParticles = [...toolbox.connector];
      })
      .catch((error) => {
        console.warn("[Connector page] Failed to load toolbox from profile.", error);
      });
    void loadParticlePageData();
  });
</script>

<div class="particle-page">
  {#if particleLoading}
    <SectionShell className="page-card-shell">
      <div class="status">
        <p class="status-title">Loading connector...</p>
        <p class="status-subtitle">Fetching chain-backed connector data.</p>
      </div>
    </SectionShell>
  {:else if !particle}
    <SectionShell className="page-card-shell">
      <div class="status">
        <p class="status-title">Connector not found</p>
        <p class="status-subtitle">No synced connector matches this ID yet.</p>
      </div>
    </SectionShell>
  {:else}
    <section class="particle-overview page-card-shell" aria-label="Connector overview">
      <div class="particle-head">
        <div class="particle-head-main">
          <p class="particle-kicker">Connector Page</p>
          <h1 class="particle-title">{particle.name}</h1>
          <p class="particle-meta">
            <span>{particle.createdLabel}</span>
            <span aria-hidden="true">•</span>
            {#if author}
              <a class="particle-author-link" href={resolve("/u/[id]", { id: author.id })}>
                {author.nickname}
              </a>
            {:else}
              <span>{particle.authorId}</span>
            {/if}
            {#if particle.formatHash}
              <span aria-hidden="true">•</span>
              <a
                class="particle-author-link"
                href={resolve("/f/[slug]", { slug: particle.formatHash })}
              >
                {particleFormatName}
              </a>
            {/if}
          </p>
          <p class="particle-summary">{particle.summary}</p>
        </div>

        <div class="particle-head-actions">
          <Button
            variant={toolboxParticleIds.has(particle!.id) ? "ghost" : "primary"}
            type="button"
            disabled={toolboxParticleIds.has(particle!.id)}
            onclick={() => addParticleToToolbox(particle!.id)}
          >
            {toolboxParticleIds.has(particle!.id) ? "In toolbox" : "Add to toolbox"}
          </Button>
          <Button variant="ghost" type="button" onclick={() => openParticleInStudio(particle!.id)}>
            Open in Studio
          </Button>
        </div>
      </div>

      <div class="particle-flow-shell">
        <SocialParticleDependencyFlow
          particleId={particle.id}
          onParticleOpen={openParticleInStudio}
          displayMode="page"
        />
      </div>
    </section>

    <div class="page-card-shell">
      <ParticlePostFeed
        events={relatedEvents}
        onParticleOpen={openParticleInStudio}
        onAddToToolbox={addParticleToToolbox}
        {toolboxParticleIds}
        emptyMessage={`No connectors reference ${particle.name} yet.`}
      />
    </div>
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .particle-page {
    @apply space-y-4 pt-3 md:pt-4;
    --social-feed-card-width: min(50vw, 56rem);
  }

  .page-card-shell {
    @apply mx-auto;
    width: var(--social-feed-card-width);
    max-width: 100%;
  }

  .particle-overview {
    @apply rounded-3xl border border-white/10 bg-black/35 backdrop-blur-sm p-4 md:p-5;
  }

  .particle-head {
    @apply flex flex-col gap-4 md:flex-row md:items-start md:justify-between;
  }

  .particle-head-main {
    @apply min-w-0;
  }

  .particle-kicker {
    @apply text-[0.62rem] uppercase tracking-[0.18em] text-white/45;
  }

  .particle-title {
    @apply mt-1 text-2xl md:text-[1.8rem] font-semibold text-white leading-tight;
  }

  .particle-meta {
    @apply mt-2 flex flex-wrap items-center gap-2 text-sm text-white/60;
  }

  .particle-author-link {
    @apply text-white/85 hover:text-white transition no-underline;
  }

  .particle-summary {
    @apply mt-3 text-sm leading-relaxed text-white/80;
  }

  .particle-head-actions {
    @apply flex flex-wrap gap-2 shrink-0;
  }

  .particle-flow-shell {
    @apply mt-4;
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

  @media (max-width: 1200px) {
    .particle-page {
      --social-feed-card-width: min(68vw, 56rem);
    }
  }

  @media (max-width: 900px) {
    .particle-page {
      --social-feed-card-width: 100%;
    }
  }
</style>
