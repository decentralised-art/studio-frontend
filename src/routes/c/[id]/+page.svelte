<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { resolve } from "$app/paths";

  import ParticlePostFeed from "$lib/components/feed/ParticlePostFeed.svelte";
  import {
    ensureParticleRecordLoadedById as ensureConnectorRecordLoadedById,
    getParticleRecordById as getConnectorRecordById,
    listParticlePostsReferencingParticle as listPostsReferencingConnector,
    syncParticlePostDataFromChain,
    type ParticlePostEvent as ConnectorPostEvent,
    type ParticleRecord as ConnectorRecord,
  } from "$lib/feed/particlePostData";
  import SocialParticleDependencyFlow from "$lib/components/social/SocialParticleDependencyFlow.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import { addParticleToCurrentUserToolbox, getCurrentUserToolboxLibrary } from "$lib/auth/api";
  import { displayUsersById, mockCurrentUserId, mockUsersById } from "$lib/data/users";
  import { getChainFormatDisplayName } from "$lib/formats/chainFormats";
  import { networkNodeStudioKind } from "$lib/network/mockNetworkGraph";

  let localToolboxConnectors = $state<string[]>([
    ...(mockUsersById[mockCurrentUserId]?.toolbox ?? []),
  ]);
  let connector = $state<ConnectorRecord | null>(null);
  let relatedConnectorEvents = $state<ConnectorPostEvent[]>([]);
  let connectorLoading = $state(true);

  const toolboxConnectorIds = $derived.by(() => new Set(localToolboxConnectors));
  const connectorId = $derived.by(() => $page.params.id?.trim() ?? "");
  const author = $derived.by(() =>
    connector ? (displayUsersById[connector.authorId] ?? null) : null,
  );
  const connectorFormatName = $derived.by(() =>
    connector?.formatHash ? getChainFormatDisplayName(connector.formatHash) : "",
  );

  const openConnectorInStudio = (targetConnectorId: string) => {
    const base = resolve("/studio");
    const target = new URL(base, window.location.origin);
    target.searchParams.set("network_kind", networkNodeStudioKind("connector"));
    target.searchParams.set("network_id", targetConnectorId);
    window.open(target.toString(), "_blank", "noopener,noreferrer");
  };

  const addConnectorToToolbox = (targetConnectorId: string) => {
    if (toolboxConnectorIds.has(targetConnectorId)) return;
    const previous = [...localToolboxConnectors];
    localToolboxConnectors = [...localToolboxConnectors, targetConnectorId];
    const currentUser = mockUsersById[mockCurrentUserId];
    if (currentUser && !currentUser.toolbox.includes(targetConnectorId)) {
      currentUser.toolbox = [...currentUser.toolbox, targetConnectorId];
    }
    void addParticleToCurrentUserToolbox(targetConnectorId).catch((err) => {
      console.error("[Connector page] Failed to persist toolbox update.", err);
      localToolboxConnectors = previous;
    });
  };

  const loadConnectorPageData = async () => {
    connectorLoading = true;
    try {
      await syncParticlePostDataFromChain();
    } finally {
      connector = getConnectorRecordById(connectorId);
      if (!connector && connectorId) {
        connector = await ensureConnectorRecordLoadedById(connectorId);
      }
      relatedConnectorEvents = listPostsReferencingConnector(connectorId);
      connectorLoading = false;
    }
  };

  onMount(() => {
    void getCurrentUserToolboxLibrary()
      .then((toolbox) => {
        localToolboxConnectors = [...toolbox.particles];
      })
      .catch((error) => {
        console.warn("[Connector page] Failed to load toolbox from profile.", error);
      });
    void loadConnectorPageData();
  });
</script>

<div class="connector-page">
  {#if connectorLoading}
    <SectionShell className="page-card-shell">
      <div class="status">
        <p class="status-title">Loading connector...</p>
        <p class="status-subtitle">Fetching chain-backed connector data.</p>
      </div>
    </SectionShell>
  {:else if !connector}
    <SectionShell className="page-card-shell">
      <div class="status">
        <p class="status-title">Connector not found</p>
        <p class="status-subtitle">No synced connector matches this ID yet.</p>
      </div>
    </SectionShell>
  {:else}
    <section class="connector-overview page-card-shell" aria-label="Connector overview">
      <div class="connector-head">
        <div class="connector-head-main">
          <p class="connector-kicker">Connector Page</p>
          <h1 class="connector-title">{connector.name}</h1>
          <p class="connector-meta">
            <span>{connector.createdLabel}</span>
            <span aria-hidden="true">•</span>
            {#if author}
              <a class="connector-author-link" href={resolve("/u/[id]", { id: author.id })}>
                {author.nickname}
              </a>
            {:else}
              <span>{connector.authorId}</span>
            {/if}
            {#if connector.formatHash}
              <span aria-hidden="true">•</span>
              <a
                class="connector-author-link"
                href={resolve("/f/[slug]", { slug: connector.formatHash })}
              >
                {connectorFormatName}
              </a>
            {/if}
          </p>
          <p class="connector-summary">{connector.summary}</p>
        </div>

        <div class="connector-head-actions">
          <Button
            variant={toolboxConnectorIds.has(connector.id) ? "ghost" : "primary"}
            type="button"
            disabled={toolboxConnectorIds.has(connector.id)}
            onclick={() => addConnectorToToolbox(connector.id)}
          >
            {toolboxConnectorIds.has(connector.id) ? "In toolbox" : "Add to toolbox"}
          </Button>
          <Button variant="ghost" type="button" onclick={() => openConnectorInStudio(connector.id)}>
            Open in Studio
          </Button>
        </div>
      </div>

      <div class="connector-flow-shell">
        <SocialParticleDependencyFlow
          particleId={connector.id}
          onParticleOpen={openConnectorInStudio}
          displayMode="page"
        />
      </div>
    </section>

    <div class="page-card-shell">
      <ParticlePostFeed
        events={relatedConnectorEvents}
        onParticleOpen={openConnectorInStudio}
        onAddToToolbox={addConnectorToToolbox}
        toolboxParticleIds={toolboxConnectorIds}
        emptyMessage={`No connectors reference ${connector.name} yet.`}
      />
    </div>
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .connector-page {
    @apply space-y-4 pt-3 md:pt-4;
    --social-feed-card-width: min(50vw, 56rem);
  }

  .page-card-shell {
    @apply mx-auto;
    width: var(--social-feed-card-width);
    max-width: 100%;
  }

  .connector-overview {
    @apply rounded-3xl border border-white/10 bg-black/35 backdrop-blur-sm p-4 md:p-5;
  }

  .connector-head {
    @apply flex flex-col gap-4 md:flex-row md:items-start md:justify-between;
  }

  .connector-head-main {
    @apply min-w-0;
  }

  .connector-kicker {
    @apply text-[0.62rem] uppercase tracking-[0.18em] text-white/45;
  }

  .connector-title {
    @apply mt-1 text-2xl md:text-[1.8rem] font-semibold text-white leading-tight;
  }

  .connector-meta {
    @apply mt-2 flex flex-wrap items-center gap-2 text-sm text-white/60;
  }

  .connector-author-link {
    @apply text-white/85 hover:text-white transition no-underline;
  }

  .connector-summary {
    @apply mt-3 text-sm leading-relaxed text-white/80;
  }

  .connector-head-actions {
    @apply flex flex-wrap gap-2 shrink-0;
  }

  .connector-flow-shell {
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
    .connector-page {
      --social-feed-card-width: min(68vw, 56rem);
    }
  }

  @media (max-width: 900px) {
    .connector-page {
      --social-feed-card-width: 100%;
    }
  }
</style>
