<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  import ParticlePostFeed from "$lib/components/feed/ParticlePostFeed.svelte";
  import {
    listParticlePostsByAuthor,
    syncParticlePostDataFromChain,
    type ParticlePostEvent,
  } from "$lib/feed/particlePostData";
  import { networkNodeStudioKind } from "$lib/network/mockNetworkGraph";
  import Button from "$lib/components/ui/Button.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import UserProfilePage from "$lib/components/user/UserProfilePage.svelte";

  import { addParticleToCurrentUserToolbox, getMe, logout, updateUserById } from "$lib/auth/api";
  import { getToken } from "$lib/auth/session";
  import { mockCurrentUserId, mockUsersById } from "$lib/data/users";
  import type { ProfileViewUser } from "$lib/user/profileModel";
  import { normalizeProfileUser } from "$lib/user/profileModel";

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
  let accountFeedEvents = $state<ParticlePostEvent[]>([]);

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

  const loadProfile = async () => {
    if (!getToken()) {
      isRedirecting = true;
      await goto(resolve("/login"));
      return;
    }

    isLoading = true;
    error = "";
    saveError = "";
    saveSuccess = "";

    try {
      const [data] = await Promise.all([
        getMe(),
        syncParticlePostDataFromChain().catch(() => null),
      ]);
      currentUser = normalizeProfileUser(data);
      localToolboxParticles = [...currentUser.toolbox];
      accountFeedEvents = listParticlePostsByAuthor(currentUser.id);
    } catch (err) {
      error = err instanceof Error ? err.message : "Unable to load account.";
    } finally {
      isLoading = false;
    }
  };

  const handleLogout = async () => {
    await logout();
  };

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
    const previous = [...localToolboxParticles];
    localToolboxParticles = [...localToolboxParticles, particleId];
    const currentUser = mockUsersById[mockCurrentUserId];
    if (currentUser && !currentUser.toolbox.includes(particleId)) {
      currentUser.toolbox = [...currentUser.toolbox, particleId];
    }
    void addParticleToCurrentUserToolbox(particleId).catch((err) => {
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
          emptyMessage="No particle posts by this user yet."
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
    width: var(--social-feed-card-width);
    max-width: 100%;
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
