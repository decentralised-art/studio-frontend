<script lang="ts">
  import Input from "$lib/components/ui/Input.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import { mockCurrentUserId, mockUsersById } from "$lib/data/users";

  import UserContribution from "$lib/components/user/UserContribution.svelte";
  import UserToolbox from "$lib/components/user/UserToolbox.svelte";
  import SelectInput from "$lib/components/ui/SelectInput.svelte";

  const currentUser = mockUsersById[mockCurrentUserId];

  let profile = $state({
    nickname: currentUser.nickname,
    bio: currentUser.bio ?? "",
    kind: currentUser.kind,
    avatarUrl: currentUser.avatarUrl,
  });

  /* ---------------- handlers ---------------- */

  const handleSubmit = (event: SubmitEvent) => {
    event.preventDefault();
  };
</script>

<div class="page">
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

      <Input label="Ethereum address" value={currentUser.address} disabled={true} />

      <div class="actions">
        <Button variant="primary" type="submit">Save changes</Button>
        <Button variant="ghost" type="button">Discard</Button>
      </div>
    </form>
  </SectionShell>

  <SectionShell>
    <UserContribution user={currentUser} />
    <UserToolbox user={currentUser} />
  </SectionShell>
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .page {
    @apply py-4 grid gap-6 lg:grid-cols-[minmax(0,0.62fr)_minmax(0,0.38fr)];
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

  .account-select {
    @apply bg-white/10 text-white/70;
  }

  .bio-textarea {
    @apply min-h-[120px];
  }

  .actions {
    @apply flex flex-wrap gap-2;
  }
</style>
