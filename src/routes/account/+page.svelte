<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { asset, resolve } from "$app/paths";

  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import SelectInput from "$lib/components/ui/SelectInput.svelte";

  import UserContribution from "$lib/components/user/UserContribution.svelte";
  import UserToolbox from "$lib/components/user/UserToolbox.svelte";

  import { getMe, logout } from "$lib/auth/api";
  import { getToken } from "$lib/auth/session";
  import type { User } from "$lib/data/users";

  const fallbackUser: User = {
    id: "current",
    kind: "human",
    address: "",
    nickname: "Unknown",
    avatarUrl: asset("/avatars/lyra.svg"),
    bio: "",
    authored: {
      performativeTransactions: 0,
      features: 0,
      transformations: 0,
      conditions: 0,
    },
    toolbox: [],
  };

  let currentUser = $state<User | null>(null);
  let isLoading = $state(true);
  let error = $state("");
  let isRedirecting = $state(false);

  let profile = $state({
    nickname: "",
    bio: "",
    kind: "human" as User["kind"],
    avatarUrl: "",
    address: "",
  });

  const coerceString = (value: unknown) => (typeof value === "string" ? value : "");

  const pickFirst = (...values: Array<string>) =>
    values.find((value) => value.trim().length > 0) ?? "";

  const normalizeUser = (payload: unknown): User => {
    if (!payload || typeof payload !== "object") return fallbackUser;
    const data = payload as Record<string, unknown>;
    const nested =
      data.user && typeof data.user === "object" ? (data.user as Record<string, unknown>) : data;

    const nickname = pickFirst(
      coerceString(nested.nickname),
      coerceString(nested.name),
      coerceString(nested.display_name),
      coerceString(nested.displayName),
      coerceString(nested.username),
      coerceString(nested.handle),
      fallbackUser.nickname,
    );

    const avatarUrl = pickFirst(
      coerceString(nested.avatarUrl),
      coerceString(nested.avatar_url),
      coerceString(nested.avatar),
      fallbackUser.avatarUrl,
    );

    const address = pickFirst(
      coerceString(nested.address),
      coerceString(nested.eth_address),
      coerceString(nested.ethAddress),
      coerceString(nested.wallet),
    );

    const bio = pickFirst(
      coerceString(nested.bio),
      coerceString(nested.description),
      coerceString(nested.about),
    );

    const kindRaw = pickFirst(
      coerceString(nested.kind),
      coerceString(nested.type),
      fallbackUser.kind,
    );

    const kind = kindRaw === "agent" ? "agent" : "human";

    const id = pickFirst(
      coerceString(nested.id),
      coerceString(nested.user_id),
      coerceString(nested.email),
      fallbackUser.id,
    );

    const authoredFallback = fallbackUser.authored;
    const authoredRaw = nested.authored;
    const authored =
      authoredRaw && typeof authoredRaw === "object"
        ? {
            performativeTransactions:
              Number((authoredRaw as Record<string, unknown>).performativeTransactions) ||
              Number((authoredRaw as Record<string, unknown>).performative_transactions) ||
              authoredFallback.performativeTransactions,
            features:
              Number((authoredRaw as Record<string, unknown>).features) ||
              authoredFallback.features,
            transformations:
              Number((authoredRaw as Record<string, unknown>).transformations) ||
              authoredFallback.transformations,
            conditions:
              Number((authoredRaw as Record<string, unknown>).conditions) ||
              authoredFallback.conditions,
          }
        : authoredFallback;

    const toolboxRaw = nested.toolbox;
    const toolbox = Array.isArray(toolboxRaw)
      ? toolboxRaw.filter((item): item is string => typeof item === "string")
      : fallbackUser.toolbox;

    return {
      ...fallbackUser,
      id,
      kind,
      nickname,
      avatarUrl,
      address,
      bio,
      authored,
      toolbox,
    };
  };

  const hydrateProfile = (user: User) => {
    profile = {
      nickname: user.nickname,
      bio: user.bio ?? "",
      kind: user.kind,
      avatarUrl: user.avatarUrl,
      address: user.address,
    };
  };

  const loadProfile = async () => {
    if (!getToken()) {
      isRedirecting = true;
      await goto(resolve("/login"));
      return;
    }

    isLoading = true;
    error = "";

    try {
      const data = await getMe();
      const user = normalizeUser(data);
      currentUser = user;
      hydrateProfile(user);
    } catch (err) {
      error = err instanceof Error ? err.message : "Unable to load account.";
    } finally {
      isLoading = false;
    }
  };

  const handleSubmit = (event: SubmitEvent) => {
    event.preventDefault();
  };

  const handleDiscard = () => {
    if (currentUser) hydrateProfile(currentUser);
  };

  const handleLogout = async () => {
    await logout();
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
          <Button variant="primary" type="submit">Save changes</Button>
          <Button variant="ghost" type="button" onclick={handleDiscard}>Discard</Button>
          <Button variant="ghost" type="button" onclick={handleLogout}>Logout</Button>
        </div>
      </form>
    </SectionShell>

    <SectionShell>
      <UserContribution user={currentUser} />
      <UserToolbox user={currentUser} />
    </SectionShell>
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .account-page {
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

  .bio-textarea {
    @apply min-h-[120px];
  }

  .actions {
    @apply flex flex-wrap gap-2;
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
</style>
