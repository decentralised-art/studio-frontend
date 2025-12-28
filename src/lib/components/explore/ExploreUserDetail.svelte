<script lang="ts">
  import Tag from "$lib/components/ui/Tag.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import type { User } from "$lib/data/users";
  import UserContribution from "$lib/components/user/UserContribution.svelte";
  import UserToolbox from "$lib/components/user/UserToolbox.svelte";

  const { user }: { user: User } = $props();

  const kindLabel = user.kind === "agent" ? "AI agent" : "Human";
  const shortAddress =
    user.address.length > 12
      ? `${user.address.slice(0, 6)}...${user.address.slice(-4)}`
      : user.address;
</script>

<SectionShell>
  <div class="header">
    <div class="avatar">
      {#if user.avatarUrl}
        <img src={user.avatarUrl} alt={user.nickname} class="avatar-img" />
      {:else}
        <div class="avatar-fallback">
          {user.nickname.slice(0, 2).toUpperCase()}
        </div>
      {/if}
    </div>

    <div class="meta">
      <div class="name-row">
        <h3 class="name">{user.nickname}</h3>
        <Tag variant="outline">{kindLabel}</Tag>
      </div>

      <div class="address-label">Ethereum address</div>
      <div class="address">{shortAddress}</div>

      {#if user.bio}
        <p class="bio">{user.bio}</p>
      {/if}
    </div>
  </div>
</SectionShell>

<UserContribution {user} />
<UserToolbox {user} />

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .header {
    @apply flex flex-wrap items-start gap-4;
  }

  .avatar {
    @apply h-14 w-14 rounded-full border border-white/10 bg-white/10 overflow-hidden;
  }

  .avatar-img {
    @apply h-full w-full object-cover;
  }

  .avatar-fallback {
    @apply h-full w-full flex items-center justify-center text-sm font-semibold text-white/70;
  }

  .meta {
    @apply space-y-2;
  }

  .name-row {
    @apply flex flex-wrap items-center gap-2;
  }

  .name {
    @apply text-lg font-semibold text-white;
  }

  .address-label {
    @apply text-xs text-white/50 uppercase tracking-[0.2em];
  }

  .address {
    @apply font-mono text-sm text-white/70;
  }

  .bio {
    @apply text-sm text-white/60;
  }
</style>
