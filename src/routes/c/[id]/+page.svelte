<script lang="ts">
  import { onMount } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import { page } from "$app/stores";
  import { resolve } from "$app/paths";

  import ConnectorPostFeed from "$lib/components/feed/ConnectorPostFeed.svelte";
  import {
    ensureParticleRecordLoadedById as ensureConnectorRecordLoadedById,
    getParticleRecordById as getConnectorRecordById,
    listParticlePostsReferencingParticle as listPostsReferencingConnector,
    type ParticlePostEvent as ConnectorPostEvent,
    type ParticleRecord as ConnectorRecord,
  } from "$lib/feed/particlePostData";
  import { mapSnapshotParticlesToConnectorEvents } from "$lib/feed/networkEventMappers";
  import { fetchChainOwnedStudioSnapshot } from "$lib/studio/chainStudioAdapter";
  import SocialConnectorDependencyFlow from "$lib/components/social/SocialConnectorDependencyFlow.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import {
    addConnectorToCurrentUserToolbox,
    getCurrentUserProfileState,
    listServicesUsers,
  } from "$lib/auth/api";
  import {
    buildAuthorLabelMapFromServicesUsers,
    normalizeAuthorAddress,
    shortAuthorAddress,
  } from "$lib/social/authorLabels";
  import { getChainFormatDisplayName } from "$lib/formats/chainFormats";

  let localToolboxConnectors = $state<string[]>([]);
  let servicesUserLabels = $state<Record<string, string>>({});
  let connector = $state<ConnectorRecord | null>(null);
  let relatedConnectorEvents = $state<ConnectorPostEvent[]>([]);
  let connectorLoading = $state(true);
  let connectorLoadRequestVersion = 0;
  let profileLoadRequestVersion = 0;
  let labelsLoadRequestVersion = 0;

  const toolboxConnectorIds = $derived.by(() => new Set(localToolboxConnectors));
  const connectorId = $derived.by(() => $page.params.id?.trim() ?? "");
  const connectorAuthorLabel = $derived.by(() => {
    if (!connector) return "";
    const exact = servicesUserLabels[connector.authorId]?.trim();
    if (exact && exact.length > 0) return exact;
    const normalized = normalizeAuthorAddress(connector.authorId);
    const byNormalized = normalized ? servicesUserLabels[normalized]?.trim() : "";
    if (byNormalized && byNormalized.length > 0) return byNormalized;
    return shortAuthorAddress(connector.authorId) || connector.authorId;
  });
  const feedAuthorLabels = $derived.by(() => servicesUserLabels);
  const connectorFormatName = $derived.by(() =>
    connector?.formatHash ? getChainFormatDisplayName(connector.formatHash) : "",
  );

  const beginConnectorLoadRequest = (): number => {
    connectorLoadRequestVersion += 1;
    return connectorLoadRequestVersion;
  };

  const isConnectorLoadRequestActive = (requestVersion: number): boolean =>
    requestVersion === connectorLoadRequestVersion;

  const openConnectorInStudio = (targetConnectorId: string) => {
    const base = resolve("/studio");
    const target = new URL(base, window.location.origin);
    target.searchParams.set("network_kind", "connector");
    target.searchParams.set("network_id", targetConnectorId);
    window.open(target.toString(), "_blank", "noopener,noreferrer");
  };

  const addConnectorToToolbox = (targetConnectorId: string) => {
    if (toolboxConnectorIds.has(targetConnectorId)) return;
    const previous = [...localToolboxConnectors];
    localToolboxConnectors = [...localToolboxConnectors, targetConnectorId];
    void addConnectorToCurrentUserToolbox(targetConnectorId).catch((err) => {
      console.error("[Connector page] Failed to persist toolbox update.", err);
      localToolboxConnectors = previous;
    });
  };

  const sortConnectorEvents = (events: ConnectorPostEvent[]) =>
    [...events].sort((a, b) => {
      const byCreatedAt = b.createdAt - a.createdAt;
      if (byCreatedAt !== 0) return byCreatedAt;
      return b.id.localeCompare(a.id);
    });

  const loadConnectorPageData = async (targetConnectorId: string) => {
    const requestVersion = beginConnectorLoadRequest();
    connectorLoading = true;
    const normalizedId = targetConnectorId.trim();
    if (!normalizedId) {
      connector = null;
      relatedConnectorEvents = [];
      connectorLoading = false;
      return;
    }

    const resolvedConnector =
      getConnectorRecordById(normalizedId) ?? (await ensureConnectorRecordLoadedById(normalizedId));
    if (!isConnectorLoadRequestActive(requestVersion)) return;

    connector = resolvedConnector;
    relatedConnectorEvents = sortConnectorEvents(listPostsReferencingConnector(normalizedId));

    const ownerAddress = normalizeAuthorAddress(resolvedConnector?.authorId ?? "");
    if (ownerAddress) {
      try {
        const snapshot = await fetchChainOwnedStudioSnapshot(ownerAddress, {
          authorId: ownerAddress,
          limit: 200,
          includeRuntimeCode: false,
        });
        if (!isConnectorLoadRequestActive(requestVersion)) return;
        const targeted = mapSnapshotParticlesToConnectorEvents(
          ownerAddress,
          snapshot.particles,
        ).filter((event) => event.usedParticleIds.includes(normalizedId));
        if (targeted.length > 0) {
          const mergedById = new SvelteMap<string, ConnectorPostEvent>();
          [...relatedConnectorEvents, ...targeted].forEach((event) => {
            mergedById.set(event.id, event);
          });
          relatedConnectorEvents = sortConnectorEvents(Array.from(mergedById.values()));
        }
      } catch (error) {
        if (!isConnectorLoadRequestActive(requestVersion)) return;
        console.warn("[Connector page] Targeted account fetch failed.", error);
      }
    }

    connectorLoading = false;
  };

  const hydrateViewerProfileState = async () => {
    const requestVersion = ++profileLoadRequestVersion;
    try {
      const profileState = await getCurrentUserProfileState({ preferCached: true });
      if (requestVersion !== profileLoadRequestVersion) return;
      localToolboxConnectors = [...profileState.toolbox.connector];
    } catch (error) {
      if (requestVersion !== profileLoadRequestVersion) return;
      console.warn("[Connector page] Failed to load toolbox from profile.", error);
    }
  };

  const hydrateServicesAuthorLabels = async () => {
    const requestVersion = ++labelsLoadRequestVersion;
    try {
      const labels = buildAuthorLabelMapFromServicesUsers(await listServicesUsers());
      if (requestVersion !== labelsLoadRequestVersion) return;
      servicesUserLabels = labels;
    } catch (error) {
      if (requestVersion !== labelsLoadRequestVersion) return;
      console.warn("[Connector page] Failed to load services user labels.", error);
    }
  };

  $effect(() => {
    const routeConnectorId = connectorId;
    void loadConnectorPageData(routeConnectorId);
  });

  onMount(() => {
    void hydrateViewerProfileState();
    void hydrateServicesAuthorLabels();
    return () => {
      connectorLoadRequestVersion += 1;
      profileLoadRequestVersion += 1;
      labelsLoadRequestVersion += 1;
    };
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
            <a class="connector-author-link" href={resolve("/u/[id]", { id: connector.authorId })}>
              {connectorAuthorLabel}
            </a>
            {#if connector.formatHash}
              <span aria-hidden="true">•</span>
              <a
                class="connector-format-link"
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
            variant={toolboxConnectorIds.has(connector!.id) ? "ghost" : "primary"}
            type="button"
            disabled={toolboxConnectorIds.has(connector!.id)}
            onclick={() => addConnectorToToolbox(connector!.id)}
          >
            {toolboxConnectorIds.has(connector!.id) ? "In toolbox" : "Add to toolbox"}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onclick={() => openConnectorInStudio(connector!.id)}
          >
            Open in Studio
          </Button>
        </div>
      </div>

      <div class="connector-flow-shell">
        <SocialConnectorDependencyFlow
          connectorId={connector.id}
          onConnectorOpen={openConnectorInStudio}
          displayMode="page"
        />
      </div>
    </section>

    <div class="page-card-shell connector-feed-shell">
      <ConnectorPostFeed
        events={relatedConnectorEvents}
        onConnectorOpen={openConnectorInStudio}
        onAddToToolbox={addConnectorToToolbox}
        {toolboxConnectorIds}
        authorLabelById={feedAuthorLabels}
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
    @apply rounded-3xl border p-4 backdrop-blur-sm md:p-5;
    background: var(--surface-card);
    border-color: var(--border-subtle);
    color: var(--text-primary);
  }

  .connector-head {
    @apply flex flex-col gap-4 md:flex-row md:items-start md:justify-between;
  }

  .connector-head-main {
    @apply min-w-0 flex-1;
  }

  .connector-kicker {
    @apply text-[0.62rem] uppercase tracking-[0.18em];
    color: var(--text-faint);
  }

  .connector-title {
    @apply mt-1 text-2xl font-semibold leading-tight md:text-[1.8rem];
    color: var(--text-primary);
    overflow-wrap: anywhere;
  }

  .connector-meta {
    @apply mt-2 flex flex-wrap items-center gap-2 text-sm;
    color: var(--text-muted);
  }

  .connector-author-link,
  .connector-format-link {
    @apply no-underline transition;
    color: var(--color-accent-strong);
  }

  .connector-author-link:hover,
  .connector-format-link:hover {
    color: var(--color-accent);
  }

  .connector-summary {
    @apply mt-3 text-sm leading-relaxed;
    color: var(--text-secondary);
  }

  .connector-head-actions {
    @apply flex max-w-full shrink-0 flex-wrap gap-2 md:justify-end;
  }

  .connector-flow-shell {
    @apply mt-4;
  }

  .connector-feed-shell {
    background: transparent !important;
    border-color: transparent !important;
    box-shadow: none !important;
  }

  .status {
    @apply space-y-2;
  }

  .status-title {
    @apply text-lg font-semibold;
    color: var(--text-primary);
  }

  .status-subtitle {
    @apply text-sm;
    color: var(--text-muted);
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
