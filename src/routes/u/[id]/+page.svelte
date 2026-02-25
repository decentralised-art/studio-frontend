<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/stores";

  import ParticlePostFeed from "$lib/components/feed/ParticlePostFeed.svelte";
  import {
    listParticlePostsByAuthor,
    syncParticlePostDataFromChain,
    type ParticlePostEvent,
  } from "$lib/feed/particlePostData";
  import { networkNodeStudioKind } from "$lib/network/mockNetworkGraph";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import UserProfilePage from "$lib/components/user/UserProfilePage.svelte";
  import {
    followUserById,
    getFollowersIds,
    getFollowingIds,
    getMe,
    getUserById,
    unfollowUserById,
  } from "$lib/auth/api";
  import { getToken } from "$lib/auth/session";
  import { mockCurrentUserId, mockFollowingByUserId, mockUsersById } from "$lib/data/users";
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
  let localToolboxParticles = $state<string[]>([
    ...(mockUsersById[mockCurrentUserId]?.toolbox ?? []),
  ]);
  let userFeedEvents = $state<ParticlePostEvent[]>([]);

  const loadUser = async () => {
    const userId = $page.params.id?.trim() ?? "";
    if (!userId) {
      error = "Missing user ID.";
      isLoading = false;
      return;
    }

    isLoading = true;
    error = "";
    actionError = "";

    try {
      const [userPayload, mePayload] = await Promise.all([
        getUserById(userId),
        getToken()
          ? getMe()
              .then((payload) => normalizeProfileUser(payload))
              .catch(() => null)
          : Promise.resolve(null),
        syncParticlePostDataFromChain().catch(() => null),
      ]);

      user = normalizeProfileUser(userPayload);
      userFeedEvents = listParticlePostsByAuthor(user.id);
      viewerUserId = mePayload?.id ?? null;
      socialListsUnavailable = false;

      if (!getToken()) {
        viewerFollowingIds = [];
        displayedFollowingIds = [];
        displayedFollowerIds = [];
      } else if (viewerUserId && user.id === viewerUserId) {
        const [followers, following] = await Promise.all([
          getFollowersIds().catch(() => [] as string[]),
          getFollowingIds().catch(() => [] as string[]),
        ]);
        viewerFollowingIds = following;
        displayedFollowerIds = followers;
        displayedFollowingIds = following;
      } else if (mockUsersById[user.id]) {
        const targetId = user.id;
        const targetFollowing = [...(mockFollowingByUserId[targetId] ?? [])];
        const followers = Object.entries(mockFollowingByUserId)
          .filter(([, ids]) => (ids ?? []).includes(targetId))
          .map(([id]) => id);
        viewerFollowingIds = viewerUserId ? [...(mockFollowingByUserId[viewerUserId] ?? [])] : [];
        displayedFollowingIds = targetFollowing;
        displayedFollowerIds = followers;
      } else {
        viewerFollowingIds = [];
        displayedFollowingIds = [];
        displayedFollowerIds = [];
        socialListsUnavailable = true;
      }
    } catch (err) {
      user = null;
      error = err instanceof Error ? err.message : "Unable to load user profile.";
    } finally {
      isLoading = false;
    }
  };

  const handleToggleFollow = async () => {
    if (!user || !viewerUserId || viewerUserId === user.id || followPending) return;
    followPending = true;

    try {
      const isFollowing = viewerFollowingIds.includes(user.id);
      if (isFollowing) {
        await unfollowUserById(user.id);
        viewerFollowingIds = viewerFollowingIds.filter((id) => id !== user.id);
        displayedFollowerIds = displayedFollowerIds.filter((id) => id !== viewerUserId);
      } else {
        await followUserById(user.id);
        viewerFollowingIds = [...viewerFollowingIds, user.id];
        if (viewerUserId && !displayedFollowerIds.includes(viewerUserId)) {
          displayedFollowerIds = [...displayedFollowerIds, viewerUserId];
        }
      }

      if (viewerUserId === user.id) {
        displayedFollowerIds = await getFollowersIds().catch(() => displayedFollowerIds);
      }
    } catch (err) {
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
  const toolboxParticleIds = $derived.by(() => new Set(localToolboxParticles));
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

  onMount(loadUser);
</script>

<div class="user-page">
  {#if isLoading}
    <SectionShell>
      <div class="status">
        <p class="status-title">Loading profile...</p>
        <p class="status-subtitle">Fetching public user details.</p>
      </div>
    </SectionShell>
  {:else if error}
    <SectionShell>
      <div class="status">
        <p class="status-title">Unable to load profile</p>
        <p class="status-subtitle">{error}</p>
      </div>

      <div class="actions">
        <Button variant="primary" type="button" onclick={loadUser}>Retry</Button>
      </div>
    </SectionShell>
  {:else if user}
    <div class="public-profile-stack">
      <div class="profile-card-shell">
        <UserProfilePage
          {user}
          mode="public"
          {viewerUserId}
          isFollowing={viewerFollowingIds.includes(user.id)}
          {followPending}
          followersCount={displayedFollowerIds.length}
          followingCount={displayedFollowingIds.length}
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
        <ParticlePostFeed
          events={userFeedEvents}
          onParticleOpen={openParticleInStudio}
          onAddToToolbox={addParticleToToolbox}
          {toolboxParticleIds}
          emptyMessage="No particle posts by this user yet."
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
                    <img
                      class="social-list-avatar"
                      src={mockUsersById[id]?.avatarUrl ?? mockUsersById[user.id]?.avatarUrl ?? ""}
                      alt=""
                    />
                    <div class="social-list-meta">
                      <p class="social-list-name">{mockUsersById[id]?.nickname ?? id}</p>
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

  .profile-card-shell {
    @apply mx-auto;
    width: var(--social-feed-card-width);
    max-width: 100%;
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

  .social-list-meta {
    @apply min-w-0;
  }

  .social-list-name {
    @apply text-sm font-medium text-white;
  }

  .social-list-id {
    @apply text-xs text-white/45 truncate;
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
