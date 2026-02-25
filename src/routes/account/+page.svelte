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

  import { getMe, logout, updateUserById } from "$lib/auth/api";
  import { getToken } from "$lib/auth/session";
  import { mockCurrentUserId, mockUsersById } from "$lib/data/users";
  import type { ProfileViewUser } from "$lib/user/profileModel";
  import { normalizeProfileUser } from "$lib/user/profileModel";

  let currentUser = $state<ProfileViewUser | null>(null);
  let isLoading = $state(true);
  let error = $state("");
  let isRedirecting = $state(false);
  let isSaving = $state(false);
  let saveError = $state("");
  let saveSuccess = $state("");
  let localToolboxParticles = $state<string[]>([
    ...(mockUsersById[mockCurrentUserId]?.toolbox ?? []),
  ]);
  let accountFeedEvents = $state<ParticlePostEvent[]>([]);

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
    localToolboxParticles = [...localToolboxParticles, particleId];
    const currentUser = mockUsersById[mockCurrentUserId];
    if (currentUser && !currentUser.toolbox.includes(particleId)) {
      currentUser.toolbox = [...currentUser.toolbox, particleId];
    }
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

  onMount(loadProfile);
</script>

<div class="account-page">
  {#if isLoading}
    <SectionShell>
      <div class="status">
        <p class="status-title">Loading account...</p>
        <p class="status-subtitle">Fetching your latest profile details.</p>
      </div>
    </SectionShell>
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
          {isSaving}
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
