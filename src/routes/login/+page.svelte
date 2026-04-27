<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";

  import { login, loginOrRegisterUser, loginWithMockChainAccount } from "$lib/auth/api";
  import { DEFAULT_AUTHENTICATED_ROUTE } from "$lib/auth/routeAccess";
  import { hasAuthSession } from "$lib/auth/session";
  import { mockUsers } from "$lib/data/users";

  let form = $state({
    email: "",
    password: "",
  });

  let isSubmitting = $state(false);
  let loginError = $state("");
  const isDev = import.meta.env.DEV;

  const MOCK_PASSWORD = "mock-user-password";

  const mockCredentialsForUser = (userId: string) => ({
    email: `${userId}@mock.decentralised.art`,
    password: MOCK_PASSWORD,
  });

  const resolveMockUserIdFromEmail = (emailRaw: string): string | null => {
    const email = emailRaw.trim().toLowerCase();
    if (!email.endsWith("@mock.decentralised.art")) return null;
    const userId = email.replace(/@mock\.decentralised\.art$/i, "");
    return mockUsers.some((entry) => entry.id === userId) ? userId : null;
  };

  const warmMockChainSession = async (userId: string) => {
    try {
      await loginWithMockChainAccount(userId);
    } catch (error) {
      console.warn("[Login] Mock chain auth warm-up failed; services login remains active.", error);
    }
  };

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    loginError = "";

    if (!form.email.trim() || !form.password.trim()) {
      loginError = "Email and password are required.";
      return;
    }

    isSubmitting = true;
    try {
      const email = form.email.trim();
      await login(email, form.password);
      const mockUserId = resolveMockUserIdFromEmail(email);
      if (mockUserId) {
        await warmMockChainSession(mockUserId);
      }
      await goto(resolve("/account"));
    } catch (err) {
      loginError = err instanceof Error ? err.message : "Login failed.";
    } finally {
      isSubmitting = false;
    }
  };

  const loginWithMockUser = async (
    userId: string,
    destination: "/account" | "/studio" = "/account",
  ) => {
    const user = mockUsers.find((entry) => entry.id === userId);
    if (!user) return;

    loginError = "";
    isSubmitting = true;

    const credentials = mockCredentialsForUser(user.id);
    form.email = credentials.email;
    form.password = credentials.password;

    try {
      await loginOrRegisterUser(credentials.email, user.nickname, credentials.password);
      await warmMockChainSession(user.id);
      await goto(resolve(destination));
    } catch (err) {
      loginError = err instanceof Error ? err.message : "Mock login failed.";
    } finally {
      isSubmitting = false;
    }
  };

  const handlePrototypePreview = async () => {
    await loginWithMockUser("user-lyra", "/studio");
  };

  onMount(() => {
    if (hasAuthSession()) {
      goto(resolve(DEFAULT_AUTHENTICATED_ROUTE));
      return;
    }
  });
</script>

<div class="auth-page">
  <SectionShell>
    <div class="header">
      <h1 class="title">Log in</h1>
      <p class="subtitle">Access your account and toolbox.</p>
    </div>

    <div class="prototype-preview">
      <p class="prototype-preview-title">Prototype Preview</p>
      <p class="prototype-preview-text">
        DCN is currently in an experimental pre-MVP phase. It is suitable for exploration and demos,
        but not yet for production-ready projects or persistence-critical workflows.
      </p>
      <div class="actions prototype-preview-actions">
        <Button
          variant="primary"
          type="button"
          onclick={handlePrototypePreview}
          disabled={isSubmitting}
        >
          Preview Prototype
        </Button>
      </div>
    </div>

    {#if !isDev}
      <p class="dev-notice">
        Public release is not yet available. Use Preview to explore the prototype safely.
      </p>
    {/if}

    <form class="form" onsubmit={handleSubmit}>
      <Input label="Email" type="email" bind:value={form.email} placeholder="you@hypermusic.ai" />
      <Input label="Password" type="password" bind:value={form.password} placeholder="••••••••" />

      {#if loginError}
        <p class="error">{loginError}</p>
      {/if}

      <div class="actions">
        <Button variant="primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </div>

      {#if isDev}
        <p class="mock-login-credentials">Prototype mock password: <code>{MOCK_PASSWORD}</code></p>
      {/if}

      <p class="registration-closed">
        New account registration is temporarily disabled while the app is still in development.
      </p>
    </form>
  </SectionShell>
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .auth-page {
    @apply flex-1 min-h-0 flex items-center justify-center px-4 py-10;
  }

  .header {
    @apply space-y-2;
  }

  .title {
    @apply text-xl font-semibold text-white;
  }

  .subtitle {
    @apply text-sm text-white/60;
  }

  .dev-notice {
    @apply mt-4 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70;
  }

  .prototype-preview {
    @apply mt-4 rounded-lg border border-cyan-300/25 bg-cyan-400/5 px-4 py-3 space-y-2;
  }

  .prototype-preview-title {
    @apply text-sm font-semibold tracking-wide uppercase text-cyan-200;
  }

  .prototype-preview-text {
    @apply text-sm text-white/75;
  }

  .prototype-preview-actions {
    @apply justify-start pt-1;
  }

  .form {
    @apply mt-6 space-y-4;
  }

  .actions {
    @apply flex items-center justify-end;
  }

  .mock-login-credentials {
    @apply text-xs text-white/60;
  }

  .mock-login-credentials code {
    @apply text-white/80 bg-white/5 px-1 py-0.5 rounded;
  }

  .error {
    @apply text-sm text-red-400;
  }

  .registration-closed {
    @apply text-xs text-white/55 text-left;
  }
</style>
