<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";

  import {
    authenticateAllMockAccountsInChain,
    login,
    loginWithMockChainAccount,
    registerUser,
  } from "$lib/auth/api";
  import type { MockChainAuthResult } from "$lib/auth/api";
  import { getToken } from "$lib/auth/session";
  import { mockUsers } from "$lib/data/users";

  let form = $state({
    email: "",
    password: "",
  });

  let isSubmitting = $state(false);
  let loginError = $state("");
  let isMockAuthRunning = $state(false);
  let mockAuthError = $state("");
  let mockAuthResults = $state<MockChainAuthResult[]>([]);
  let mockLoginError = $state("");
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
        await loginWithMockChainAccount(mockUserId);
      }
      await goto(resolve("/account"));
    } catch (err) {
      loginError = err instanceof Error ? err.message : "Login failed.";
    } finally {
      isSubmitting = false;
    }
  };

  const handleAuthenticateAllMockAccounts = async () => {
    mockAuthError = "";
    isMockAuthRunning = true;
    try {
      mockAuthResults = await authenticateAllMockAccountsInChain();
    } catch (err) {
      mockAuthError = err instanceof Error ? err.message : "Mock chain auth failed.";
      mockAuthResults = [];
    } finally {
      isMockAuthRunning = false;
    }
  };

  const loginWithMockUser = async (
    userId: string,
    destination: "/account" | "/studio" = "/account",
  ) => {
    const user = mockUsers.find((entry) => entry.id === userId);
    if (!user) return;

    mockLoginError = "";
    loginError = "";
    isSubmitting = true;

    const credentials = mockCredentialsForUser(user.id);
    form.email = credentials.email;
    form.password = credentials.password;

    try {
      try {
        await login(credentials.email, credentials.password);
      } catch {
        await registerUser(credentials.email, user.nickname, credentials.password);
        await login(credentials.email, credentials.password);
      }
      await loginWithMockChainAccount(user.id);
      await goto(resolve(destination));
    } catch (err) {
      mockLoginError = err instanceof Error ? err.message : "Mock login failed.";
    } finally {
      isSubmitting = false;
    }
  };

  const handlePrototypePreview = async () => {
    await loginWithMockUser("user-lyra", "/studio");
  };

  const mockAuthSuccessCount = $derived.by(() =>
    mockAuthResults.reduce((count, result) => count + (result.success ? 1 : 0), 0),
  );

  onMount(() => {
    if (getToken()) {
      goto(resolve("/account"));
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
          disabled={isSubmitting || isMockAuthRunning}
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
        <div class="actions dev-actions">
          <Button
            variant="ghost"
            type="button"
            onclick={handleAuthenticateAllMockAccounts}
            disabled={isSubmitting || isMockAuthRunning}
          >
            {isMockAuthRunning
              ? "Authenticating mock accounts..."
              : "Authenticate all mock accounts"}
          </Button>
        </div>

        <div class="mock-login-panel">
          <div class="mock-login-header">
            <p class="mock-login-title">Mock user sign in</p>
            <p class="mock-login-subtitle">
              Uses the regular services login flow. Missing mock users are registered automatically.
            </p>
          </div>

          <div class="mock-login-grid">
            {#each mockUsers as user (user.id)}
              <Button
                variant="ghost"
                type="button"
                disabled={isSubmitting || isMockAuthRunning}
                onclick={() => loginWithMockUser(user.id)}
              >
                {user.nickname}
              </Button>
            {/each}
          </div>

          <p class="mock-login-credentials">
            Password for all mock users: <code>{MOCK_PASSWORD}</code>
          </p>

          {#if form.email.endsWith("@mock.decentralised.art")}
            <p class="mock-login-credentials">
              Current mock email: <code>{form.email}</code>
            </p>
          {/if}
        </div>

        {#if mockAuthError}
          <p class="error">{mockAuthError}</p>
        {/if}

        {#if mockLoginError}
          <p class="error">{mockLoginError}</p>
        {/if}

        {#if mockAuthResults.length > 0}
          <div class="mock-auth-results">
            <p class="success">
              Chain auth completed for {mockAuthResults.length} mocked accounts. Success:
              {mockAuthSuccessCount}/{mockAuthResults.length}.
            </p>

            {#each mockAuthResults as result (result.userId)}
              <div class="mock-result-card">
                <p class="mock-result-title">{result.nickname} ({result.userId})</p>
                <p class={result.success ? "success" : "error"}>
                  {result.success ? "Authenticated" : "Authentication failed"}
                </p>

                <div class="mock-result-line">
                  <span class="mock-result-label">public_key</span>
                  <code class="mock-result-value">{result.publicKey}</code>
                </div>
                <div class="mock-result-line">
                  <span class="mock-result-label">private_key</span>
                  <code class="mock-result-value">{result.privateKey}</code>
                </div>
                <div class="mock-result-line">
                  <span class="mock-result-label">auth_request["address"]</span>
                  <code class="mock-result-value">{result.address}</code>
                </div>
                <div class="mock-result-line">
                  <span class="mock-result-label">auth_request["message"]</span>
                  <code class="mock-result-value">{result.message ?? "n/a"}</code>
                </div>
                <div class="mock-result-line">
                  <span class="mock-result-label">auth_request["signature"]</span>
                  <code class="mock-result-value">{result.signature ?? "n/a"}</code>
                </div>
                <div class="mock-result-line">
                  <span class="mock-result-label">nonce</span>
                  <code class="mock-result-value">{result.nonce ?? "n/a"}</code>
                </div>
                <div class="mock-result-line">
                  <span class="mock-result-label">jwt</span>
                  <code class="mock-result-value">{result.token ?? "n/a"}</code>
                </div>
                <div class="mock-result-line">
                  <span class="mock-result-label">patched_user_id</span>
                  <code class="mock-result-value">{result.patchedUserId ?? "n/a"}</code>
                </div>
                <div class="mock-result-line">
                  <span class="mock-result-label">ethereum_address_patched</span>
                  <code class="mock-result-value"
                    >{result.ethereumAddressPatched ? "true" : "false"}</code
                  >
                </div>

                {#if result.error}
                  <p class="error">{result.error}</p>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
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

  .dev-actions {
    @apply justify-start;
  }

  .mock-auth-results {
    @apply border border-white/10 rounded-lg p-3 space-y-3 bg-black/20;
  }

  .mock-login-panel {
    @apply border border-white/10 rounded-lg p-3 space-y-3 bg-black/20;
  }

  .mock-login-header {
    @apply space-y-1;
  }

  .mock-login-title {
    @apply text-sm font-semibold text-white;
  }

  .mock-login-subtitle {
    @apply text-xs text-white/60;
  }

  .mock-login-grid {
    @apply grid grid-cols-1 sm:grid-cols-2 gap-2;
  }

  .mock-login-credentials {
    @apply text-xs text-white/60;
  }

  .mock-login-credentials code {
    @apply text-white/80 bg-white/5 px-1 py-0.5 rounded;
  }

  .mock-result-card {
    @apply border border-white/10 rounded-md p-3 space-y-2;
  }

  .mock-result-title {
    @apply text-sm font-semibold text-white;
  }

  .mock-result-line {
    @apply grid grid-cols-1 gap-1;
  }

  .mock-result-label {
    @apply text-xs text-white/70;
  }

  .mock-result-value {
    @apply text-[11px] text-white/90 break-all font-mono;
  }

  .error {
    @apply text-sm text-red-400;
  }

  .success {
    @apply text-sm text-emerald-300;
  }

  .registration-closed {
    @apply text-xs text-white/55 text-left;
  }
</style>
