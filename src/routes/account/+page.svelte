<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  import Button from "$lib/components/ui/Button.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import UserProfilePage from "$lib/components/user/UserProfilePage.svelte";

  import { getMe, logout, updateUserById } from "$lib/auth/api";
  import { getToken } from "$lib/auth/session";
  import type { ProfileViewUser } from "$lib/user/profileModel";
  import { normalizeProfileUser } from "$lib/user/profileModel";

  let currentUser = $state<ProfileViewUser | null>(null);
  let isLoading = $state(true);
  let error = $state("");
  let isRedirecting = $state(false);
  let isSaving = $state(false);
  let saveError = $state("");
  let saveSuccess = $state("");

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
      const data = await getMe();
      currentUser = normalizeProfileUser(data);
    } catch (err) {
      error = err instanceof Error ? err.message : "Unable to load account.";
    } finally {
      isLoading = false;
    }
  };

  const handleLogout = async () => {
    await logout();
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
    <UserProfilePage
      user={currentUser}
      mode="self"
      onLogout={handleLogout}
      onSave={handleSaveProfile}
      {isSaving}
      {saveError}
      {saveSuccess}
    />
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

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
</style>
