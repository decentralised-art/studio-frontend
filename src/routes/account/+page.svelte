<script lang="ts">
  import { onMount } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import { resolve } from "$app/paths";

  import WalletAuthButton from "$lib/components/auth/WalletAuthButton.svelte";
  import ConnectorPostFeed from "$lib/components/feed/ConnectorPostFeed.svelte";
  import {
    listProfileActivityEvents,
    normalizeProfileActivitySourceAddresses,
    syncProfileActivityFromEventFeed,
  } from "$lib/feed/profileActivity";
  import type { NetworkFeedEvent } from "$lib/feed/particlePostData";
  import Button from "$lib/components/ui/Button.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import UserProfilePage from "$lib/components/user/UserProfilePage.svelte";

  import {
    addConnectorToCurrentUserToolbox,
    getCachedMe,
    getCurrentUserProfileState,
    logout,
    resolveCurrentUserChainSourceAddresses,
    updateUserById,
  } from "$lib/auth/api";
  import { getToken, hasAuthSession } from "$lib/auth/session";
  import type { ProfileViewUser } from "$lib/user/profileModel";
  import { normalizeProfileUser } from "$lib/user/profileModel";

  let currentUser = $state<ProfileViewUser | null>(null);
  let isLoading = $state(true);
  let isAuthenticated = $state(false);
  let error = $state("");
  let isSaving = $state(false);
  let saveError = $state("");
  let saveSuccess = $state("");
  let localToolboxConnectors = $state<string[]>([]);
  let accountFeedEvents = $state<NetworkFeedEvent[]>([]);
  let accountFeedSourceAddresses = $state<string[]>([]);
  let accountFeedLoading = $state(false);
  let accountFeedError = $state("");
  let accountLoadRequestVersion = 0;
  let accountFeedRequestVersion = 0;
  const ETH_ADDRESS_RE = /^0x[0-9a-f]{40}$/;

  const normalizeAddressForKey = (value: string): string => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return "";
    return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  };
  const normalizeChainAddress = (value: string): string => {
    const normalized = normalizeAddressForKey(value);
    return ETH_ADDRESS_RE.test(normalized) ? normalized : "";
  };
  const uniqueStrings = (values: string[]) =>
    Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

  const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const resolveAccountFeedSourceAddresses = (user: ProfileViewUser, mePayload: unknown): string[] =>
    uniqueStrings(
      [...resolveCurrentUserChainSourceAddresses(mePayload), user.address]
        .map(normalizeChainAddress)
        .filter(Boolean),
    );

  const applyResolvedProfile = (user: ProfileViewUser, sourceAddresses: string[]) => {
    const normalizedSources = normalizeProfileActivitySourceAddresses(sourceAddresses);
    currentUser = user;
    localToolboxConnectors = [...user.toolbox];
    accountFeedSourceAddresses = normalizedSources;
    accountFeedEvents = listProfileActivityEvents(normalizedSources);
  };

  const beginAccountLoadRequest = (): number => {
    accountLoadRequestVersion += 1;
    return accountLoadRequestVersion;
  };

  const isAccountLoadRequestActive = (requestVersion: number): boolean =>
    requestVersion === accountLoadRequestVersion;

  const beginAccountFeedRequest = (): number => {
    accountFeedRequestVersion += 1;
    return accountFeedRequestVersion;
  };

  const isAccountFeedRequestActive = (requestVersion: number): boolean =>
    requestVersion === accountFeedRequestVersion;

  const resetAccountState = () => {
    accountLoadRequestVersion += 1;
    accountFeedRequestVersion += 1;
    currentUser = null;
    error = "";
    saveError = "";
    saveSuccess = "";
    isSaving = false;
    isLoading = false;
    localToolboxConnectors = [];
    accountFeedEvents = [];
    accountFeedSourceAddresses = [];
    accountFeedLoading = false;
    accountFeedError = "";
  };

  const refreshAccountFeedFromEventFeed = async (
    activeUserId: string,
    sourceAddresses: string[],
    loadRequestVersion: number,
  ) => {
    if (!isAccountLoadRequestActive(loadRequestVersion)) return;
    const feedRequestVersion = beginAccountFeedRequest();
    const normalizedSources = normalizeProfileActivitySourceAddresses(sourceAddresses);
    const activeUser = currentUser;
    if (!activeUser || activeUser.id !== activeUserId) return;

    accountFeedSourceAddresses = normalizedSources;
    accountFeedEvents = listProfileActivityEvents(normalizedSources);
    accountFeedError = "";
    if (normalizedSources.length === 0) {
      accountFeedLoading = false;
      return;
    }
    accountFeedLoading = accountFeedEvents.length === 0;

    try {
      const events = await syncProfileActivityFromEventFeed({
        sourceAddresses: normalizedSources,
      });
      if (
        !isAccountLoadRequestActive(loadRequestVersion) ||
        !isAccountFeedRequestActive(feedRequestVersion)
      ) {
        return;
      }
      if (currentUser?.id !== activeUserId) return;
      accountFeedEvents = events;
    } catch (syncError) {
      if (
        !isAccountLoadRequestActive(loadRequestVersion) ||
        !isAccountFeedRequestActive(feedRequestVersion)
      ) {
        return;
      }
      console.warn("[Account] Event feed activity refresh failed.", syncError);
      accountFeedError =
        syncError instanceof Error ? syncError.message : "Unable to load account activity.";
    } finally {
      if (
        isAccountLoadRequestActive(loadRequestVersion) &&
        isAccountFeedRequestActive(feedRequestVersion)
      ) {
        accountFeedLoading = false;
      }
    }
  };

  const loadProfile = async () => {
    const requestVersion = beginAccountLoadRequest();
    isAuthenticated = hasAuthSession();

    isLoading = true;
    error = "";
    saveError = "";
    saveSuccess = "";

    if (!isAuthenticated || !getToken()) {
      resetAccountState();
      return;
    }

    let hydratedFromCache = false;
    try {
      const cachedMe = getCachedMe();
      if (cachedMe) {
        try {
          const cachedUser = normalizeProfileUser(cachedMe);
          const sourceAddresses = resolveAccountFeedSourceAddresses(cachedUser, cachedMe);
          applyResolvedProfile(cachedUser, sourceAddresses);
          const activeUserId = cachedUser.id;
          void refreshAccountFeedFromEventFeed(activeUserId, sourceAddresses, requestVersion);
          hydratedFromCache = true;
          isLoading = false;
        } catch {
          // ignore invalid local cache
        }
      }

      const profileState = await getCurrentUserProfileState();
      if (!isAccountLoadRequestActive(requestVersion)) return;
      if (!profileState.me) {
        throw new Error("Failed to load account profile.");
      }
      const resolvedUser = normalizeProfileUser(profileState.me);
      const sourceAddresses = resolveAccountFeedSourceAddresses(resolvedUser, profileState.me);
      applyResolvedProfile(resolvedUser, sourceAddresses);
      localToolboxConnectors = [...profileState.toolbox.connector];
      const activeUserId = resolvedUser.id;
      void refreshAccountFeedFromEventFeed(activeUserId, sourceAddresses, requestVersion);
    } catch (err) {
      if (!isAccountLoadRequestActive(requestVersion)) return;
      if (!hydratedFromCache || !currentUser) {
        error = err instanceof Error ? err.message : "Unable to load account.";
      } else {
        console.warn("[Account] Failed to refresh profile from services API.", err);
      }
    } finally {
      if (isAccountLoadRequestActive(requestVersion)) {
        isLoading = false;
      }
    }
  };

  const handleLogout = () => {
    error = "";
    saveError = "";
    saveSuccess = "";
    void logout();
    isAuthenticated = false;
    resetAccountState();
  };

  const toolboxConnectorIds = $derived.by(() => new SvelteSet(localToolboxConnectors));
  const accountFeedAuthorLabels = $derived.by(() => {
    const labels: Record<string, string> = {};
    if (!currentUser) return labels;
    const nickname = currentUser.nickname.trim();
    if (!nickname) return labels;
    labels[currentUser.id] = nickname;
    accountFeedSourceAddresses.forEach((address) => {
      const normalizedAddress = normalizeChainAddress(address);
      if (normalizedAddress) labels[normalizedAddress] = nickname;
    });
    return labels;
  });
  const accountFeedAuthorAvatars = $derived.by(() => {
    const avatars: Record<string, string> = {};
    if (!currentUser?.avatarUrl) return avatars;
    const avatarUrl = currentUser.avatarUrl;
    avatars[currentUser.id] = avatarUrl;
    accountFeedSourceAddresses.forEach((address) => {
      const normalizedAddress = normalizeChainAddress(address);
      if (normalizedAddress) avatars[normalizedAddress] = avatarUrl;
    });
    return avatars;
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
      console.error("[Account] Failed to persist toolbox update.", err);
      localToolboxConnectors = previous;
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
          nickname,
          bio,
          kind: currentUser.kind,
        },
      };

      const payload = await updateUserById(currentUser.id, {
        display_name: nickname || null,
        profile_json: nextProfileJson,
      });

      currentUser = normalizeProfileUser(payload);
      window.dispatchEvent(new CustomEvent("profile:change"));
      saveSuccess = "Profile saved.";
    } catch (err) {
      saveError = err instanceof Error ? err.message : "Failed to save profile.";
    } finally {
      isSaving = false;
    }
  };

  onMount(() => {
    const handleAuthChange = () => {
      isAuthenticated = hasAuthSession();
      if (isAuthenticated) {
        void loadProfile();
      } else {
        resetAccountState();
      }
    };

    handleAuthChange();
    window.addEventListener("auth:change", handleAuthChange);
    window.addEventListener("storage", handleAuthChange);
    return () => {
      accountLoadRequestVersion += 1;
      accountFeedRequestVersion += 1;
      window.removeEventListener("auth:change", handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
    };
  });
</script>

<div class="account-page">
  {#if !isAuthenticated}
    <SectionShell>
      <div class="status">
        <p class="status-title">Login with MetaMask to open your account.</p>
        <p class="status-subtitle">
          Your profile, toolbox, follows, and account activity are loaded after wallet login.
        </p>
      </div>

      <div class="actions">
        <WalletAuthButton showLogout={false} />
      </div>
    </SectionShell>
  {:else if isLoading}
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
        <ConnectorPostFeed loading events={[]} {toolboxConnectorIds} />
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
        <Button variant="ghost" type="button" onclick={handleLogout}>Sign out</Button>
      </div>
    </SectionShell>
  {:else if currentUser}
    <div class="account-content">
      <div class="profile-card-shell">
        <UserProfilePage
          user={currentUser}
          mode="self"
          onLogout={handleLogout}
          onSave={handleSaveProfile}
          {isSaving}
          {saveError}
          {saveSuccess}
        />
      </div>

      <div class="profile-post-feed profile-card-shell">
        <ConnectorPostFeed
          loading={accountFeedLoading}
          events={accountFeedEvents}
          onConnectorOpen={openConnectorInStudio}
          onAddToToolbox={addConnectorToToolbox}
          {toolboxConnectorIds}
          authorLabelById={accountFeedAuthorLabels}
          authorAvatarUrlById={accountFeedAuthorAvatars}
          emptyMessage={accountFeedError || "No activity by this user yet."}
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
