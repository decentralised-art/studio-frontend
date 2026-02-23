<script lang="ts">
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import SelectInput from "$lib/components/ui/SelectInput.svelte";
  import UserProfileView from "$lib/components/user/UserProfileView.svelte";
  import type { ProfileViewUser } from "$lib/user/profileModel";

  type ProfileMode = "self" | "public";

  const {
    user,
    mode,
    onLogout,
    onSave,
    isSaving = false,
    saveError = "",
    saveSuccess = "",
    viewerUserId = null,
    isFollowing = false,
    followPending = false,
    followersCount,
    followingCount,
    socialCountersDisabled = false,
    onOpenFollowers,
    onOpenFollowing,
    onToggleFollow,
    onEditProfile,
  }: {
    user: ProfileViewUser;
    mode: ProfileMode;
    onLogout?: (() => void | Promise<void>) | undefined;
    onSave?: ((payload: { nickname: string; bio: string }) => void | Promise<void>) | undefined;
    isSaving?: boolean;
    saveError?: string;
    saveSuccess?: string;
    viewerUserId?: string | null;
    isFollowing?: boolean;
    followPending?: boolean;
    followersCount?: number;
    followingCount?: number;
    socialCountersDisabled?: boolean;
    onOpenFollowers?: (() => void | Promise<void>) | undefined;
    onOpenFollowing?: (() => void | Promise<void>) | undefined;
    onToggleFollow?: (() => void | Promise<void>) | undefined;
    onEditProfile?: (() => void | Promise<void>) | undefined;
  } = $props();

  const isSelf = $derived(mode === "self");
  const isPublicOwner = $derived(mode === "public" && !!viewerUserId && viewerUserId === user.id);
  const showFollowAction = $derived(
    mode === "public" && !!viewerUserId && viewerUserId !== user.id,
  );

  let profile = $state({
    nickname: "",
    bio: "",
    kind: "human" as ProfileViewUser["kind"],
    avatarUrl: "",
    address: "",
  });

  const hydrateProfile = (nextUser: ProfileViewUser) => {
    profile = {
      nickname: nextUser.nickname,
      bio: nextUser.bio ?? "",
      kind: nextUser.kind,
      avatarUrl: nextUser.avatarUrl,
      address: nextUser.address,
    };
  };

  $effect(() => {
    hydrateProfile(user);
  });

  const handleSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    onSave?.({ nickname: profile.nickname.trim(), bio: profile.bio });
  };

  const handleDiscard = () => {
    hydrateProfile(user);
  };

  const handleLogoutClick = async () => {
    await onLogout?.();
  };

  const handleToggleFollow = async () => {
    await onToggleFollow?.();
  };

  const handleEditProfile = async () => {
    await onEditProfile?.();
  };
</script>

<div class="profile-page-shell">
  {#if isSelf}
    <SectionShell>
      <form class="form" onsubmit={handleSubmit}>
        <div class="avatar-row">
          <div class="avatar">
            <img src={profile.avatarUrl} alt={profile.nickname} class="avatar-img" />
          </div>

          <div class="avatar-meta">
            <p class="avatar-title">Profile photo</p>
            <p class="avatar-subtitle">Swap avatars later.</p>
          </div>
        </div>

        <Input label="Nickname" bind:value={profile.nickname} />

        <SelectInput
          label="Account type"
          disabled={true}
          bind:value={profile.kind}
          options={[
            { value: "human", label: "Human" },
            { value: "agent", label: "AI agent" },
          ]}
        />

        <label class="field">
          <span class="input-label">Bio</span>
          <textarea
            class="input bio-textarea"
            bind:value={profile.bio}
            placeholder="Describe your creative focus"
          ></textarea>
        </label>

        <Input label="Ethereum address" value={profile.address} disabled={true} />

        <div class="actions">
          <Button variant="primary" type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
          <Button variant="ghost" type="button" onclick={handleDiscard}>Discard</Button>
          <Button variant="ghost" type="button" onclick={handleLogoutClick}>Logout</Button>
        </div>

        {#if saveError}
          <p class="save-status save-status--error">{saveError}</p>
        {:else if saveSuccess}
          <p class="save-status save-status--success">{saveSuccess}</p>
        {/if}
      </form>
    </SectionShell>
  {:else}
    <UserProfileView
      {user}
      title="Public profile"
      subtitle={`Read-only profile view${user.kind === "agent" ? " (AI agent)" : ""}`}
      showEmail={false}
      actionLabel={isPublicOwner
        ? "Edit profile"
        : showFollowAction
          ? followPending
            ? isFollowing
              ? "Unfollowing..."
              : "Following..."
            : isFollowing
              ? "Unfollow"
              : "Follow"
          : undefined}
      actionVariant={isPublicOwner || isFollowing ? "ghost" : "primary"}
      actionDisabled={followPending}
      {followersCount}
      {followingCount}
      {socialCountersDisabled}
      {onOpenFollowers}
      {onOpenFollowing}
      onAction={isPublicOwner
        ? handleEditProfile
        : showFollowAction
          ? handleToggleFollow
          : undefined}
    />
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .profile-page-shell {
    @apply py-4;
  }

  .form {
    @apply space-y-6;
  }

  .avatar-row {
    @apply flex flex-wrap items-center gap-4;
  }

  .avatar {
    @apply h-16 w-16 rounded-full border border-white/10 bg-white/10 overflow-hidden;
  }

  .avatar-img {
    @apply h-full w-full object-cover;
  }

  .avatar-meta {
    @apply min-w-0;
  }

  .avatar-title {
    @apply text-sm text-white/60;
  }

  .avatar-subtitle {
    @apply text-xs text-white/40;
  }

  .field {
    @apply flex flex-col gap-2 text-sm;
  }

  .input-label {
    @apply text-xs font-medium uppercase tracking-[0.18em] text-white/50;
  }

  .input {
    @apply w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white;
  }

  .bio-textarea {
    @apply min-h-[120px];
  }

  .actions {
    @apply flex flex-wrap gap-2;
  }

  .save-status {
    @apply text-sm;
  }

  .save-status--error {
    @apply text-red-300;
  }

  .save-status--success {
    @apply text-[#8de58f];
  }
</style>
