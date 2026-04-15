<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  import ParticlePostFeed from "$lib/components/feed/ParticlePostFeed.svelte";
  import {
    listNetworkFeedEventsByAuthor,
    syncParticlePostDataFromChain,
    type NetworkFeedEvent,
  } from "$lib/feed/particlePostData";
  import { networkNodeStudioKind } from "$lib/network/mockNetworkGraph";
  import Button from "$lib/components/ui/Button.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import UserProfilePage from "$lib/components/user/UserProfilePage.svelte";

  import {
    addConnectorToCurrentUserToolbox,
    getCachedMe,
    getMe,
    logout,
    updateUserById,
  } from "$lib/auth/api";
  import { getToken, hasAuthSession } from "$lib/auth/session";
  import { mockCurrentUserId, mockUsersById } from "$lib/data/users";
  import type { ProfileViewUser } from "$lib/user/profileModel";
  import { normalizeProfileUser } from "$lib/user/profileModel";

  const ACCOUNT_FEED_SYNC_MAX_SOURCES = 8;
  const ACCOUNT_FEED_SYNC_MAX_OWNED_PER_SOURCE = 8;

  let currentUser = $state<ProfileViewUser | null>(null);
  let isLoading = $state(true);
  let error = $state("");
  let isRedirecting = $state(false);
  let isSaving = $state(false);
  let isLinkingWallet = $state(false);
  let saveError = $state("");
  let saveSuccess = $state("");
  let localToolboxParticles = $state<string[]>([
    ...(mockUsersById[mockCurrentUserId]?.toolbox ?? []),
  ]);
  let accountFeedEvents = $state<NetworkFeedEvent[]>([]);

  type Eip1193Provider = {
    request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
    isMetaMask?: boolean;
  };

  type WindowWithEthereum = Window & {
    ethereum?: Eip1193Provider;
  };

  const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const applyResolvedProfile = (user: ProfileViewUser) => {
    currentUser = user;
    localToolboxParticles = [...user.toolbox];
    accountFeedEvents = listNetworkFeedEventsByAuthor(user.id);
  };

  const refreshAccountFeedInBackground = (activeUserId: string) => {
    void syncParticlePostDataFromChain({
      force: true,
      forceSources: true,
      maxSources: ACCOUNT_FEED_SYNC_MAX_SOURCES,
      maxOwnedPerSource: ACCOUNT_FEED_SYNC_MAX_OWNED_PER_SOURCE,
      includeRuntimeCode: false,
    })
      .then(() => {
        if (currentUser?.id !== activeUserId) return;
        accountFeedEvents = listNetworkFeedEventsByAuthor(activeUserId);
      })
      .catch((syncError) => {
        console.warn("[Account] Feed refresh failed.", syncError);
      });
  };

  const loadProfile = async () => {
    if (!hasAuthSession()) {
      isRedirecting = true;
      await goto(resolve("/login"));
      return;
    }

    isLoading = true;
    error = "";
    saveError = "";
    saveSuccess = "";

    if (!getToken()) {
      error =
        "Services profile is temporarily unavailable in chain-only prototype mode. Studio and Network remain available.";
      isLoading = false;
      return;
    }

    let hydratedFromCache = false;
    try {
      const cachedMe = getCachedMe();
      if (cachedMe) {
        try {
          const cachedUser = normalizeProfileUser(cachedMe);
          applyResolvedProfile(cachedUser);
          const activeUserId = cachedUser.id;
          refreshAccountFeedInBackground(activeUserId);
          hydratedFromCache = true;
          isLoading = false;
        } catch {
          // ignore invalid local cache
        }
      }

      const data = await getMe();
      const resolvedUser = normalizeProfileUser(data);
      applyResolvedProfile(resolvedUser);
      const activeUserId = resolvedUser.id;
      refreshAccountFeedInBackground(activeUserId);
    } catch (err) {
      if (!hydratedFromCache || !currentUser) {
        error = err instanceof Error ? err.message : "Unable to load account.";
      } else {
        console.warn("[Account] Failed to refresh profile from services API.", err);
      }
    } finally {
      isLoading = false;
    }
  };

  const handleLogout = () => {
    if (isRedirecting) return;
    isRedirecting = true;
    error = "";
    saveError = "";
    saveSuccess = "";
    void logout();
    void goto(resolve("/login"), { replaceState: true });
  };

  const toolboxParticleIds = $derived.by(() => new Set(localToolboxParticles));
  const openParticleInStudio = (particleId: string) => {
    const base = resolve("/studio");
    const target = new URL(base, window.location.origin);
    target.searchParams.set("network_kind", networkNodeStudioKind("feature"));
    target.searchParams.set("network_id", particleId);
    window.open(target.toString(), "_blank", "noopener,noreferrer");
  };

  const addParticleToToolbox = (particleId: string) => {
    if (toolboxParticleIds.has(particleId)) return;
    const previous = [...localToolboxParticles];
    localToolboxParticles = [...localToolboxParticles, particleId];
    const currentUser = mockUsersById[mockCurrentUserId];
    if (currentUser && !currentUser.toolbox.includes(particleId)) {
      currentUser.toolbox = [...currentUser.toolbox, particleId];
    }
    void addConnectorToCurrentUserToolbox(particleId).catch((err) => {
      console.error("[Account] Failed to persist toolbox update.", err);
      localToolboxParticles = previous;
    });
  };

  const handleSaveProfile = async ({ nickname, bio }: { nickname: string; bio: string }) => {
    if (!currentUser) return;

    isSaving = true;
    saveError = "";
    saveSuccess = "";

    try {
      const existingProfileJson = asRecord(currentUser.profileJson);
      const publicProfile = asRecord(existingProfileJson.public);
      const nextProfileJson = {
        ...existingProfileJson,
        public: {
          ...publicProfile,
          bio,
          avatar_url: currentUser.avatarUrl,
          kind: currentUser.kind,
        },
      };

      const payload = await updateUserById(currentUser.id, {
        display_name: nickname || null,
        profile_json: nextProfileJson,
      });

      currentUser = normalizeProfileUser(payload);
      saveSuccess = "Profile saved.";
    } catch (err) {
      saveError = err instanceof Error ? err.message : "Failed to save profile.";
    } finally {
      isSaving = false;
    }
  };

  const handleLinkMetamask = async () => {
    if (!currentUser) return;

    isLinkingWallet = true;
    saveError = "";
    saveSuccess = "";

    try {
      const provider = (window as WindowWithEthereum).ethereum;
      if (!provider) {
        throw new Error("MetaMask is not available in this browser.");
      }

      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const address =
        Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0].trim() : "";

      if (!address) {
        throw new Error("No Ethereum account was selected in MetaMask.");
      }

      const payload = await updateUserById(currentUser.id, { ethereum_address: address });
      currentUser = normalizeProfileUser(payload);
      saveSuccess = "Ethereum address linked.";
    } catch (err) {
      saveError = err instanceof Error ? err.message : "Failed to link MetaMask.";
    } finally {
      isLinkingWallet = false;
    }
  };

  onMount(loadProfile);
</script>

<div class="account-page">
  {#if isLoading}
    <div class="account-content loading-offset">
      <div class="profile-card-shell">
        <SectionShell>
          <div class="profile-skeleton" aria-hidden="true">
            <div class="profile-skeleton-head">
              <div class="profile-skeleton-avatar shimmer"></div>
              <div class="profile-skeleton-lines">
                <div class="profile-skeleton-line shimmer line-sm"></div>
                <div class="profile-skeleton-line shimmer line-xs"></div>
              </div>
            </div>
            <div class="profile-skeleton-field">
              <div class="profile-skeleton-label shimmer"></div>
              <div class="profile-skeleton-input shimmer"></div>
            </div>
            <div class="profile-skeleton-field">
              <div class="profile-skeleton-label shimmer"></div>
              <div class="profile-skeleton-input shimmer"></div>
            </div>
            <div class="profile-skeleton-field">
              <div class="profile-skeleton-label shimmer"></div>
              <div class="profile-skeleton-textarea shimmer"></div>
            </div>
            <div class="profile-skeleton-field">
              <div class="profile-skeleton-label shimmer"></div>
              <div class="profile-skeleton-input shimmer"></div>
            </div>
            <div class="profile-skeleton-actions">
              <div class="profile-skeleton-button shimmer"></div>
              <div class="profile-skeleton-button shimmer"></div>
              <div class="profile-skeleton-button shimmer"></div>
            </div>
          </div>
        </SectionShell>
      </div>
      <div class="profile-post-feed profile-card-shell">
        <ParticlePostFeed loading events={[]} {toolboxParticleIds} />
      </div>
    </div>
  {:else if error}
    <SectionShell>
      <div class="status">
        <p class="status-title">Unable to load account</p>
        <p class="status-subtitle">{error}</p>
      </div>

      <div class="actions">
        <Button variant="primary" type="button" onclick={loadProfile}>Retry</Button>
        <Button variant="ghost" type="button" onclick={handleLogout}>Go to login</Button>
      </div>
    </SectionShell>
  {:else if currentUser && !isRedirecting}
    <div class="account-content">
      <div class="profile-card-shell">
        <UserProfilePage
          user={currentUser}
          mode="self"
          onLogout={handleLogout}
          onSave={handleSaveProfile}
          onLinkWallet={handleLinkMetamask}
          {isSaving}
          {isLinkingWallet}
          {saveError}
          {saveSuccess}
        />
      </div>

      <div class="profile-post-feed profile-card-shell">
        <ParticlePostFeed
          events={accountFeedEvents}
          onParticleOpen={openParticleInStudio}
          onAddToToolbox={addParticleToToolbox}
          {toolboxParticleIds}
          emptyMessage="No activity by this user yet."
        />
      </div>
    </div>
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .account-page {
    @apply space-y-6;
  }

  .account-content {
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
    @apply text-base font-semibold text-white;
  }

  .status-subtitle {
    @apply text-sm text-white/60;
  }

  .actions {
    @apply flex flex-wrap gap-2;
  }

  .profile-skeleton {
    @apply grid gap-5;
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
    @apply rounded-full bg-white/10;
  }

  .profile-skeleton-line.line-sm {
    width: min(9rem, 55%);
    height: 0.8rem;
  }

  .profile-skeleton-line.line-xs {
    width: min(7rem, 45%);
    height: 0.55rem;
  }

  .profile-skeleton-field {
    @apply grid gap-2;
  }

  .profile-skeleton-label {
    @apply h-2 rounded-full bg-white/10;
    width: 7.5rem;
  }

  .profile-skeleton-input {
    @apply h-10 rounded-lg border border-white/10 bg-white/5;
  }

  .profile-skeleton-textarea {
    @apply rounded-lg border border-white/10 bg-white/5;
    min-height: 7.5rem;
  }

  .profile-skeleton-actions {
    @apply flex flex-wrap gap-2 pt-1;
  }

  .profile-skeleton-button {
    @apply h-9 w-28 rounded-lg border border-white/10 bg-white/5;
  }

  .shimmer {
    animation: profile-skeleton-pulse 1.4s ease-in-out infinite;
  }

  @keyframes profile-skeleton-pulse {
    0%,
    100% {
      opacity: 0.45;
    }
    50% {
      opacity: 0.9;
    }
  }

  @media (max-width: 1200px) {
    .account-content {
      --social-feed-card-width: min(68vw, 56rem);
    }
  }

  @media (max-width: 900px) {
    .account-content {
      --social-feed-card-width: 100%;
    }
  }
</style>
