<script lang="ts">
  import { onMount } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import { resolve } from "$app/paths";
  import ParticlePostFeed from "$lib/components/feed/ParticlePostFeed.svelte";
  import {
    addConnectorToCurrentUserToolbox,
    followUserInProfile,
    getCurrentUserSocialPreferences,
    getCurrentUserToolboxLibrary,
  } from "$lib/auth/api";
  import {
    findParticlesByTerminalSet,
    getParticleLabelMap,
    listParticlePosts,
    listParticleSearchEntities,
    syncParticlePostDataFromChain,
    type NetworkFeedEvent,
    type ParticlePostEvent,
  } from "$lib/feed/particlePostData";
  import {
    buildFormatFeedEvents,
    loadLocalFormats,
    type ParticleFormat,
  } from "$lib/formats/localFormats";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import { networkNodeStudioKind } from "$lib/network/mockNetworkGraph";
  import {
    displayUsersById,
    mockCurrentUserId,
    mockUsers,
    mockUsersById,
    type User,
  } from "$lib/data/users";

  const FEED_PAGE_SIZE = 10;
  const MIN_INITIAL_FEED_EVENTS = 3;
  const CHAIN_SOURCE_LIMIT_STEP = 4;
  const CHAIN_SOURCE_LIMIT_MAX = 64;
  const CHAIN_OWNED_PER_SOURCE_LIMIT = 4;
  const EMPTY_FEED_VERIFICATION_MAX_OWNED_PER_SOURCE = 32;
  const EMPTY_FEED_RETRY_ATTEMPTS = 2;
  const EMPTY_FEED_RETRY_DELAY_MS = 700;
  const EMPTY_FEED_BACKGROUND_REFRESH_MAX = 2;
  const EMPTY_FEED_BACKGROUND_DELAY_MS = 1200;

  let followSearch = $state("");
  let feedEvents = $state<ParticlePostEvent[]>([]);
  let feedLoading = $state(true);
  let feedSyncSettled = $state(false);
  let feedLoadMoreBusy = $state(false);
  let feedLoadError = $state("");
  let formats = $state<ParticleFormat[]>([]);
  let chainElements = $state(listParticleSearchEntities());
  let visibleEventCount = $state(FEED_PAGE_SIZE);
  let sourceSyncLimit = $state(CHAIN_SOURCE_LIMIT_STEP);
  let canFetchMoreFromChain = $state(true);
  let runtimeSearchHydrationBusy = $state(false);
  let runtimeSearchHydrated = $state(false);
  let emptyFeedBackgroundRefreshes = $state(0);
  let emptyFeedBackgroundBusy = $state(false);
  let localFollowing = $state<string[]>([]);
  let localFollowedFormats = $state<string[]>([]);
  let localToolboxParticles = $state<string[]>([
    ...(mockUsersById[mockCurrentUserId]?.toolbox ?? []),
  ]);
  let pageMounted = false;
  let feedSyncRequestVersion = 0;
  let runtimeHydrationRequestVersion = 0;

  const beginFeedSyncRequest = (): number => {
    feedSyncRequestVersion += 1;
    return feedSyncRequestVersion;
  };

  const isFeedSyncRequestActive = (requestVersion: number): boolean =>
    pageMounted && requestVersion === feedSyncRequestVersion;

  const beginRuntimeHydrationRequest = (): number => {
    runtimeHydrationRequestVersion += 1;
    return runtimeHydrationRequestVersion;
  };

  const isRuntimeHydrationRequestActive = (requestVersion: number): boolean =>
    pageMounted && requestVersion === runtimeHydrationRequestVersion;

  const followedAuthorIds = $derived.by(() => new SvelteSet(localFollowing));
  const followedFormatKeys = $derived.by(() => new SvelteSet(localFollowedFormats));
  const toolboxParticleIds = $derived.by(() => new SvelteSet(localToolboxParticles));
  const feedUiLoading = $derived.by(() => feedLoading || !feedSyncSettled);
  const searchQuery = $derived.by(() => followSearch.trim().toLowerCase());
  const formatFeedEvents = $derived.by(() => buildFormatFeedEvents(formats, getParticleLabelMap()));
  const followedFormatParticleIds = $derived.by(() => {
    const selectedFormats = formatFeedEvents.filter(
      (event) =>
        followedFormatKeys.has(event.formatId) ||
        followedFormatKeys.has(event.formatSlug) ||
        followedFormatKeys.has(event.formatName),
    );
    const ids = new SvelteSet<string>();
    selectedFormats.forEach((event) => {
      event.terminalParticleIds.forEach((id) => ids.add(id));
      findParticlesByTerminalSet(event.terminalParticleIds).forEach((particle) => {
        ids.add(particle.id);
      });
    });
    return ids;
  });
  const networkFeedEvents = $derived.by(() => {
    const combined = [...feedEvents, ...formatFeedEvents] as NetworkFeedEvent[];
    const filtered = combined.filter((event) => {
      if (event.type === "format") {
        return (
          followedAuthorIds.has(event.authorId) ||
          followedFormatKeys.has(event.formatId) ||
          followedFormatKeys.has(event.formatSlug) ||
          followedFormatKeys.has(event.formatName)
        );
      }
      if (event.type === "connector") {
        return (
          followedAuthorIds.has(event.authorId) || followedFormatParticleIds.has(event.particleId)
        );
      }
      return followedAuthorIds.has(event.authorId);
    });

    const sorted = [...filtered].sort((a, b) => {
      const byCreatedAt = b.createdAt - a.createdAt;
      if (byCreatedAt !== 0) return byCreatedAt;
      return b.id.localeCompare(a.id);
    });

    // Fallback for prototype mode: if follow mapping is temporarily out of sync
    // (e.g. services UUIDs vs local aliases), avoid false "No events" empties.
    if (sorted.length === 0 && combined.length > 0) {
      return [...combined].sort((a, b) => {
        const byCreatedAt = b.createdAt - a.createdAt;
        if (byCreatedAt !== 0) return byCreatedAt;
        return b.id.localeCompare(a.id);
      });
    }
    return sorted;
  });
  const visibleNetworkFeedEvents = $derived.by(() =>
    networkFeedEvents.slice(0, Math.max(0, visibleEventCount)),
  );
  const hasMoreVisibleEvents = $derived.by(() => networkFeedEvents.length > visibleEventCount);
  const canLoadMoreEvents = $derived.by(() => hasMoreVisibleEvents || canFetchMoreFromChain);
  const feedEmptyMessage = $derived.by(() => {
    if (feedLoadError) return feedLoadError;
    if (feedEvents.length > 0 && visibleNetworkFeedEvents.length === 0) {
      return "No events from followed users or followed formats yet.";
    }
    return "No events to display yet.";
  });

  const refreshFeedStateFromCache = () => {
    feedEvents = listParticlePosts();
    chainElements = listParticleSearchEntities();
    if (feedEvents.length > 0) {
      feedLoadError = "";
    }
  };

  const userSearchResults = $derived.by(() => {
    if (!searchQuery) return [] as User[];
    return mockUsers
      .filter((user) => user.id !== mockCurrentUserId)
      .filter((user) => {
        return `${user.nickname} ${user.address} ${user.bio ?? ""}`
          .toLowerCase()
          .includes(searchQuery);
      })
      .slice(0, 6);
  });

  type SearchableEntityKind = "connector" | "transformation" | "condition";

  type EntitySearchResult = {
    id: string;
    label: string;
    kind: SearchableEntityKind;
    entityId: string;
    summary: string;
    creatorName: string;
  };

  const entitySearchResults = $derived.by(() => {
    if (!searchQuery) return [] as EntitySearchResult[];
    return (
      [
        ...chainElements.connectors.map((item) => ({ ...item, kind: "connector" as const })),
        ...chainElements.transformations.map((item) => ({
          ...item,
          kind: "transformation" as const,
        })),
        ...chainElements.conditions.map((item) => ({ ...item, kind: "condition" as const })),
      ] as Array<
        { kind: SearchableEntityKind } & {
          id: string;
          label: string;
          summary: string;
          authorId: string;
        }
      >
    )
      .filter((item) =>
        `${item.label} ${item.id} ${item.summary}`.toLowerCase().includes(searchQuery),
      )
      .map((item) => ({
        id: `${item.kind}:${item.id}`,
        label: item.label,
        kind: item.kind,
        entityId: item.id,
        summary: item.summary,
        creatorName: displayUsersById[item.authorId]?.nickname ?? "unknown contributor",
      }))
      .slice(0, 10);
  });

  const showSearchResults = $derived.by(() => searchQuery.length > 0);

  const loadChainFeed = async () => {
    const requestVersion = beginFeedSyncRequest();
    feedLoadError = "";
    feedLoading = true;
    feedSyncSettled = false;
    emptyFeedBackgroundRefreshes = 0;
    emptyFeedBackgroundBusy = false;

    try {
      await syncParticlePostDataFromChain({
        force: true,
        forceSources: true,
        maxSources: sourceSyncLimit,
        maxOwnedPerSource: CHAIN_OWNED_PER_SOURCE_LIMIT,
        includeRuntimeCode: false,
      });
    } catch (error) {
      console.error("[Network feed] Failed to sync chain-backed particle posts.", error);
      feedLoadError = error instanceof Error ? error.message : "Unable to load network feed.";
    }
    if (!isFeedSyncRequestActive(requestVersion)) return;
    refreshFeedStateFromCache();

    // Fast path can miss active sources if early source windows are sparse.
    // Auto-expand sources until we have a minimally useful feed window.
    if (feedEvents.length < MIN_INITIAL_FEED_EVENTS && sourceSyncLimit < CHAIN_SOURCE_LIMIT_MAX) {
      let nextLimit = sourceSyncLimit;
      while (feedEvents.length < MIN_INITIAL_FEED_EVENTS && nextLimit < CHAIN_SOURCE_LIMIT_MAX) {
        nextLimit = Math.min(CHAIN_SOURCE_LIMIT_MAX, nextLimit + CHAIN_SOURCE_LIMIT_STEP);
        sourceSyncLimit = nextLimit;
        try {
          await syncParticlePostDataFromChain({
            force: true,
            forceSources: true,
            maxSources: sourceSyncLimit,
            maxOwnedPerSource: CHAIN_OWNED_PER_SOURCE_LIMIT,
            includeRuntimeCode: false,
          });
        } catch (error) {
          console.warn("[Network feed] Auto-expand source sync failed.", error);
          feedLoadError = error instanceof Error ? error.message : "Unable to load network feed.";
          break;
        }
        if (!isFeedSyncRequestActive(requestVersion)) return;
        refreshFeedStateFromCache();
      }
    }

    // Final fallback: if capped scan found nothing, attempt one uncapped sync to avoid false-empty UI
    // when active sources are beyond the capped window.
    if (feedEvents.length < MIN_INITIAL_FEED_EVENTS && sourceSyncLimit >= CHAIN_SOURCE_LIMIT_MAX) {
      try {
        await syncParticlePostDataFromChain({
          force: true,
          forceSources: true,
          maxOwnedPerSource: CHAIN_OWNED_PER_SOURCE_LIMIT,
          includeRuntimeCode: false,
        });
      } catch (error) {
        console.warn("[Network feed] Uncapped source sync failed.", error);
        feedLoadError = error instanceof Error ? error.message : "Unable to load network feed.";
      }
      if (!isFeedSyncRequestActive(requestVersion)) return;
      refreshFeedStateFromCache();
    }

    // Guard against transient false-empty states: verify once with a broader pull
    // before letting the UI settle into the "No events" state.
    if (feedEvents.length === 0 && !feedLoadError) {
      try {
        await syncParticlePostDataFromChain({
          force: true,
          forceSources: true,
          maxOwnedPerSource: EMPTY_FEED_VERIFICATION_MAX_OWNED_PER_SOURCE,
          includeRuntimeCode: false,
        });
      } catch (error) {
        console.warn("[Network feed] Empty-feed verification sync failed.", error);
        feedLoadError = error instanceof Error ? error.message : "Unable to load network feed.";
      }
      if (!isFeedSyncRequestActive(requestVersion)) return;
      refreshFeedStateFromCache();
    }

    // Additional resilience for intermittent backend/source readiness.
    // Keep the skeleton visible and retry briefly before rendering an empty state.
    if (feedEvents.length === 0 && !feedLoadError) {
      for (let attempt = 0; attempt < EMPTY_FEED_RETRY_ATTEMPTS; attempt += 1) {
        await new Promise((resolveAttempt) =>
          setTimeout(resolveAttempt, EMPTY_FEED_RETRY_DELAY_MS * (attempt + 1)),
        );

        try {
          await syncParticlePostDataFromChain({
            force: true,
            forceSources: true,
            maxOwnedPerSource: EMPTY_FEED_VERIFICATION_MAX_OWNED_PER_SOURCE,
            includeRuntimeCode: false,
          });
        } catch (error) {
          console.warn("[Network feed] Empty-feed retry sync failed.", error);
        }
        if (!isFeedSyncRequestActive(requestVersion)) return;

        refreshFeedStateFromCache();
        if (feedEvents.length > 0) break;
      }
    }

    if (!isFeedSyncRequestActive(requestVersion)) return;
    canFetchMoreFromChain = sourceSyncLimit < CHAIN_SOURCE_LIMIT_MAX;

    feedLoading = false;
    feedSyncSettled = true;
  };

  $effect(() => {
    if (feedLoading || !feedSyncSettled) return;
    if (feedLoadError || feedEvents.length > 0) return;
    if (emptyFeedBackgroundBusy) return;
    if (emptyFeedBackgroundRefreshes >= EMPTY_FEED_BACKGROUND_REFRESH_MAX) return;

    const nextAttempt = emptyFeedBackgroundRefreshes + 1;
    const requestVersion = beginFeedSyncRequest();
    emptyFeedBackgroundBusy = true;
    feedLoading = true;
    feedSyncSettled = false;

    void (async () => {
      await new Promise((resolveAttempt) =>
        setTimeout(resolveAttempt, EMPTY_FEED_BACKGROUND_DELAY_MS * nextAttempt),
      );
      if (!isFeedSyncRequestActive(requestVersion)) return;
      try {
        await syncParticlePostDataFromChain({
          force: true,
          forceSources: true,
          maxOwnedPerSource: EMPTY_FEED_VERIFICATION_MAX_OWNED_PER_SOURCE,
          includeRuntimeCode: false,
        });
      } catch (error) {
        console.warn("[Network feed] Background empty-feed refresh failed.", error);
      }
      if (!isFeedSyncRequestActive(requestVersion)) return;
      refreshFeedStateFromCache();
      emptyFeedBackgroundRefreshes = nextAttempt;
      canFetchMoreFromChain = sourceSyncLimit < CHAIN_SOURCE_LIMIT_MAX;
    })().finally(() => {
      if (!isFeedSyncRequestActive(requestVersion)) return;
      emptyFeedBackgroundBusy = false;
      feedLoading = false;
      feedSyncSettled = true;
    });
  });

  const loadMoreFeedEvents = async () => {
    if (feedLoadMoreBusy) return;

    if (hasMoreVisibleEvents) {
      visibleEventCount += FEED_PAGE_SIZE;
      return;
    }

    if (!canFetchMoreFromChain) return;

    const beforeCount = listParticlePosts().length;
    const nextLimit = Math.min(CHAIN_SOURCE_LIMIT_MAX, sourceSyncLimit + CHAIN_SOURCE_LIMIT_STEP);
    if (nextLimit <= sourceSyncLimit) {
      canFetchMoreFromChain = false;
      return;
    }

    feedLoadMoreBusy = true;
    sourceSyncLimit = nextLimit;
    try {
      await syncParticlePostDataFromChain({
        force: true,
        forceSources: true,
        maxSources: sourceSyncLimit,
        maxOwnedPerSource: CHAIN_OWNED_PER_SOURCE_LIMIT,
        includeRuntimeCode: false,
      });
      if (!pageMounted) return;
      const afterCount = listParticlePosts().length;
      feedEvents = listParticlePosts();
      chainElements = listParticleSearchEntities();
      visibleEventCount += FEED_PAGE_SIZE;
      canFetchMoreFromChain = sourceSyncLimit < CHAIN_SOURCE_LIMIT_MAX || afterCount > beforeCount;
      if (feedEvents.length > 0) {
        feedLoadError = "";
      }
    } catch (error) {
      if (!pageMounted) return;
      console.error("[Network feed] Failed to load more events.", error);
      feedLoadError = error instanceof Error ? error.message : "Unable to load more events.";
    } finally {
      if (pageMounted) {
        feedLoadMoreBusy = false;
      }
    }
  };

  $effect(() => {
    if (runtimeSearchHydrated || runtimeSearchHydrationBusy) return;
    if (searchQuery.length === 0) return;
    if (chainElements.transformations.length > 0 || chainElements.conditions.length > 0) {
      runtimeSearchHydrated = true;
      return;
    }

    const requestVersion = beginRuntimeHydrationRequest();
    runtimeSearchHydrationBusy = true;
    void syncParticlePostDataFromChain({
      force: true,
      forceSources: true,
      maxSources: sourceSyncLimit,
      maxOwnedPerSource: CHAIN_OWNED_PER_SOURCE_LIMIT,
      includeRuntimeCode: true,
    })
      .then(() => {
        if (!isRuntimeHydrationRequestActive(requestVersion)) return;
        feedEvents = listParticlePosts();
        chainElements = listParticleSearchEntities();
        runtimeSearchHydrated = true;
      })
      .catch((error) => {
        if (!isRuntimeHydrationRequestActive(requestVersion)) return;
        console.warn("[Network feed] Runtime code hydration failed.", error);
      })
      .finally(() => {
        if (!isRuntimeHydrationRequestActive(requestVersion)) return;
        runtimeSearchHydrationBusy = false;
      });
  });

  const openConnectorInStudio = (connectorId: string) => {
    if (!connectorId) return;
    const base = resolve("/studio");
    const target = new URL(base, window.location.origin);
    target.searchParams.set("network_kind", networkNodeStudioKind("feature"));
    target.searchParams.set("network_id", connectorId);
    window.open(target.toString(), "_blank", "noopener,noreferrer");
  };

  const openLibraryEntityInStudio = (kind: SearchableEntityKind, id: string) => {
    if (!id) return;
    if (kind === "connector") {
      openConnectorInStudio(id);
      return;
    }
    const base = resolve("/studio");
    const target = new URL(base, window.location.origin);
    target.searchParams.set("network_kind", kind);
    target.searchParams.set("network_id", id);
    window.open(target.toString(), "_blank", "noopener,noreferrer");
  };

  const followUser = async (userId: User["id"]) => {
    if (localFollowing.includes(userId)) return;
    const previous = [...localFollowing];
    localFollowing = [...localFollowing, userId];
    try {
      await followUserInProfile(userId);
    } catch (error) {
      console.error("[Network feed] Failed to persist following state.", error);
      localFollowing = previous;
    }
  };

  const addParticleToToolbox = (particleId: string) => {
    if (toolboxParticleIds.has(particleId)) return;
    const previous = [...localToolboxParticles];
    localToolboxParticles = [...localToolboxParticles, particleId];
    const currentUser = mockUsersById[mockCurrentUserId];
    if (currentUser && !currentUser.toolbox.includes(particleId)) {
      currentUser.toolbox = [...currentUser.toolbox, particleId];
    }
    void addConnectorToCurrentUserToolbox(particleId).catch((error) => {
      console.error("[Network feed] Failed to persist toolbox update.", error);
      localToolboxParticles = previous;
    });
  };

  onMount(() => {
    pageMounted = true;
    formats = loadLocalFormats();
    void Promise.allSettled([
      getCurrentUserToolboxLibrary(),
      getCurrentUserSocialPreferences(),
    ]).then((results) => {
      if (!pageMounted) return;
      const [toolboxResult, socialResult] = results;

      if (toolboxResult.status === "fulfilled") {
        localToolboxParticles = [...toolboxResult.value.connector];
      } else {
        console.warn(
          "[Network feed] Failed to load toolbox preferences from profile.",
          toolboxResult.reason,
        );
      }

      if (socialResult.status === "fulfilled") {
        localFollowing =
          socialResult.value.followedUserIds.length > 0
            ? [...socialResult.value.followedUserIds]
            : Object.keys(displayUsersById).filter((id) => id !== mockCurrentUserId);
        localFollowedFormats = [...socialResult.value.followedFormatIds];
      } else {
        console.warn("[Network feed] Failed to load social preferences.", socialResult.reason);
        localFollowing = Object.keys(displayUsersById).filter((id) => id !== mockCurrentUserId);
        localFollowedFormats = [];
      }
    });
    void loadChainFeed();

    return () => {
      pageMounted = false;
      // Invalidate all in-flight async responders so stale callbacks cannot mutate state.
      feedSyncRequestVersion += 1;
      runtimeHydrationRequestVersion += 1;
    };
  });
</script>

<div class="social-page">
  <div class="follow-panel-shell">
    <section class="follow-search-bar" aria-label="Search users and network elements">
      <div class="follow-search-inner">
        <div class="follow-search-field">
          <Input
            label=""
            placeholder="Search users, connectors, transformations, conditions"
            value={followSearch}
            oninput={(event) => {
              followSearch = event.currentTarget.value;
            }}
          />
        </div>
      </div>

      {#if showSearchResults}
        <div class="follow-candidate-list" role="list" aria-label="Search results">
          {#if userSearchResults.length}
            <div class="result-group">
              <p class="result-group-label">Users</p>
              {#each userSearchResults as user (user.id)}
                <div class="follow-candidate-item" role="listitem">
                  <div class="candidate-meta">
                    <img
                      class="candidate-avatar"
                      src={user.avatarUrl}
                      alt={`${user.nickname} avatar`}
                    />
                    <div class="candidate-text">
                      <p class="candidate-name">{user.nickname}</p>
                      <p class="candidate-kind">{user.kind === "agent" ? "AI Agent" : "Human"}</p>
                    </div>
                  </div>
                  {#if followedAuthorIds.has(user.id)}
                    <span class="candidate-state">Following</span>
                  {:else}
                    <Button
                      variant="ghost"
                      onclick={() => {
                        void followUser(user.id);
                      }}
                      className="follow-btn"
                    >
                      Follow
                    </Button>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          {#if entitySearchResults.length}
            <div class="result-group">
              <p class="result-group-label">Network elements</p>
              {#each entitySearchResults as item (item.id)}
                <div class="follow-candidate-item" role="listitem">
                  <div class="candidate-meta">
                    <div class="candidate-avatar candidate-avatar--glyph" aria-hidden="true">
                      {item.kind.slice(0, 1).toUpperCase()}
                    </div>
                    <div class="candidate-text">
                      <p class="candidate-name">{item.label}</p>
                      <p class="candidate-kind">
                        {item.kind} · by {item.creatorName}
                      </p>
                    </div>
                  </div>
                  {#if item.kind === "connector"}
                    <Button
                      variant="ghost"
                      onclick={() => openConnectorInStudio(item.entityId)}
                      className="follow-btn"
                    >
                      Open
                    </Button>
                  {:else}
                    <Button
                      variant="ghost"
                      onclick={() => openLibraryEntityInStudio(item.kind, item.entityId)}
                      className="follow-btn"
                    >
                      Use
                    </Button>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          {#if userSearchResults.length === 0 && entitySearchResults.length === 0}
            <div class="search-empty" role="listitem">No users or network elements found.</div>
          {/if}
        </div>
      {/if}
    </section>
  </div>

  <ParticlePostFeed
    loading={feedUiLoading}
    loadingMore={feedLoadMoreBusy}
    hasMore={canLoadMoreEvents}
    events={visibleNetworkFeedEvents}
    emptyMessage={feedEmptyMessage}
    onLoadMore={loadMoreFeedEvents}
    onParticleOpen={openConnectorInStudio}
    onAddToToolbox={addParticleToToolbox}
    {toolboxParticleIds}
  />
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .social-page {
    @apply h-full flex-1 min-h-0 overflow-hidden p-2 md:p-3 grid gap-3;
    grid-template-rows: auto minmax(0, 1fr);
    --social-feed-card-width: min(50vw, 56rem);
    background:
      radial-gradient(circle at 10% -10%, rgba(103, 214, 255, 0.12), transparent 45%),
      radial-gradient(circle at 90% 0%, rgba(244, 178, 71, 0.09), transparent 45%),
      radial-gradient(circle at 50% 120%, rgba(168, 85, 247, 0.08), transparent 55%);
  }

  .follow-panel-shell {
    @apply mx-auto z-10 shrink-0;
    width: var(--social-feed-card-width);
    max-width: 100%;
  }

  .follow-search-bar {
    @apply rounded-3xl border border-white/10 bg-black/70 backdrop-blur-xl
      px-3 py-3 md:px-4 md:py-3.5;
  }

  .follow-search-inner {
    @apply flex flex-col gap-2;
  }

  .follow-search-field {
    @apply min-w-0;
  }

  .follow-candidate-list {
    @apply mt-2 grid gap-2;
  }

  .result-group {
    @apply grid gap-1.5;
  }

  .result-group-label {
    @apply text-[0.58rem] uppercase tracking-[0.2em] text-white/40 px-1;
  }

  .follow-candidate-item {
    @apply flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2;
  }

  .candidate-meta {
    @apply flex items-center gap-2.5 min-w-0;
  }

  .candidate-avatar {
    @apply h-8 w-8 rounded-lg border border-white/10 object-cover bg-white/5 shrink-0;
  }

  .candidate-avatar--glyph {
    @apply flex items-center justify-center text-xs font-semibold text-white/70;
  }

  .candidate-text {
    @apply min-w-0;
  }

  .candidate-name {
    @apply text-sm font-medium text-white leading-tight;
  }

  .candidate-kind {
    @apply text-[0.62rem] uppercase tracking-[0.14em] text-white/45;
  }

  .candidate-state {
    @apply text-[0.62rem] uppercase tracking-[0.14em] text-white/45 px-1;
  }

  .search-empty {
    @apply rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60;
  }

  @media (max-width: 1200px) {
    .social-page {
      --social-feed-card-width: min(68vw, 56rem);
    }
  }

  @media (max-width: 900px) {
    .social-page {
      --social-feed-card-width: 100%;
    }
  }
</style>
