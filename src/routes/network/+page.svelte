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
    isParticlePostDataLoaded,
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
  const CHAIN_SOURCE_LIMIT_STEP = 5;
  const CHAIN_SOURCE_LIMIT_MAX = 256;

  let followSearch = $state("");
  let feedEvents = $state<ParticlePostEvent[]>([]);
  let feedLoading = $state(true);
  let feedLoadMoreBusy = $state(false);
  let profileLoading = $state(true);
  let formats = $state<ParticleFormat[]>([]);
  let chainElements = $state(listParticleSearchEntities());
  let visibleEventCount = $state(FEED_PAGE_SIZE);
  let sourceSyncLimit = $state(CHAIN_SOURCE_LIMIT_STEP);
  let canFetchMoreFromChain = $state(true);
  let runtimeSearchHydrationBusy = $state(false);
  let runtimeSearchHydrated = $state(false);
  let localFollowing = $state<string[]>([]);
  let localFollowedFormats = $state<string[]>([]);
  let localToolboxParticles = $state<string[]>([
    ...(mockUsersById[mockCurrentUserId]?.toolbox ?? []),
  ]);

  const followedAuthorIds = $derived.by(() => new SvelteSet(localFollowing));
  const followedFormatKeys = $derived.by(() => new SvelteSet(localFollowedFormats));
  const toolboxParticleIds = $derived.by(() => new SvelteSet(localToolboxParticles));
  const feedUiLoading = $derived.by(() => feedLoading || profileLoading);
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
  const networkFeedEvents = $derived.by(() =>
    ([...feedEvents, ...formatFeedEvents] as NetworkFeedEvent[])
      .filter((event) => {
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
      })
      .sort((a, b) => b.createdAt - a.createdAt),
  );
  const visibleNetworkFeedEvents = $derived.by(() =>
    networkFeedEvents.slice(0, Math.max(0, visibleEventCount)),
  );
  const hasMoreVisibleEvents = $derived.by(() => networkFeedEvents.length > visibleEventCount);
  const canLoadMoreEvents = $derived.by(() => hasMoreVisibleEvents || canFetchMoreFromChain);

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
    const hasCachedData = isParticlePostDataLoaded();
    if (hasCachedData) {
      feedEvents = listParticlePosts();
      chainElements = listParticleSearchEntities();
      feedLoading = false;
    } else {
      feedLoading = true;
    }

    try {
      await syncParticlePostDataFromChain({
        force: !hasCachedData,
        maxOwnedPerSource: sourceSyncLimit,
        includeRuntimeCode: false,
        includeDependencyExpansion: false,
      });
    } catch (error) {
      console.error("[Network feed] Failed to sync chain-backed particle posts.", error);
    } finally {
      feedEvents = listParticlePosts();
      chainElements = listParticleSearchEntities();
      feedLoading = false;
    }

    if (hasCachedData) {
      void syncParticlePostDataFromChain({
        force: true,
        maxOwnedPerSource: sourceSyncLimit,
        includeRuntimeCode: false,
        includeDependencyExpansion: false,
      })
        .then(() => {
          feedEvents = listParticlePosts();
          chainElements = listParticleSearchEntities();
        })
        .catch((error) => {
          console.warn("[Network feed] Background refresh failed.", error);
        });
    }
  };

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
        maxOwnedPerSource: sourceSyncLimit,
        includeRuntimeCode: false,
        includeDependencyExpansion: false,
      });
      const afterCount = listParticlePosts().length;
      feedEvents = listParticlePosts();
      chainElements = listParticleSearchEntities();
      visibleEventCount += FEED_PAGE_SIZE;

      if (afterCount <= beforeCount) {
        canFetchMoreFromChain = false;
      }
    } catch (error) {
      console.error("[Network feed] Failed to load more events.", error);
    } finally {
      feedLoadMoreBusy = false;
    }
  };

  $effect(() => {
    if (runtimeSearchHydrated || runtimeSearchHydrationBusy) return;
    if (searchQuery.length === 0) return;
    if (chainElements.transformations.length > 0 || chainElements.conditions.length > 0) {
      runtimeSearchHydrated = true;
      return;
    }

    runtimeSearchHydrationBusy = true;
    void syncParticlePostDataFromChain({
      force: true,
      maxOwnedPerSource: sourceSyncLimit,
      includeRuntimeCode: true,
    })
      .then(() => {
        feedEvents = listParticlePosts();
        chainElements = listParticleSearchEntities();
        runtimeSearchHydrated = true;
      })
      .catch((error) => {
        console.warn("[Network feed] Runtime code hydration failed.", error);
      })
      .finally(() => {
        runtimeSearchHydrationBusy = false;
      });
  });

  const openConnectorInStudio = (connectorId: string) => {
    if (!connectorId) return;
    const base = resolve("/studio");
    const target = new URL(base, window.location.origin);
    target.searchParams.set("network_kind", networkNodeStudioKind("connector"));
    target.searchParams.set("network_id", connectorId);
    window.open(target.toString(), "_blank", "noopener,noreferrer");
  };

  const openLibraryEntityInStudio = (
    kind: Extract<SearchableEntityKind, "transformation" | "condition">,
    id: string,
  ) => {
    if (!id) return;
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
    formats = loadLocalFormats();
    void Promise.allSettled([
      getCurrentUserToolboxLibrary(),
      getCurrentUserSocialPreferences({ bootstrapPrototypeIfEmpty: true }),
    ])
      .then((results) => {
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
          localFollowing = [...socialResult.value.followedUserIds];
          localFollowedFormats = [...socialResult.value.followedFormatIds];
        } else {
          console.warn("[Network feed] Failed to load social preferences.", socialResult.reason);
          localFollowing = Object.keys(displayUsersById).filter((id) => id !== mockCurrentUserId);
          localFollowedFormats = [];
        }
      })
      .finally(() => {
        profileLoading = false;
      });
    void loadChainFeed();
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

  .follow-btn {
    @apply text-xs px-2.5 py-1.5;
  }

  .candidate-state {
    @apply text-[0.62rem] uppercase tracking-[0.14em] text-white/45 px-1;
  }

  .candidate-link-btn {
    @apply text-xs px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/75 no-underline transition;
  }

  .candidate-link-btn:hover {
    @apply border-white/25 text-white bg-white/10;
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
