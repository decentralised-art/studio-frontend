<script lang="ts">
  import { onMount } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/stores";

  import ConnectorPostFeed from "$lib/components/feed/ConnectorPostFeed.svelte";
  import { listNetworkFeedEventsByAuthor, type NetworkFeedEvent } from "$lib/feed/particlePostData";
  import { mapSnapshotParticlesToConnectorEvents } from "$lib/feed/networkEventMappers";
  import { fetchChainOwnedStudioSnapshot } from "$lib/studio/chainStudioAdapter";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import UserProfilePage from "$lib/components/user/UserProfilePage.svelte";
  import {
    addConnectorToCurrentUserToolbox,
    followUserInProfile,
    getCurrentUserProfileState,
    getUserSocialConnections,
    getUserById,
    listServicesUsers,
    unfollowUserInProfile,
  } from "$lib/auth/api";
  import { getToken, hasAuthSession } from "$lib/auth/session";
  import { buildAuthorLabelMapFromServicesUsers } from "$lib/social/authorLabels";
  import type { ProfileViewUser } from "$lib/user/profileModel";
  import { normalizeProfileUser } from "$lib/user/profileModel";

  let user = $state<ProfileViewUser | null>(null);
  let isLoading = $state(true);
  let error = $state("");
  let actionError = $state("");
  let viewerUserId = $state<string | null>(null);
  let viewerFollowingIds = $state<string[]>([]);
  let displayedFollowingIds = $state<string[]>([]);
  let displayedFollowerIds = $state<string[]>([]);
  let followPending = $state(false);
  let activeSocialList = $state<"followers" | "following" | null>(null);
  let socialListsUnavailable = $state(false);
  let localToolboxConnectors = $state<string[]>([]);
  let userFeedEvents = $state<NetworkFeedEvent[]>([]);
  let servicesUserLabels = $state<Record<string, string>>({});
  let userLoadRequestVersion = 0;

  const normalizeAddressForKey = (value: string): string => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return "";
    return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  };

  const isChainAddress = (value: string): boolean =>
    /^0x[0-9a-f]{40}$/i.test(normalizeAddressForKey(value));

  const shortAddress = (value: string): string => {
    const normalized = normalizeAddressForKey(value);
    if (!normalized) return "";
    if (normalized.length < 14) return normalized;
    return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
  };

  const resolvedUserFollowKey = $derived.by(() =>
    user ? normalizeAddressForKey(user.address) || user.id : "",
  );

  const refreshFollowState = async (targetUserAddressOrId: string) => {
    const profileState = await getCurrentUserProfileState({ preferCached: true });
    viewerFollowingIds = [...profileState.social.followedUserAddresses];
    const targetSocial = await getUserSocialConnections(targetUserAddressOrId);
    displayedFollowingIds = [...targetSocial.followingIds];
    displayedFollowerIds = [...targetSocial.followerIds];
    socialListsUnavailable = targetSocial.status !== "ok";
  };

  const beginUserLoadRequest = (): number => {
    userLoadRequestVersion += 1;
    return userLoadRequestVersion;
  };

  const isUserLoadRequestActive = (requestVersion: number): boolean =>
    requestVersion === userLoadRequestVersion;

  const loadUser = async (routeUserId: string) => {
    const requestVersion = beginUserLoadRequest();
    const userId = routeUserId.trim();
    if (!userId) {
      error = "Missing user ID.";
      isLoading = false;
      return;
    }

    isLoading = true;
    error = "";
    actionError = "";
    activeSocialList = null;
    displayedFollowingIds = [];
    displayedFollowerIds = [];
    socialListsUnavailable = false;

    try {
      const servicesTokenPresent = Boolean(getToken());
      const normalizedRequestedAddress = normalizeAddressForKey(userId);
      const isAddressRoute = isChainAddress(normalizedRequestedAddress);
      const profileStatePromise = servicesTokenPresent
        ? getCurrentUserProfileState({ preferCached: true }).catch(() => null)
        : Promise.resolve(null);
      const userPayload = await (isAddressRoute
        ? Promise.resolve({
            user: {
              id: normalizedRequestedAddress,
              display_name: shortAddress(normalizedRequestedAddress),
              ethereum_address: normalizedRequestedAddress,
              bio: "",
            },
          })
        : getUserById(userId));
      if (!isUserLoadRequestActive(requestVersion)) return;

      user = normalizeProfileUser(userPayload);
      const activeUserId = user.id;
      const feedAuthorKey = normalizeAddressForKey(user.address) || user.id;
      userFeedEvents = listNetworkFeedEventsByAuthor(feedAuthorKey);
      viewerUserId = hasAuthSession() ? "viewer" : null;
      viewerFollowingIds = [];
      localToolboxConnectors = [];

      if (isChainAddress(feedAuthorKey)) {
        void fetchChainOwnedStudioSnapshot(feedAuthorKey, {
          authorId: feedAuthorKey,
          limit: 200,
          includeRuntimeCode: false,
        })
          .then((snapshot) => {
            if (!isUserLoadRequestActive(requestVersion)) return;
            if (user?.id !== activeUserId) return;
            const targetedEvents = mapSnapshotParticlesToConnectorEvents(
              feedAuthorKey,
              snapshot.particles,
            );
            if (targetedEvents.length > 0) {
              userFeedEvents = targetedEvents;
            }
          })
          .catch((targetedError) => {
            if (!isUserLoadRequestActive(requestVersion)) return;
            console.warn("[User page] Targeted chain account fetch failed.", targetedError);
          });
      }

      isLoading = false;

      void profileStatePromise.then((profileState) => {
        if (!isUserLoadRequestActive(requestVersion)) return;
        const viewerAddressFromProfile =
          profileState?.me && typeof profileState.me === "object"
            ? normalizeAddressForKey(normalizeProfileUser(profileState.me).address)
            : "";
        viewerUserId =
          viewerAddressFromProfile || profileState?.userId || (hasAuthSession() ? "viewer" : null);
        viewerFollowingIds = [...(profileState?.social.followedUserAddresses ?? [])];
        localToolboxConnectors = [...(profileState?.toolbox.connector ?? [])];
      });

      const socialTarget = normalizeAddressForKey(user.address) || user.id;
      void getUserSocialConnections(socialTarget)
        .then((targetSocial) => {
          if (!isUserLoadRequestActive(requestVersion)) return;
          displayedFollowingIds = [...targetSocial.followingIds];
          displayedFollowerIds = [...targetSocial.followerIds];
          socialListsUnavailable = targetSocial.status !== "ok";
        })
        .catch((socialError) => {
          if (!isUserLoadRequestActive(requestVersion)) return;
          console.warn("[User page] Failed to load social follow graph.", socialError);
          displayedFollowingIds = [];
          displayedFollowerIds = [];
          socialListsUnavailable = true;
        });
    } catch (err) {
      if (!isUserLoadRequestActive(requestVersion)) return;
      user = null;
      error = err instanceof Error ? err.message : "Unable to load user profile.";
      isLoading = false;
    }
  };

  const handleToggleFollow = async () => {
    if (!user || !viewerUserId || followPending) return;
    const targetAddress = normalizeAddressForKey(user.address);
    if (!targetAddress) return;
    followPending = true;

    const wasFollowing = viewerFollowingIds.includes(targetAddress);
    const previousFollowing = [...viewerFollowingIds];
    viewerFollowingIds = wasFollowing
      ? viewerFollowingIds.filter((entry) => entry !== targetAddress)
      : [...viewerFollowingIds, targetAddress];

    try {
      if (wasFollowing) {
        await unfollowUserInProfile(targetAddress);
      } else {
        await followUserInProfile(targetAddress);
      }
      // Refresh social counters in background to avoid blocking follow/unfollow button state.
      void refreshFollowState(targetAddress).catch((err) => {
        console.warn("[User page] Failed to refresh follow graph after toggle.", err);
      });
    } catch (err) {
      viewerFollowingIds = previousFollowing;
      actionError = err instanceof Error ? err.message : "Failed to update follow state.";
    } finally {
      followPending = false;
    }
  };

  const handleEditProfile = async () => {
    await goto(resolve("/account"));
  };

  const openFollowersList = () => {
    if (socialListsUnavailable) {
      actionError = "Followers/following lists are not available for this profile yet.";
      return;
    }
    activeSocialList = "followers";
  };

  const openFollowingList = () => {
    if (socialListsUnavailable) {
      actionError = "Followers/following lists are not available for this profile yet.";
      return;
    }
    activeSocialList = "following";
  };

  const closeSocialList = () => {
    activeSocialList = null;
  };

  const visibleSocialIds = $derived(
    activeSocialList === "followers"
      ? displayedFollowerIds
      : activeSocialList === "following"
        ? displayedFollowingIds
        : [],
  );

  const visibleSocialTitle = $derived(
    activeSocialList === "followers"
      ? "Followers"
      : activeSocialList === "following"
        ? "Following"
        : "",
  );
  const toolboxConnectorIds = $derived.by(() => new SvelteSet(localToolboxConnectors));
  const userFeedAuthorLabels = $derived.by(() => {
    const labels: Record<string, string> = { ...servicesUserLabels };
    if (!user) return labels;
    const nickname = user.nickname.trim();
    if (!nickname) return labels;
    labels[user.id] = nickname;
    const normalizedAddress = normalizeAddressForKey(user.address);
    if (normalizedAddress) {
      labels[normalizedAddress] = nickname;
    }
    return labels;
  });
  const openConnectorInStudio = (connectorId: string) => {
    const base = resolve("/studio");
    const target = new URL(base, window.location.origin);
    target.searchParams.set("network_kind", "connector");
    target.searchParams.set("network_id", connectorId);
    window.open(target.toString(), "_blank", "noopener,noreferrer");
  };

  const addConnectorToToolbox = (connectorId: string) => {
    if (toolboxConnectorIds.has(connectorId)) return;
    const previous = [...localToolboxConnectors];
    localToolboxConnectors = [...localToolboxConnectors, connectorId];
    void addConnectorToCurrentUserToolbox(connectorId).catch((err) => {
      console.error("[User page] Failed to persist toolbox update.", err);
      localToolboxConnectors = previous;
    });
  };

  $effect(() => {
    const routeUserId = ($page.params.id ?? "").trim();
    void loadUser(routeUserId);
  });

  onMount(() => {
    void listServicesUsers()
      .then((users) => {
        servicesUserLabels = buildAuthorLabelMapFromServicesUsers(users);
      })
      .catch((error) => {
        console.warn("[User page] Failed to load services user labels.", error);
      });
    return () => {
      userLoadRequestVersion += 1;
    };
  });
</script>

<div class="user-page">
  {#if isLoading}
    <div class="public-profile-stack loading-offset">
      <div class="profile-card-shell">
        <SectionShell>
          <div class="profile-skeleton" aria-hidden="true">
            <div class="profile-skeleton-head">
              <div class="profile-skeleton-avatar shimmer"></div>
              <div class="profile-skeleton-lines">
                <div class="profile-skeleton-line shimmer line-lg"></div>
                <div class="profile-skeleton-line shimmer line-sm"></div>
              </div>
            </div>
            <div class="profile-skeleton-action-row">
              <div class="profile-skeleton-chip shimmer"></div>
              <div class="profile-skeleton-chip shimmer chip-sm"></div>
              <div class="profile-skeleton-chip shimmer chip-sm"></div>
            </div>
            <div class="profile-skeleton-field">
              <div class="profile-skeleton-label shimmer"></div>
              <div class="profile-skeleton-line shimmer line-full"></div>
            </div>
            <div class="profile-skeleton-field">
              <div class="profile-skeleton-label shimmer"></div>
              <div class="profile-skeleton-line shimmer line-full"></div>
            </div>
            <div class="profile-skeleton-field">
              <div class="profile-skeleton-label shimmer"></div>
              <div class="profile-skeleton-textarea shimmer"></div>
            </div>
            <div class="profile-skeleton-line shimmer line-full"></div>
          </div>
        </SectionShell>
      </div>
      <div class="profile-card-shell">
        <ConnectorPostFeed loading events={[]} {toolboxConnectorIds} />
      </div>
    </div>
  {:else if error}
    <SectionShell>
      <div class="status">
        <p class="status-title">Unable to load profile</p>
        <p class="status-subtitle">{error}</p>
      </div>

      <div class="actions">
        <Button
          variant="primary"
          type="button"
          onclick={() => void loadUser(($page.params.id ?? "").trim())}
        >
          Retry
        </Button>
      </div>
    </SectionShell>
  {:else if user}
    <div class="public-profile-stack">
      <div class="profile-card-shell">
        <UserProfilePage
          {user}
          mode="public"
          {viewerUserId}
          isFollowing={Boolean(
            resolvedUserFollowKey && viewerFollowingIds.includes(resolvedUserFollowKey),
          )}
          {followPending}
          followersCount={socialListsUnavailable ? undefined : displayedFollowerIds.length}
          followingCount={socialListsUnavailable ? undefined : displayedFollowingIds.length}
          socialCountersDisabled={socialListsUnavailable}
          onOpenFollowers={openFollowersList}
          onOpenFollowing={openFollowingList}
          onToggleFollow={handleToggleFollow}
          onEditProfile={handleEditProfile}
        />
      </div>

      {#if actionError}
        <SectionShell className="profile-card-shell">
          <p class="action-error">{actionError}</p>
        </SectionShell>
      {/if}

      <div class="profile-post-feed profile-card-shell">
        <ConnectorPostFeed
          events={userFeedEvents}
          onConnectorOpen={openConnectorInStudio}
          onAddToToolbox={addConnectorToToolbox}
          {toolboxConnectorIds}
          authorLabelById={userFeedAuthorLabels}
          emptyMessage="No activity by this user yet."
        />
      </div>

      {#if activeSocialList}
        <div class="social-list-overlay" role="presentation">
          <button
            type="button"
            class="social-list-backdrop"
            aria-label="Close list"
            onclick={closeSocialList}
          ></button>
          <div
            class="social-list-modal"
            role="dialog"
            aria-modal="true"
            aria-label={visibleSocialTitle}
          >
            <div class="social-list-head">
              <div>
                <p class="social-list-title">{visibleSocialTitle}</p>
                <p class="social-list-subtitle">{visibleSocialIds.length} users</p>
              </div>
              <button type="button" class="social-list-close" onclick={closeSocialList}>×</button>
            </div>

            <div class="social-list-body">
              {#if visibleSocialIds.length === 0}
                <p class="social-list-empty">No users yet.</p>
              {:else}
                {#each visibleSocialIds as id (id)}
                  <a
                    class="social-list-row"
                    href={resolve("/u/[id]", { id })}
                    onclick={closeSocialList}
                  >
                    <div class="social-list-avatar social-list-avatar--fallback" aria-hidden="true">
                      U
                    </div>
                    <div class="social-list-meta">
                      <p class="social-list-name">
                        {servicesUserLabels[normalizeAddressForKey(id)] ?? id}
                      </p>
                      <p class="social-list-id">{id}</p>
                    </div>
                  </a>
                {/each}
              {/if}
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .user-page {
    @apply space-y-6;
  }

  .public-profile-stack {
    @apply space-y-4;
    --social-feed-card-width: min(50vw, 56rem);
  }

  .loading-offset {
    @apply pt-3 md:pt-4;
  }

  .profile-card-shell {
    @apply mx-auto;
    inline-size: min(var(--social-feed-card-width), 100%);
  }

  .profile-post-feed {
    @apply mx-auto;
    inline-size: min(var(--social-feed-card-width), 100%);
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

  .actions {
    @apply mt-4 flex flex-wrap gap-3;
  }

  .action-error {
    @apply text-sm text-red-300;
  }

  .social-list-overlay {
    @apply fixed inset-0 z-40 bg-black/55 backdrop-blur-sm p-4;
    display: grid;
    place-items: center;
  }

  .social-list-backdrop {
    @apply absolute inset-0 cursor-default;
  }

  .social-list-modal {
    @apply relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#050b15]/95 p-4 shadow-2xl;
    max-height: min(70vh, 38rem);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 0.75rem;
  }

  .social-list-head {
    @apply flex items-start justify-between gap-3;
  }

  .social-list-title {
    @apply text-base font-semibold text-white;
  }

  .social-list-subtitle {
    @apply text-xs text-white/50;
  }

  .social-list-close {
    @apply h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-white/80 hover:bg-white/10;
  }

  .social-list-body {
    @apply min-h-0 overflow-y-auto grid gap-2 pr-1;
    align-content: start;
  }

  .social-list-empty {
    @apply text-sm text-white/60;
  }

  .social-list-row {
    @apply flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 no-underline
      hover:bg-white/10 transition;
  }

  .social-list-avatar {
    @apply h-9 w-9 rounded-lg border border-white/10 bg-white/5 object-cover shrink-0;
  }

  .social-list-avatar--fallback {
    @apply flex items-center justify-center text-white/65 text-xs font-semibold;
  }

  .social-list-meta {
    @apply min-w-0;
  }

  .social-list-name {
    @apply text-sm font-medium text-white;
  }

  .social-list-id {
    @apply text-xs text-white/45 truncate;
  }

  .profile-skeleton {
    @apply grid gap-4;
  }

  .profile-skeleton-head {
    @apply flex items-center gap-4;
  }

  .profile-skeleton-avatar {
    @apply h-16 w-16 rounded-full border border-white/10 bg-white/5 shrink-0;
  }

  .profile-skeleton-lines {
    @apply flex-1 grid gap-2 min-w-0;
  }

  .profile-skeleton-line {
    @apply h-3 rounded-full bg-white/10;
  }

  .profile-skeleton-line.line-lg {
    width: min(54%, 15rem);
  }

  .profile-skeleton-line.line-sm {
    width: 7.5rem;
    height: 0.7rem;
  }

  .profile-skeleton-line.line-full {
    width: min(100%, 36rem);
  }

  .profile-skeleton-field {
    @apply grid gap-2;
  }

  .profile-skeleton-label {
    @apply h-2 rounded-full bg-white/10;
    width: 7rem;
  }

  .profile-skeleton-textarea {
    @apply rounded-lg border border-white/10 bg-white/5;
    min-height: 5.5rem;
  }

  .profile-skeleton-action-row {
    @apply flex flex-wrap gap-2;
  }

  .profile-skeleton-chip {
    @apply h-8 w-24 rounded-lg border border-white/10 bg-white/5 shrink-0;
  }

  .profile-skeleton-chip.chip-sm {
    @apply w-20;
  }

  .shimmer {
    animation: user-profile-skeleton-pulse 1.4s ease-in-out infinite;
  }

  @keyframes user-profile-skeleton-pulse {
    0%,
    100% {
      opacity: 0.45;
    }
    50% {
      opacity: 0.9;
    }
  }

  @media (max-width: 1200px) {
    .public-profile-stack {
      --social-feed-card-width: min(68vw, 56rem);
    }
  }

  @media (max-width: 900px) {
    .public-profile-stack {
      --social-feed-card-width: 100%;
    }
  }
</style>
