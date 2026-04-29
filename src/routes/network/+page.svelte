<script lang="ts">
  import { onMount } from "svelte";
  import { SvelteMap, SvelteSet } from "svelte/reactivity";
  import { resolve } from "$app/paths";
  import ConnectorPostFeed from "$lib/components/feed/ConnectorPostFeed.svelte";
  import {
    addConnectorToCurrentUserToolbox,
    followFormatInProfile,
    followUserInProfile,
    getCurrentUserProfileState,
    listServicesUsers,
    resolveCurrentUserChainSourceAddresses,
    unfollowUserInProfile,
    unfollowFormatInProfile,
  } from "$lib/auth/api";
  import {
    createConnectorPostDataStream,
    doesParticlePostCacheMatchFeedScope,
    getConnectorPostFeedState,
    loadMoreConnectorPostDataFromChain,
    listParticlePosts as listConnectorPosts,
    listParticleSearchEntities as listConnectorSearchEntities,
    syncParticlePostDataFromChain as syncConnectorPostDataFromChain,
    type NetworkFeedEvent,
    type ParticlePostEvent as ConnectorPostEvent,
  } from "$lib/feed/particlePostData";
  import {
    getChainAccounts,
    getChainFormats,
    resolveChainAccountsCursor,
    normalizeFormatHash,
    resolveChainFormatsCursor,
  } from "$lib/chain/registryApi";
  import { computeFeedSourceAddresses } from "$lib/feed/feedSources";
  import { resolveNetworkFeedEmptyMessage } from "$lib/feed/networkFeedUi";
  import {
    getServicesUserChainSourceAddresses,
    resolveServicesUserDisplayLabel,
    resolveServicesUserAvatarUrl,
  } from "$lib/social/authorLabels";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import { getChainFormatDisplayName } from "$lib/formats/chainFormats";
  import { normalizeProfileUser } from "$lib/user/profileModel";

  const FEED_PAGE_SIZE = 10;
  const RUNTIME_SEARCH_MAX_OWNED_PER_SOURCE = 16;
  const CHAIN_DISCOVERY_FORMATS_PAGE_LIMIT = 256;
  const CHAIN_DISCOVERY_FORMATS_PAGE_GUARD = 128;
  const CHAIN_DISCOVERY_ACCOUNTS_PAGE_LIMIT = 256;
  const CHAIN_DISCOVERY_ACCOUNTS_PAGE_GUARD = 128;
  const ETH_ADDRESS_RE = /^0x[0-9a-f]{40}$/;
  const PROFILE_SOURCES_UNAVAILABLE_MESSAGE =
    "Unable to resolve your profile network sources. Check connection and reload.";

  type DiscoveredUser = {
    address: string;
    label: string;
    avatarUrl: string;
  };

  let followSearch = $state("");
  let feedEvents = $state<ConnectorPostEvent[]>([]);
  let feedLoading = $state(true);
  let feedSyncSettled = $state(false);
  let feedLoadMoreBusy = $state(false);
  let feedLoadError = $state("");
  let chainElements = $state(listConnectorSearchEntities());
  let visibleEventCount = $state(FEED_PAGE_SIZE);
  let runtimeSearchHydrationBusy = $state(false);
  let runtimeSearchHydrated = $state(false);
  let discoveredUsers = $state<DiscoveredUser[]>([]);
  let discoveredUsersLoaded = $state(false);
  let discoveredUsersLoading = $state(false);
  let discoveredFormatHashes = $state<string[]>([]);
  let discoveredFormatHashesLoaded = $state(false);
  let discoveredFormatHashesLoading = $state(false);
  let localFollowing = $state<string[]>([]);
  let localFollowedFormats = $state<string[]>([]);
  let userFollowPendingByAddress = $state<Record<string, boolean>>({});
  let localToolboxConnectors = $state<string[]>([]);
  let currentUserAddress = $state("");
  let currentUserSourceAliases = $state<string[]>([]);
  let currentUserLabel = $state("");
  let currentUserAvatarUrl = $state("");
  let socialPreferencesHydrated = $state(false);
  let pageMounted = false;
  let feedSyncRequestVersion = 0;
  let runtimeHydrationRequestVersion = 0;
  let feedHasMoreHistory = $state(false);
  let feedStreamSubscription: { close: () => void } | null = null;
  let feedStreamStaleReloadPending = false;

  const normalizeAddressForKey = (value: string): string => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return "";
    return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  };
  const isChainAddress = (value: string): boolean =>
    ETH_ADDRESS_RE.test(normalizeAddressForKey(value));

  const normalizeFormatHashForKey = (value: string): string => {
    try {
      return normalizeFormatHash(value);
    } catch {
      return "";
    }
  };

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
  const toolboxConnectorIds = $derived.by(() => new SvelteSet(localToolboxConnectors));
  const currentUserAddressKey = $derived.by(() => normalizeAddressForKey(currentUserAddress));
  const currentUserSourceAddressSet = $derived.by(() => {
    const set = new SvelteSet<string>();
    const primary = normalizeAddressForKey(currentUserAddress);
    if (primary) set.add(primary);
    currentUserSourceAliases.forEach((entry) => {
      const normalized = normalizeAddressForKey(entry);
      if (normalized) set.add(normalized);
    });
    return set;
  });
  const feedUiLoading = $derived.by(
    () => feedLoading || !feedSyncSettled || !socialPreferencesHydrated,
  );
  const searchQuery = $derived.by(() => followSearch.trim().toLowerCase());
  const discoveredUserLabelByAddress = $derived.by(
    () =>
      new Map(
        discoveredUsers.map(
          (entry) => [normalizeAddressForKey(entry.address), entry.label] as const,
        ),
      ),
  );
  const feedAuthorLabels = $derived.by(() => {
    const labelMap: Record<string, string> = {};
    discoveredUsers.forEach((entry) => {
      const normalized = normalizeAddressForKey(entry.address);
      if (!normalized) return;
      const label = entry.label.trim();
      if (!label) return;
      labelMap[normalized] = label;
    });
    if (currentUserAddressKey) {
      const label = currentUserLabel.trim();
      if (label) {
        labelMap[currentUserAddressKey] = label;
      }
    }
    const currentUserFallbackLabel = currentUserLabel.trim();
    if (currentUserFallbackLabel) {
      currentUserSourceAliases.forEach((address) => {
        const normalized = normalizeAddressForKey(address);
        if (!normalized || labelMap[normalized]) return;
        labelMap[normalized] = currentUserFallbackLabel;
      });
    }
    localFollowing.forEach((address) => {
      const normalized = normalizeAddressForKey(address);
      if (!normalized || labelMap[normalized]) return;
      labelMap[normalized] = normalized;
    });
    return labelMap;
  });
  const feedAuthorAvatarUrls = $derived.by(() => {
    const avatarMap: Record<string, string> = {};
    discoveredUsers.forEach((entry) => {
      const normalized = normalizeAddressForKey(entry.address);
      const avatarUrl = entry.avatarUrl.trim();
      if (!normalized || !avatarUrl) return;
      avatarMap[normalized] = avatarUrl;
    });
    const currentAvatarUrl = currentUserAvatarUrl.trim();
    if (currentAvatarUrl) {
      if (currentUserAddressKey) {
        avatarMap[currentUserAddressKey] = currentAvatarUrl;
      }
      currentUserSourceAliases.forEach((address) => {
        const normalized = normalizeAddressForKey(address);
        if (!normalized || avatarMap[normalized]) return;
        avatarMap[normalized] = currentAvatarUrl;
      });
    }
    return avatarMap;
  });
  const networkFeedEvents = $derived.by(() => {
    const combined = [...feedEvents] as NetworkFeedEvent[];
    const filtered = combined.filter((event) => {
      const authorAddress = normalizeAddressForKey(event.authorId);
      const authoredByViewer = currentUserSourceAddressSet.has(authorAddress);
      if (event.type === "connector") {
        const connectorFormatHash = normalizeFormatHashForKey(event.formatHash ?? "");
        return (
          authoredByViewer ||
          followedAuthorIds.has(authorAddress) ||
          Boolean(connectorFormatHash && followedFormatKeys.has(connectorFormatHash))
        );
      }
      return authoredByViewer || followedAuthorIds.has(authorAddress);
    });

    const sorted = [...filtered].sort((a, b) => {
      const byCreatedAt = b.createdAt - a.createdAt;
      if (byCreatedAt !== 0) return byCreatedAt;
      return b.id.localeCompare(a.id);
    });

    return sorted;
  });
  const visibleNetworkFeedEvents = $derived.by(() =>
    networkFeedEvents.slice(0, Math.max(0, visibleEventCount)),
  );
  const hasMoreVisibleEvents = $derived.by(() => networkFeedEvents.length > visibleEventCount);
  const canLoadMoreEvents = $derived.by(() => hasMoreVisibleEvents || feedHasMoreHistory);
  const feedEmptyMessage = $derived.by(() => {
    const hasFollowTargets = localFollowing.length > 0 || localFollowedFormats.length > 0;
    const hasOwnEvents = feedEvents.some((event) =>
      currentUserSourceAddressSet.has(normalizeAddressForKey(event.authorId)),
    );
    return resolveNetworkFeedEmptyMessage({
      feedLoadError,
      hasVisibleEvents: visibleNetworkFeedEvents.length > 0,
      hasFollowTargets,
      hasOwnEvents,
    });
  });

  const readConnectorFeedEventsFromCache = (): ConnectorPostEvent[] => listConnectorPosts();

  const deriveCurrentSourceAddresses = async (
    profileState: Awaited<ReturnType<typeof getCurrentUserProfileState>>,
  ) => {
    const resolvedProfileSources = resolveCurrentUserChainSourceAddresses(profileState.me)
      .map(normalizeAddressForKey)
      .filter(Boolean);
    const merged = Array.from(new Set(resolvedProfileSources));

    if (import.meta.env.DEV) {
      console.info("[Network feed] Source derivation", {
        profileSources: resolvedProfileSources,
        mergedSources: merged,
      });
    }

    return merged;
  };

  const hydrateProfileStateForNetwork = async (options?: { preferCached?: boolean }) => {
    const profileState = await getCurrentUserProfileState({
      ...(options ? { preferCached: options.preferCached } : {}),
    });
    localToolboxConnectors = [...profileState.toolbox.connector];
    const resolvedSourceAddresses = await deriveCurrentSourceAddresses(profileState);
    const currentProfileUser = profileState.me ? normalizeProfileUser(profileState.me) : null;
    const currentProfileNickname = currentProfileUser?.nickname.trim() ?? "";
    currentUserLabel =
      extractDisplayName(profileState.me) ||
      (currentProfileNickname !== "Unknown" ? currentProfileNickname : "");
    currentUserAvatarUrl = currentProfileUser?.avatarUrl ?? "";
    localFollowing = profileState.social.followedUserAddresses
      .map(normalizeAddressForKey)
      .filter(Boolean);
    localFollowedFormats = profileState.social.followedFormatHashes
      .map(normalizeFormatHashForKey)
      .filter(Boolean);
    currentUserAddress = resolvedSourceAddresses[0] ?? "";
    currentUserSourceAliases = resolvedSourceAddresses.slice(1);
    return resolvedSourceAddresses;
  };

  const refreshFeedStateFromCache = () => {
    feedEvents = readConnectorFeedEventsFromCache();
    chainElements = listConnectorSearchEntities();
    feedHasMoreHistory = getConnectorPostFeedState().hasMoreHistory;
    if (feedEvents.length > 0) {
      feedLoadError = "";
    }
  };

  const userSearchResults = $derived.by(() => {
    if (!searchQuery) return [] as DiscoveredUser[];

    const byAddress = new SvelteMap<string, DiscoveredUser>();
    discoveredUsers.forEach((user) => {
      byAddress.set(user.address, user);
    });
    localFollowing.forEach((address) => {
      const normalized = normalizeAddressForKey(address);
      if (!normalized || byAddress.has(normalized)) return;
      const knownLabel = discoveredUserLabelByAddress.get(normalized)?.trim() ?? "";
      byAddress.set(normalized, {
        address: normalized,
        label: knownLabel || normalized,
        avatarUrl: "",
      });
    });
    if (currentUserAddressKey && !byAddress.has(currentUserAddressKey)) {
      byAddress.set(currentUserAddressKey, {
        address: currentUserAddressKey,
        label: currentUserLabel.trim() || currentUserAddressKey,
        avatarUrl: currentUserAvatarUrl,
      });
    }

    const candidates = Array.from(byAddress.values());

    const matched = candidates
      .filter((user) => `${user.label} ${user.address}`.toLowerCase().includes(searchQuery))
      .slice(0, 8);

    const normalizedAddressQuery = normalizeAddressForKey(searchQuery);
    if (
      isChainAddress(normalizedAddressQuery) &&
      !matched.some((user) => user.address === normalizedAddressQuery)
    ) {
      const knownLabel = discoveredUserLabelByAddress.get(normalizedAddressQuery)?.trim() ?? "";
      return [
        {
          address: normalizedAddressQuery,
          label: knownLabel || normalizedAddressQuery,
          avatarUrl: "",
        },
        ...matched,
      ].slice(0, 8);
    }

    return matched;
  });

  const formatSearchResults = $derived.by(() => {
    if (!searchQuery) return [] as string[];
    return discoveredFormatHashes
      .filter((hash) =>
        `${hash} ${getChainFormatDisplayName(hash)}`.toLowerCase().includes(searchQuery),
      )
      .slice(0, 8);
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
      .filter((item) => {
        const searchableKind = `${item.kind} ${item.kind}s`;
        return `${searchableKind} ${item.label} ${item.id} ${item.summary}`
          .toLowerCase()
          .includes(searchQuery);
      })
      .map((item) => ({
        id: `${item.kind}:${item.id}`,
        label: item.label,
        kind: item.kind,
        entityId: item.id,
        summary: item.summary,
        creatorName:
          discoveredUserLabelByAddress.get(normalizeAddressForKey(item.authorId)) ??
          normalizeAddressForKey(item.authorId) ??
          "unknown contributor",
      }))
      .slice(0, 10);
  });

  const showSearchResults = $derived.by(() => searchQuery.length > 0);

  const isUserFollowPending = (address: string): boolean =>
    Boolean(userFollowPendingByAddress[normalizeAddressForKey(address)]);

  const getFeedSourceAddresses = (): string[] => {
    const primary =
      currentUserAddressKey || normalizeAddressForKey(currentUserSourceAliases[0] ?? "");
    return computeFeedSourceAddresses({
      currentUserAddress: primary,
      followedUserAddresses: [...localFollowing, ...currentUserSourceAliases],
    });
  };

  const getFeedSyncOptions = () => ({
    sourceAddresses: getFeedSourceAddresses(),
    followedFormatHashes: [...localFollowedFormats],
    includeRuntimeCode: true,
    includeDependencyExpansion: false,
  });

  const closeFeedStream = () => {
    feedStreamSubscription?.close();
    feedStreamSubscription = null;
  };

  const startFeedStream = (
    syncOptions: ReturnType<typeof getFeedSyncOptions>,
    requestVersion: number,
  ) => {
    closeFeedStream();
    try {
      feedStreamSubscription = createConnectorPostDataStream({
        ...syncOptions,
        onUpdate: () => {
          if (!isFeedSyncRequestActive(requestVersion)) return;
          refreshFeedStateFromCache();
        },
        onMeta: () => {
          if (!isFeedSyncRequestActive(requestVersion)) return;
          feedHasMoreHistory = getConnectorPostFeedState().hasMoreHistory;
        },
        onStale: () => {
          if (!isFeedSyncRequestActive(requestVersion) || feedStreamStaleReloadPending) return;
          feedStreamStaleReloadPending = true;
          void loadChainFeed({ refreshProfile: false, force: true }).finally(() => {
            feedStreamStaleReloadPending = false;
          });
        },
        onError: (error) => {
          if (!isFeedSyncRequestActive(requestVersion)) return;
          console.warn("[Network feed] Chain feed stream failed.", error);
        },
      });
    } catch (error) {
      console.warn("[Network feed] Failed to start chain feed stream.", error);
    }
  };

  const loadChainFeed = async (options?: { refreshProfile?: boolean; force?: boolean }) => {
    const requestVersion = beginFeedSyncRequest();
    closeFeedStream();
    feedLoadError = "";
    if (options?.refreshProfile !== false) {
      try {
        await hydrateProfileStateForNetwork({ preferCached: false });
      } catch (profileError) {
        if (!isFeedSyncRequestActive(requestVersion)) return;
        console.warn(
          "[Network feed] Failed to refresh profile state before feed sync.",
          profileError,
        );
      }
    }
    const syncOptions = getFeedSyncOptions();
    const sourceAddresses = syncOptions.sourceAddresses;
    const followedFormatHashes = syncOptions.followedFormatHashes;
    if (import.meta.env.DEV) {
      console.info("[Network feed] Sync scope", {
        sourceAddresses,
        followedFormatHashes,
      });
    }
    try {
      if (sourceAddresses.length === 0 && followedFormatHashes.length === 0) {
        feedEvents = [];
        chainElements = { connectors: [], transformations: [], conditions: [] };
        feedHasMoreHistory = false;
        feedLoading = false;
        feedSyncSettled = true;
      } else {
        const cacheMatchesCurrentSources = doesParticlePostCacheMatchFeedScope(
          sourceAddresses,
          followedFormatHashes,
        );
        let hasCachedFeed = false;

        if (cacheMatchesCurrentSources) {
          refreshFeedStateFromCache();
          hasCachedFeed = feedEvents.length > 0;
          feedLoading = !hasCachedFeed;
          feedSyncSettled = hasCachedFeed;
        } else {
          // Avoid showing stale events from a previous source set while refreshing.
          feedEvents = [];
          chainElements = { connectors: [], transformations: [], conditions: [] };
          feedHasMoreHistory = false;
          feedLoading = true;
          feedSyncSettled = false;
        }

        await syncConnectorPostDataFromChain({ ...syncOptions, force: options?.force ?? true });
        if (!isFeedSyncRequestActive(requestVersion)) return;
        refreshFeedStateFromCache();
        feedLoading = false;
        feedSyncSettled = true;
        startFeedStream(syncOptions, requestVersion);
      }
      visibleEventCount = FEED_PAGE_SIZE;
    } catch (error) {
      if (!isFeedSyncRequestActive(requestVersion)) return;
      console.error("[Network feed] Failed to sync chain-backed connector posts.", error);
      feedLoadError = error instanceof Error ? error.message : "Unable to load network feed.";
      feedLoading = false;
      feedSyncSettled = true;
    } finally {
      if (isFeedSyncRequestActive(requestVersion)) {
        if (feedLoading) {
          feedLoading = false;
          feedSyncSettled = true;
        }
      }
    }
  };

  const loadMoreFeedEvents = async () => {
    if (feedLoadMoreBusy) return;

    if (hasMoreVisibleEvents) {
      visibleEventCount += FEED_PAGE_SIZE;
      return;
    }

    if (!feedHasMoreHistory) return;

    const requestVersion = feedSyncRequestVersion;
    feedLoadMoreBusy = true;
    feedLoadError = "";
    try {
      await loadMoreConnectorPostDataFromChain(getFeedSyncOptions());
      if (!isFeedSyncRequestActive(requestVersion)) return;
      refreshFeedStateFromCache();
      visibleEventCount += FEED_PAGE_SIZE;
    } catch (error) {
      if (!isFeedSyncRequestActive(requestVersion)) return;
      console.error("[Network feed] Failed to load older chain feed events.", error);
      feedLoadError =
        error instanceof Error ? error.message : "Unable to load older network feed events.";
    } finally {
      if (isFeedSyncRequestActive(requestVersion)) {
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

    const sourceAddresses = getFeedSourceAddresses();
    if (sourceAddresses.length === 0) return;

    const requestVersion = beginRuntimeHydrationRequest();
    runtimeSearchHydrationBusy = true;
    void syncConnectorPostDataFromChain({
      force: true,
      sourceAddresses,
      followedFormatHashes: [...localFollowedFormats],
      maxOwnedPerSource: RUNTIME_SEARCH_MAX_OWNED_PER_SOURCE,
      includeRuntimeCode: true,
      includeDependencyExpansion: false,
    })
      .then(() => {
        if (!isRuntimeHydrationRequestActive(requestVersion)) return;
        feedEvents = readConnectorFeedEventsFromCache();
        chainElements = listConnectorSearchEntities();
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
    target.searchParams.set("network_kind", "connector");
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

  const toggleUserFollow = async (address: string) => {
    const normalizedAddress = normalizeAddressForKey(address);
    if (!normalizedAddress) return;
    if (isUserFollowPending(normalizedAddress)) return;

    const isFollowing = localFollowing.includes(normalizedAddress);
    userFollowPendingByAddress = {
      ...userFollowPendingByAddress,
      [normalizedAddress]: true,
    };

    try {
      if (isFollowing) {
        await unfollowUserInProfile(normalizedAddress);
      } else {
        await followUserInProfile(normalizedAddress);
      }

      await hydrateProfileStateForNetwork({ preferCached: false });

      runtimeSearchHydrated = false;
      await loadChainFeed({ refreshProfile: false });
    } catch (error) {
      console.error("[Network feed] Failed to persist following state.", error);
    } finally {
      const nextPending = { ...userFollowPendingByAddress };
      delete nextPending[normalizedAddress];
      userFollowPendingByAddress = nextPending;
    }
  };

  const toggleFormatFollow = async (formatHash: string) => {
    const normalizedHash = normalizeFormatHashForKey(formatHash);
    if (!normalizedHash) return;
    const previous = [...localFollowedFormats];
    const isFollowing = followedFormatKeys.has(normalizedHash);
    localFollowedFormats = isFollowing
      ? localFollowedFormats.filter((entry) => entry !== normalizedHash)
      : Array.from(new Set([...localFollowedFormats, normalizedHash]));
    try {
      if (isFollowing) {
        await unfollowFormatInProfile(normalizedHash);
      } else {
        await followFormatInProfile(normalizedHash);
      }
      runtimeSearchHydrated = false;
      await loadChainFeed({ refreshProfile: false, force: true });
    } catch (error) {
      console.error("[Network feed] Failed to persist followed format state.", error);
      localFollowedFormats = previous;
    }
  };

  const addConnectorToToolbox = (connectorId: string) => {
    if (toolboxConnectorIds.has(connectorId)) return;
    const previous = [...localToolboxConnectors];
    localToolboxConnectors = [...localToolboxConnectors, connectorId];
    void addConnectorToCurrentUserToolbox(connectorId).catch((error) => {
      console.error("[Network feed] Failed to persist toolbox update.", error);
      localToolboxConnectors = previous;
    });
  };

  const loadDiscoveredFormatHashes = async (): Promise<string[]> => {
    const discovered = new SvelteSet<string>();
    let after: string | null = null;
    let guard = 0;

    do {
      const response = await getChainFormats({
        limit: CHAIN_DISCOVERY_FORMATS_PAGE_LIMIT,
        ...(after ? { after } : {}),
      });
      const formats = Array.isArray(response.formats) ? response.formats : [];
      formats.forEach((rawHash) => {
        const normalized = normalizeFormatHashForKey(rawHash);
        if (normalized) discovered.add(normalized);
      });
      const cursor = resolveChainFormatsCursor(response);
      if (!cursor.hasMore || !cursor.nextAfter) break;
      after = cursor.nextAfter;
      guard += 1;
    } while (guard < CHAIN_DISCOVERY_FORMATS_PAGE_GUARD);

    return Array.from(discovered).sort((a, b) => a.localeCompare(b));
  };

  const loadDiscoveredUsers = async (options?: {
    includeChainAccounts?: boolean;
  }): Promise<DiscoveredUser[]> => {
    const byAddress = new SvelteMap<string, DiscoveredUser>();

    try {
      const users = await listServicesUsers();
      users.forEach((user) => {
        const addresses = getServicesUserChainSourceAddresses(user);
        addresses.forEach((address) => {
          const normalized = normalizeAddressForKey(address);
          if (!isChainAddress(normalized)) return;
          byAddress.set(normalized, {
            address: normalized,
            label: resolveServicesUserDisplayLabel(user, normalized),
            avatarUrl: resolveServicesUserAvatarUrl(user),
          });
        });
      });
    } catch (error) {
      console.warn("[Network feed] Services user discovery failed.", error);
    }

    if (options?.includeChainAccounts !== false) {
      try {
        let after: string | null = null;
        let guard = 0;
        do {
          const response = await getChainAccounts({
            limit: CHAIN_DISCOVERY_ACCOUNTS_PAGE_LIMIT,
            ...(after ? { after } : {}),
          });
          const accounts = Array.isArray(response.accounts) ? response.accounts : [];
          accounts.forEach((rawAddress) => {
            const normalized = normalizeAddressForKey(rawAddress);
            if (!isChainAddress(normalized)) return;
            if (byAddress.has(normalized)) return;
            byAddress.set(normalized, {
              address: normalized,
              label: normalized,
              avatarUrl: "",
            });
          });

          const cursor = resolveChainAccountsCursor(response);
          if (!cursor.hasMore || !cursor.nextAfter) break;
          after = cursor.nextAfter;
          guard += 1;
        } while (guard < CHAIN_DISCOVERY_ACCOUNTS_PAGE_GUARD);
      } catch (error) {
        console.warn("[Network feed] Chain account discovery failed.", error);
      }
    }

    return Array.from(byAddress.values()).sort((a, b) => a.address.localeCompare(b.address));
  };

  const extractDisplayName = (value: unknown): string => {
    if (!value || typeof value !== "object") return "";
    const root = value as Record<string, unknown>;
    const nested =
      root.user && typeof root.user === "object" ? (root.user as Record<string, unknown>) : root;
    if (typeof nested.display_name === "string" && nested.display_name.trim().length > 0) {
      return nested.display_name.trim();
    }
    if (typeof nested.displayName === "string" && nested.displayName.trim().length > 0) {
      return nested.displayName.trim();
    }
    return "";
  };

  $effect(() => {
    if (searchQuery.length === 0) return;
    if (discoveredUsersLoaded || discoveredUsersLoading) return;
    discoveredUsersLoading = true;
    void loadDiscoveredUsers({ includeChainAccounts: false })
      .then((users) => {
        if (!pageMounted) return;
        discoveredUsers = [...users];
        discoveredUsersLoaded = true;
      })
      .catch((error) => {
        if (!pageMounted) return;
        console.warn("[Network feed] Failed to load users from services API.", error);
      })
      .finally(() => {
        if (!pageMounted) return;
        discoveredUsersLoading = false;
      });
  });

  $effect(() => {
    if (searchQuery.length === 0) return;
    if (discoveredFormatHashesLoaded || discoveredFormatHashesLoading) return;
    discoveredFormatHashesLoading = true;
    void loadDiscoveredFormatHashes()
      .then((hashes) => {
        if (!pageMounted) return;
        discoveredFormatHashes = [...hashes];
        discoveredFormatHashesLoaded = true;
      })
      .catch((error) => {
        if (!pageMounted) return;
        console.warn("[Network feed] Failed to load chain format discovery.", error);
      })
      .finally(() => {
        if (!pageMounted) return;
        discoveredFormatHashesLoading = false;
      });
  });

  onMount(() => {
    pageMounted = true;
    socialPreferencesHydrated = false;
    void hydrateProfileStateForNetwork({ preferCached: false })
      .then(async (resolvedSourceAddresses) => {
        if (!pageMounted) return;
        socialPreferencesHydrated = true;
        if (
          resolvedSourceAddresses.length === 0 &&
          localFollowing.length === 0 &&
          localFollowedFormats.length === 0
        ) {
          feedLoadError = PROFILE_SOURCES_UNAVAILABLE_MESSAGE;
          feedLoading = false;
          feedSyncSettled = true;
          return;
        }
        void loadChainFeed({ refreshProfile: false });
      })
      .catch((error) => {
        if (!pageMounted) return;
        console.warn("[Network feed] Failed to load profile state.", error);
        localToolboxConnectors = [];
        currentUserAddress = "";
        currentUserSourceAliases = [];
        currentUserLabel = "";
        currentUserAvatarUrl = "";
        localFollowing = [];
        localFollowedFormats = [];
        socialPreferencesHydrated = true;
        feedLoadError = PROFILE_SOURCES_UNAVAILABLE_MESSAGE;
        feedLoading = false;
        feedSyncSettled = true;
      });

    return () => {
      pageMounted = false;
      // Invalidate all in-flight async responders so stale callbacks cannot mutate state.
      feedSyncRequestVersion += 1;
      runtimeHydrationRequestVersion += 1;
      closeFeedStream();
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
              {#each userSearchResults as user (user.address)}
                <div class="follow-candidate-item" role="listitem">
                  <div class="candidate-meta">
                    <div class="candidate-avatar candidate-avatar--glyph" aria-hidden="true">U</div>
                    <div class="candidate-text">
                      <a
                        class="candidate-name candidate-name-link"
                        href={resolve("/u/[id]", { id: user.address })}
                      >
                        {user.label}
                      </a>
                      <p class="candidate-kind">{user.address}</p>
                    </div>
                  </div>
                  <Button
                    variant={followedAuthorIds.has(user.address) ? "ghost" : "primary"}
                    disabled={isUserFollowPending(user.address)}
                    onclick={() => {
                      void toggleUserFollow(user.address);
                    }}
                    className="follow-btn"
                  >
                    {#if isUserFollowPending(user.address)}
                      {followedAuthorIds.has(user.address) ? "Unfollowing..." : "Following..."}
                    {:else}
                      {followedAuthorIds.has(user.address) ? "Following" : "Follow"}
                    {/if}
                  </Button>
                </div>
              {/each}
            </div>
          {/if}

          {#if formatSearchResults.length}
            <div class="result-group">
              <p class="result-group-label">Formats</p>
              {#each formatSearchResults as formatHash (formatHash)}
                <div class="follow-candidate-item" role="listitem">
                  <div class="candidate-meta">
                    <div class="candidate-avatar candidate-avatar--glyph" aria-hidden="true">F</div>
                    <div class="candidate-text">
                      <p class="candidate-name">{getChainFormatDisplayName(formatHash)}</p>
                      <p class="candidate-kind">{formatHash}</p>
                    </div>
                  </div>
                  <div class="candidate-actions">
                    <Button
                      variant="ghost"
                      onclick={() => {
                        window.open(
                          resolve("/f/[slug]", { slug: formatHash }),
                          "_blank",
                          "noopener,noreferrer",
                        );
                      }}
                      className="follow-btn"
                    >
                      Open
                    </Button>
                    <Button
                      variant={followedFormatKeys.has(formatHash) ? "ghost" : "primary"}
                      onclick={() => {
                        void toggleFormatFollow(formatHash);
                      }}
                      className="follow-btn"
                    >
                      {followedFormatKeys.has(formatHash) ? "Following" : "Follow"}
                    </Button>
                  </div>
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

          {#if userSearchResults.length === 0 && formatSearchResults.length === 0 && entitySearchResults.length === 0}
            <div class="search-empty" role="listitem">
              {#if discoveredUsersLoading || discoveredFormatHashesLoading || runtimeSearchHydrationBusy}
                Searching network data...
              {:else}
                No users, formats, or network elements found.
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </section>
  </div>

  <ConnectorPostFeed
    loading={feedUiLoading}
    loadingMore={feedLoadMoreBusy}
    hasMore={canLoadMoreEvents}
    events={visibleNetworkFeedEvents}
    emptyMessage={feedEmptyMessage}
    onLoadMore={loadMoreFeedEvents}
    onConnectorOpen={openConnectorInStudio}
    onAddToToolbox={addConnectorToToolbox}
    {toolboxConnectorIds}
    authorLabelById={feedAuthorLabels}
    authorAvatarUrlById={feedAuthorAvatarUrls}
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

  .candidate-name-link {
    @apply underline decoration-transparent underline-offset-2 transition;
    text-decoration-thickness: 1px;
  }

  .candidate-name-link:hover {
    @apply decoration-white/70;
  }

  .candidate-kind {
    @apply text-[0.62rem] uppercase tracking-[0.14em] text-white/45;
  }

  .candidate-actions {
    @apply flex items-center gap-2;
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
