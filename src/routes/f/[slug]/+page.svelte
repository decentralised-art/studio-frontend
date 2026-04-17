<script lang="ts">
  import { onMount } from "svelte";
  import { SvelteMap, SvelteSet } from "svelte/reactivity";
  import { page } from "$app/stores";
  import { resolve } from "$app/paths";
  import Button from "$lib/components/ui/Button.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import ConnectorPostFeed from "$lib/components/feed/ConnectorPostFeed.svelte";
  import {
    addConnectorToCurrentUserToolbox,
    getCurrentUserProfileState,
    followFormatInProfile,
    listServicesUsers,
    unfollowFormatInProfile,
  } from "$lib/auth/api";
  import {
    listParticlePosts as listConnectorPosts,
    listParticleRecordsByFormatHash as listConnectorRecordsByFormatHash,
    type NetworkFeedEvent,
  } from "$lib/feed/particlePostData";
  import { mapSnapshotParticlesToConnectorEvents } from "$lib/feed/networkEventMappers";
  import {
    getChainFormatDisplayName,
    mapChainFormatResponseToRecord,
    mergeChainFormatRecords,
    upsertChainFormatRecord,
    type ChainFormatRecord,
  } from "$lib/formats/chainFormats";
  import {
    getChainFormat,
    normalizeFormatHash,
    resolveChainFormatCursor,
  } from "$lib/chain/registryApi";
  import { buildAuthorLabelMapFromServicesUsers } from "$lib/social/authorLabels";
  import { fetchChainParticleForStudio } from "$lib/studio/chainStudioAdapter";

  const TARGETED_FORMAT_CONNECTOR_FETCH_LIMIT = 96;

  let format = $state<ChainFormatRecord | null>(null);
  let formatHash = $state("");
  let loading = $state(true);
  let loadError = $state("");
  let relatedPosts = $state<NetworkFeedEvent[]>([]);
  let formatCursorAfter = $state<string | null>(null);
  let formatHasMore = $state(false);
  let loadMorePending = $state(false);
  let loadMoreError = $state("");
  let followPending = $state(false);
  let formatFollowError = $state("");
  let localFollowedFormats = $state<string[]>([]);
  let localToolboxConnectors = $state<string[]>([]);
  let servicesUserLabels = $state<Record<string, string>>({});
  let formatLoadRequestVersion = 0;
  let profileLoadRequestVersion = 0;
  let labelsLoadRequestVersion = 0;

  const followedFormatKeys = $derived.by(() => new SvelteSet(localFollowedFormats));
  const toolboxConnectorIds = $derived.by(() => new SvelteSet(localToolboxConnectors));
  const feedAuthorLabels = $derived.by(() => servicesUserLabels);
  const isFollowingFormat = $derived.by(
    () => Boolean(formatHash) && followedFormatKeys.has(formatHash),
  );

  const getScalarConnectorName = (scalarLabel: string): string => {
    const [head] = scalarLabel.split(":");
    return (head ?? "").trim();
  };

  const recomputeRelatedPosts = (
    normalizedHash: string,
    formatRecord: ChainFormatRecord | null,
  ) => {
    if (!formatRecord) {
      relatedPosts = [];
      return;
    }
    const matchingConnectors = listConnectorRecordsByFormatHash(normalizedHash);
    const matchingIds = new SvelteSet(matchingConnectors.map((connector) => connector.id));
    formatRecord.connectors.forEach((connectorName) => {
      matchingIds.add(connectorName);
    });

    relatedPosts = listConnectorPosts().filter(
      (event) =>
        event.type === "connector" &&
        (event.formatHash === normalizedHash || matchingIds.has(event.particleId)),
    );
  };

  const mergeFormatPageRecord = (nextPageRecord: ChainFormatRecord | null) => {
    if (!nextPageRecord) return format;
    const merged = mergeChainFormatRecords([...(format ? [format] : []), nextPageRecord]);
    format = merged;
    if (merged) upsertChainFormatRecord(merged);
    return merged;
  };

  const sortNetworkEvents = (events: NetworkFeedEvent[]) =>
    [...events].sort((a, b) => {
      const byCreatedAt = b.createdAt - a.createdAt;
      if (byCreatedAt !== 0) return byCreatedAt;
      return b.id.localeCompare(a.id);
    });

  const hydrateFormatConnectorPosts = async (
    connectorIds: string[],
    requestVersion: number,
  ): Promise<void> => {
    const uniqueConnectorIds = Array.from(
      new Set(
        connectorIds
          .map((id) => id.trim())
          .filter(Boolean)
          .slice(0, TARGETED_FORMAT_CONNECTOR_FETCH_LIMIT),
      ),
    );
    if (uniqueConnectorIds.length === 0) return;

    const settled = await Promise.allSettled(
      uniqueConnectorIds.map((connectorId) => fetchChainParticleForStudio(connectorId)),
    );
    if (!isFormatLoadRequestActive(requestVersion)) return;

    const targetedEvents = settled.flatMap((result) => {
      if (result.status !== "fulfilled") return [];
      const particleMeta = result.value.particleMeta;
      if (!particleMeta) return [];
      return mapSnapshotParticlesToConnectorEvents(particleMeta.authorId, [particleMeta]);
    });
    if (targetedEvents.length === 0) return;

    const mergedById = new SvelteMap<string, NetworkFeedEvent>();
    [...relatedPosts, ...targetedEvents].forEach((event) => {
      mergedById.set(event.id, event);
    });
    relatedPosts = sortNetworkEvents(Array.from(mergedById.values()));
  };

  const beginFormatLoadRequest = (): number => {
    formatLoadRequestVersion += 1;
    return formatLoadRequestVersion;
  };

  const isFormatLoadRequestActive = (requestVersion: number): boolean =>
    requestVersion === formatLoadRequestVersion;

  const loadFormatPage = async (routeSlug: string) => {
    const requestVersion = beginFormatLoadRequest();
    loading = true;
    loadError = "";
    loadMoreError = "";
    loadMorePending = false;
    formatCursorAfter = null;
    formatHasMore = false;
    try {
      const slug = routeSlug.trim();
      if (!slug) {
        formatHash = "";
        format = null;
        relatedPosts = [];
        loadError = "Missing format hash in URL.";
        return;
      }

      let normalizedHash = "";
      try {
        normalizedHash = normalizeFormatHash(slug);
      } catch {
        formatHash = "";
        format = null;
        relatedPosts = [];
        loadError = "Invalid format hash in URL.";
        return;
      }
      formatHash = normalizedHash;

      const response = await getChainFormat(normalizedHash, { limit: 256 });
      if (!isFormatLoadRequestActive(requestVersion)) return;
      const pageRecord = mapChainFormatResponseToRecord(response);
      const merged = mergeFormatPageRecord(pageRecord);
      const cursor = resolveChainFormatCursor(response);
      formatCursorAfter = cursor.nextAfter;
      formatHasMore = cursor.hasMore && Boolean(cursor.nextAfter);
      if (!merged) {
        relatedPosts = [];
        return;
      }
      recomputeRelatedPosts(normalizedHash, merged);
      void hydrateFormatConnectorPosts(merged.connectors, requestVersion).catch((error) => {
        if (!isFormatLoadRequestActive(requestVersion)) return;
        console.warn("[Format page] Targeted connector hydration failed.", error);
      });
    } catch (error) {
      if (!isFormatLoadRequestActive(requestVersion)) return;
      loadError = error instanceof Error ? error.message : "Unable to load format page.";
    } finally {
      if (isFormatLoadRequestActive(requestVersion)) {
        loading = false;
      }
    }
  };

  const loadMoreFormatConnectors = async () => {
    if (loading || loadMorePending || !formatHash || !formatHasMore || !formatCursorAfter) return;
    loadMorePending = true;
    loadMoreError = "";
    const requestVersion = formatLoadRequestVersion;
    try {
      const response = await getChainFormat(formatHash, {
        limit: 256,
        after: formatCursorAfter,
      });
      if (!isFormatLoadRequestActive(requestVersion)) return;
      const pageRecord = mapChainFormatResponseToRecord(response);
      const merged = mergeFormatPageRecord(pageRecord);
      const cursor = resolveChainFormatCursor(response);
      formatCursorAfter = cursor.nextAfter;
      formatHasMore = cursor.hasMore && Boolean(cursor.nextAfter);
      recomputeRelatedPosts(formatHash, merged);
      if (pageRecord) {
        void hydrateFormatConnectorPosts(pageRecord.connectors, requestVersion).catch((error) => {
          if (!isFormatLoadRequestActive(requestVersion)) return;
          console.warn("[Format page] Targeted connector hydration failed.", error);
        });
      }
    } catch (error) {
      if (!isFormatLoadRequestActive(requestVersion)) return;
      loadMoreError =
        error instanceof Error ? error.message : "Unable to load more connectors for this format.";
    } finally {
      if (isFormatLoadRequestActive(requestVersion)) {
        loadMorePending = false;
      }
    }
  };

  const openConnectorInStudio = (connectorId: string) => {
    const base = resolve("/studio");
    const target = new URL(base, window.location.origin);
    target.searchParams.set("network_kind", "connector");
    target.searchParams.set("network_id", connectorId);
    window.open(target.toString(), "_blank", "noopener,noreferrer");
  };

  const addConnectorToToolbox = (connectorId: string) => {
    if (toolboxConnectorIds.has(connectorId)) return;
    localToolboxConnectors = [...localToolboxConnectors, connectorId];
    void addConnectorToCurrentUserToolbox(connectorId).catch((error) => {
      console.error("[Format page] Failed to persist toolbox update.", error);
    });
  };

  const toggleFormatFollow = async () => {
    if (!formatHash || followPending) return;
    followPending = true;
    formatFollowError = "";
    const key = formatHash;
    try {
      if (isFollowingFormat) {
        await unfollowFormatInProfile(key);
        localFollowedFormats = localFollowedFormats.filter((entry) => entry !== key);
      } else {
        await followFormatInProfile(key);
        localFollowedFormats = Array.from(new Set([...localFollowedFormats, key]));
      }
    } catch (error) {
      formatFollowError =
        error instanceof Error ? error.message : "Failed to update format follow.";
    } finally {
      followPending = false;
    }
  };

  const hydrateViewerProfileState = async () => {
    const requestVersion = ++profileLoadRequestVersion;
    try {
      const profileState = await getCurrentUserProfileState({ preferCached: true });
      if (requestVersion !== profileLoadRequestVersion) return;
      localToolboxConnectors = [...profileState.toolbox.connector];
      localFollowedFormats = [...profileState.social.followedFormatHashes];
    } catch (error) {
      if (requestVersion !== profileLoadRequestVersion) return;
      console.warn("[Format page] Failed to load viewer profile state.", error);
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
      console.warn("[Format page] Failed to load services user labels.", error);
    }
  };

  $effect(() => {
    const routeSlug = ($page.params.slug ?? "").trim();
    void loadFormatPage(routeSlug);
  });

  onMount(() => {
    void hydrateViewerProfileState();
    void hydrateServicesAuthorLabels();
    return () => {
      formatLoadRequestVersion += 1;
      profileLoadRequestVersion += 1;
      labelsLoadRequestVersion += 1;
    };
  });
</script>

<div class="format-page">
  {#if loading}
    <SectionShell className="page-card-shell">
      <div class="status">
        <p class="status-title">Loading format...</p>
        <p class="status-subtitle">Fetching chain-backed format data.</p>
      </div>
    </SectionShell>
  {:else if loadError}
    <SectionShell className="page-card-shell">
      <div class="status">
        <p class="status-title">Unable to load format</p>
        <p class="status-subtitle">{loadError}</p>
      </div>
      <div class="status-actions">
        <Button
          variant="primary"
          type="button"
          onclick={() => void loadFormatPage(($page.params.slug ?? "").trim())}
        >
          Retry
        </Button>
      </div>
    </SectionShell>
  {:else if !format}
    <SectionShell className="page-card-shell">
      <div class="status">
        <p class="status-title">Format not found</p>
        <p class="status-subtitle">No on-chain format matches this hash.</p>
      </div>
    </SectionShell>
  {:else}
    <section class="format-overview page-card-shell" aria-label="Format overview">
      <p class="format-kicker">Format Page</p>
      <h1 class="format-title">{getChainFormatDisplayName(format.formatHash)}</h1>
      <p class="format-meta">
        <span>{format.formatHash}</span>
        <span aria-hidden="true">•</span>
        <span>{format.scalars.length} {format.scalars.length === 1 ? "scalar" : "scalars"}</span>
      </p>
      <div class="format-actions">
        <Button
          variant={isFollowingFormat ? "ghost" : "primary"}
          type="button"
          disabled={followPending}
          onclick={toggleFormatFollow}
        >
          {isFollowingFormat ? "Following format" : "Follow format"}
        </Button>
      </div>
      {#if formatFollowError}
        <p class="format-follow-error">{formatFollowError}</p>
      {/if}

      <div class="terminal-particles" aria-label="Format scalars">
        <p class="terminal-label">Scalars</p>
        <div class="terminal-list">
          {#each format.scalars as scalar (scalar)}
            {@const scalarConnector = getScalarConnectorName(scalar)}
            {#if scalarConnector}
              <a class="terminal-pill" href={resolve("/c/[id]", { id: scalarConnector })}
                >{scalar}</a
              >
            {:else}
              <span class="terminal-pill">{scalar}</span>
            {/if}
          {/each}
        </div>
      </div>
    </section>

    <div class="page-card-shell">
      <ConnectorPostFeed
        events={relatedPosts}
        onConnectorOpen={openConnectorInStudio}
        onAddToToolbox={addConnectorToToolbox}
        {toolboxConnectorIds}
        authorLabelById={feedAuthorLabels}
        emptyMessage="No connector posts for this format yet."
      />
    </div>

    {#if formatHasMore || loadMoreError}
      <div class="page-card-shell load-more-panel">
        {#if loadMoreError}
          <p class="load-more-error">{loadMoreError}</p>
        {/if}
        {#if formatHasMore}
          <Button
            variant="ghost"
            type="button"
            disabled={loadMorePending}
            onclick={loadMoreFormatConnectors}
          >
            {loadMorePending ? "Loading more..." : "Load more"}
          </Button>
        {/if}
      </div>
    {/if}
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

  .format-overview {
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

  .format-actions {
    @apply mt-3 flex gap-2;
  }

  .format-follow-error {
    @apply mt-2 text-xs text-rose-300;
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

  .load-more-panel {
    @apply flex flex-col gap-2 items-start;
  }

  .load-more-error {
    @apply text-xs text-rose-300;
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
  }
</style>
