<script lang="ts">
  import { page } from "$app/stores";
  import { resolve } from "$app/paths";
  import { getChainFormat, normalizeFormatHash } from "$lib/chain/registryApi";
  import Button from "$lib/components/ui/Button.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import ParticlePostFeed from "$lib/components/feed/ParticlePostFeed.svelte";
  import {
    getFormatRecordByHash,
    listParticleRecordsByFormatHash,
    listNetworkFeedEvents,
    syncParticlePostDataFromChain,
    type NetworkFeedEvent,
    type ParticleRecord,
  } from "$lib/feed/particlePostData";
  import {
    getChainFormatDisplayName,
    mapChainFormatResponseToRecord,
    mergeChainFormatRecords,
    type ChainFormatRecord,
  } from "$lib/formats/chainFormats";
  import { mockCurrentUserId, mockUsersById } from "$lib/data/users";
  import { networkNodeStudioKind } from "$lib/network/mockNetworkGraph";

  const CHAIN_FORMAT_PAGE_LIMIT = 200;

  const getConnectorIdFromScalar = (scalarId: string): string => {
    const raw = `${scalarId ?? ""}`.trim();
    if (!raw) return "";
    const separatorIndex = raw.indexOf(":");
    if (separatorIndex === -1) return raw;
    const connectorId = raw.slice(0, separatorIndex).trim();
    return connectorId || raw;
  };

  let formatRecord = $state<ChainFormatRecord | null>(null);
  let formatAuthorId = $state<string>("");
  let loading = $state(true);
  let loadError = $state("");
  let formatDisplayName = $state("");
  let matchingConnectors = $state<ParticleRecord[]>([]);
  let relatedPosts = $state<NetworkFeedEvent[]>([]);
  let loadedSlug = $state("");
  let localToolboxConnectors = $state<string[]>([
    ...(mockUsersById[mockCurrentUserId]?.toolbox ?? []),
  ]);

  const toolboxConnectorIds = $derived.by(() => new Set(localToolboxConnectors));
  const author = $derived.by(() =>
    formatAuthorId ? (mockUsersById[formatAuthorId] ?? null) : null,
  );

  const loadChainFormatByHash = async (formatHash: string): Promise<ChainFormatRecord | null> => {
    const firstPage = await getChainFormat(formatHash, { limit: CHAIN_FORMAT_PAGE_LIMIT, page: 0 });
    const firstRecord = mapChainFormatResponseToRecord(firstPage);
    if (!firstRecord) return null;

    const totalConnectors = Math.max(firstRecord.totalConnectors, firstRecord.connectors.length);
    const pageLimit = Math.max(1, firstRecord.limit || CHAIN_FORMAT_PAGE_LIMIT);
    const totalPages = totalConnectors > 0 ? Math.ceil(totalConnectors / pageLimit) : 1;

    if (totalPages <= 1) return firstRecord;

    const remainingPages = Array.from({ length: totalPages - 1 }, (_, index) => index + 1);
    const otherPages = await Promise.all(
      remainingPages.map(async (pageIndex) => {
        try {
          const response = await getChainFormat(formatHash, { limit: pageLimit, page: pageIndex });
          return mapChainFormatResponseToRecord(response);
        } catch {
          return null;
        }
      }),
    );

    return (
      mergeChainFormatRecords([
        firstRecord,
        ...otherPages.filter((record): record is ChainFormatRecord => Boolean(record)),
      ]) ?? firstRecord
    );
  };

  const loadFormatPage = async () => {
    loading = true;
    loadError = "";
    try {
      await syncParticlePostDataFromChain();
      const slug = ($page.params.slug ?? "").trim();
      let formatHash = "";
      try {
        formatHash = normalizeFormatHash(slug);
      } catch {
        formatRecord = null;
        formatDisplayName = "";
        formatAuthorId = "";
        matchingConnectors = [];
        relatedPosts = [];
        loadError = "Format hash is invalid.";
        return;
      }

      const cached = getFormatRecordByHash(formatHash);
      const record =
        cached && cached.connectors.length >= cached.totalConnectors
          ? cached
          : await loadChainFormatByHash(formatHash);

      formatRecord = record;
      if (!record) {
        formatDisplayName = "";
        formatAuthorId = "";
        matchingConnectors = [];
        relatedPosts = [];
        return;
      }

      formatDisplayName = getChainFormatDisplayName(record.formatHash);

      matchingConnectors = listParticleRecordsByFormatHash(record.formatHash);
      const matchingIds = new Set(matchingConnectors.map((connector) => connector.id));
      const feed = listNetworkFeedEvents();
      relatedPosts = feed.filter(
        (event) => event.type === "connector" && matchingIds.has(event.particleId),
      );
      formatAuthorId =
        matchingConnectors.find((connector) => connector.authorId.trim().length > 0)?.authorId ??
        "";
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Unable to load format page.";
    } finally {
      loading = false;
    }
  };

  const openConnectorInStudio = (connectorId: string) => {
    const base = resolve("/studio");
    const target = new URL(base, window.location.origin);
    target.searchParams.set("network_kind", networkNodeStudioKind("connector"));
    target.searchParams.set("network_id", connectorId);
    window.open(target.toString(), "_blank", "noopener,noreferrer");
  };

  const addConnectorToToolbox = (connectorId: string) => {
    if (toolboxConnectorIds.has(connectorId)) return;
    localToolboxConnectors = [...localToolboxConnectors, connectorId];
    const currentUser = mockUsersById[mockCurrentUserId];
    if (currentUser && !currentUser.toolbox.includes(connectorId)) {
      currentUser.toolbox = [...currentUser.toolbox, connectorId];
    }
  };

  $effect(() => {
    const slug = ($page.params.slug ?? "").trim();
    if (!slug || slug === loadedSlug) return;
    loadedSlug = slug;
    void loadFormatPage();
  });
</script>

<div class="format-page">
  {#if loading}
    <SectionShell className="page-card-shell">
      <div class="status">
        <p class="status-title">Loading format...</p>
        <p class="status-subtitle">Fetching chain-backed format and connector data.</p>
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
  {:else if !formatRecord}
    <SectionShell className="page-card-shell">
      <div class="status">
        <p class="status-title">Format not found</p>
        <p class="status-subtitle">No chain format matches this hash.</p>
      </div>
    </SectionShell>
  {:else}
    <section class="format-overview page-card-shell" aria-label="Format overview">
      <p class="format-kicker">Format Page</p>
      <h1 class="format-title">{formatDisplayName}</h1>
      <p class="format-meta">
        <span>{author?.nickname ?? "Unknown contributor"}</span>
        <span aria-hidden="true">•</span>
        <span
          >{formatRecord.scalars.length} scalar{formatRecord.scalars.length === 1 ? "" : "s"}</span
        >
        <span aria-hidden="true">•</span>
        <span class="font-mono text-[0.66rem] tracking-[0.08em]">{formatRecord.formatHash}</span>
      </p>
      <div class="terminal-connectors" aria-label="Terminal connectors">
        <p class="terminal-label">Scalars</p>
        <div class="terminal-list">
          {#each formatRecord.scalars as scalarId (scalarId)}
            {@const connectorId = getConnectorIdFromScalar(scalarId)}
            <a class="terminal-pill" href={resolve("/c/[id]", { id: connectorId })}>{scalarId}</a>
          {/each}
        </div>
      </div>
    </section>

    <div class="page-card-shell">
      <ParticlePostFeed
        events={relatedPosts}
        onParticleOpen={openConnectorInStudio}
        onAddToToolbox={addConnectorToToolbox}
        toolboxParticleIds={toolboxConnectorIds}
        emptyMessage="No posts for connectors in this format yet."
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

  .terminal-connectors {
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
