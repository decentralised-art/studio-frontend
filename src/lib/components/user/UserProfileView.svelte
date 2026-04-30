<script lang="ts">
  import Input from "$lib/components/ui/Input.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import SelectInput from "$lib/components/ui/SelectInput.svelte";
  import { getUserAvatarInitials } from "$lib/user/avatarInitials";
  import type { ProfileViewUser } from "$lib/user/profileModel";

  const {
    user,
    title = "Profile",
    subtitle = "Public profile view",
    showEmail = false,
    actionLabel,
    actionVariant = "ghost",
    actionDisabled = false,
    onAction,
    followersCount,
    followingCount,
    socialCountersDisabled = false,
    onOpenFollowers,
    onOpenFollowing,
  }: {
    user: ProfileViewUser;
    title?: string;
    subtitle?: string;
    showEmail?: boolean;
    actionLabel?: string;
    actionVariant?: "primary" | "ghost";
    actionDisabled?: boolean;
    onAction?: (() => void | Promise<void>) | undefined;
    followersCount?: number;
    followingCount?: number;
    socialCountersDisabled?: boolean;
    onOpenFollowers?: (() => void | Promise<void>) | undefined;
    onOpenFollowing?: (() => void | Promise<void>) | undefined;
  } = $props();

  const handleAction = async () => {
    await onAction?.();
  };
  const handleOpenFollowers = async () => {
    await onOpenFollowers?.();
  };
  const handleOpenFollowing = async () => {
    await onOpenFollowing?.();
  };
</script>

<SectionShell>
  <div class="profile-main">
    <div class="avatar-row">
      <div class="avatar">
        {#if user.avatarUrl}
          <img src={user.avatarUrl} alt={user.nickname} class="avatar-img" />
        {:else}
          <span class="avatar-fallback" aria-hidden="true">
            {getUserAvatarInitials(user.nickname)}
          </span>
        {/if}
      </div>

      <div class="avatar-meta">
        <p class="avatar-title">{title}</p>
        <p class="avatar-subtitle">{subtitle}</p>
      </div>

      <div class="header-controls">
        {#if actionLabel}
          <button
            type="button"
            class={`header-action header-action--${actionVariant}`}
            onclick={handleAction}
            disabled={actionDisabled}
          >
            {actionLabel}
          </button>
        {/if}

        {#if followersCount !== undefined && followingCount !== undefined}
          <button
            type="button"
            class="social-count-pill"
            onclick={handleOpenFollowers}
            disabled={socialCountersDisabled}
          >
            <span class="social-count-label">Followers</span>
            <span class="social-count-value">{followersCount}</span>
          </button>
          <button
            type="button"
            class="social-count-pill"
            onclick={handleOpenFollowing}
            disabled={socialCountersDisabled}
          >
            <span class="social-count-label">Following</span>
            <span class="social-count-value">{followingCount}</span>
          </button>
        {/if}
      </div>
    </div>

    <Input label="Nickname" value={user.nickname} disabled={true} />

    <SelectInput
      label="Account type"
      disabled={true}
      value={user.kind}
      options={[
        { value: "human", label: "Human" },
        { value: "agent", label: "AI agent" },
      ]}
    />

    <label class="field">
      <span class="input-label">Bio</span>
      <textarea class="input bio-textarea" value={user.bio ?? ""} disabled></textarea>
    </label>

    <Input label="Ethereum address" value={user.address} disabled={true} />

    {#if showEmail}
      <Input label="Email" value={user.email} disabled={true} />
    {/if}
  </div>
</SectionShell>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .profile-main {
    @apply space-y-6;
  }

  .avatar-row {
    @apply flex flex-wrap items-center gap-4 justify-between;
  }

  .avatar {
    @apply h-16 w-16 overflow-hidden rounded-full border;
    background: var(--surface-panel-soft);
    border-color: var(--border-subtle);
  }

  .avatar-img {
    @apply h-full w-full object-cover;
  }

  .avatar-fallback {
    @apply flex h-full w-full items-center justify-center text-xl font-semibold text-[#22c55e];
  }

  .avatar-meta {
    @apply min-w-0 flex-1;
  }

  .avatar-title {
    @apply text-sm;
    color: var(--text-secondary);
  }

  .avatar-subtitle {
    @apply text-xs;
    color: var(--text-faint);
  }

  .field {
    @apply flex flex-col gap-2 text-sm;
  }

  .input-label {
    @apply text-xs font-medium uppercase tracking-[0.18em];
    color: var(--text-faint);
  }

  .input {
    @apply w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-100;
    background: var(--surface-input);
    border-color: var(--border-subtle);
    color: var(--text-primary);
  }

  .bio-textarea {
    @apply min-h-[120px] resize-none;
  }

  .header-action {
    @apply shrink-0 rounded-lg border px-3 py-2 text-sm transition;
  }

  .header-action--ghost {
    background: var(--studio-node-bg-soft);
    border-color: var(--studio-node-border);
    color: var(--text-secondary);
  }

  .header-action--ghost:hover:not(:disabled) {
    background: var(--studio-node-bg-hover);
    border-color: var(--studio-node-border-strong);
    color: var(--text-primary);
  }

  .header-action--primary {
    background: var(--color-accent-soft);
    border-color: color-mix(in srgb, var(--color-accent) 42%, transparent);
    color: var(--color-accent-strong);
  }

  .header-action--primary:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--color-accent) 58%, transparent);
    background: color-mix(in srgb, var(--color-accent-soft) 78%, var(--surface-card-hover));
  }

  .header-action:disabled {
    @apply opacity-70 cursor-default;
  }

  .header-controls {
    @apply flex flex-wrap items-center gap-2 shrink-0;
  }

  .social-count-pill {
    @apply rounded-lg border px-3 py-2 text-left transition;
    background: var(--studio-node-bg-soft);
    border-color: var(--studio-node-border);
    color: var(--text-secondary);
  }

  .social-count-pill:hover:not(:disabled) {
    background: var(--studio-node-bg-hover);
    border-color: var(--studio-node-border-strong);
    color: var(--text-primary);
  }

  .social-count-pill:disabled {
    @apply opacity-70 cursor-default;
  }

  .social-count-label {
    @apply block text-[0.62rem] uppercase tracking-[0.16em];
    color: var(--text-faint);
  }

  .social-count-value {
    @apply mt-1 block text-sm font-medium;
    color: var(--text-primary);
  }
</style>
