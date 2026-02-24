<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";

  import { authenticateAllMockAccountsInChain, login, registerUser } from "$lib/auth/api";
  import type { MockChainAuthResult } from "$lib/auth/api";
  import { getToken } from "$lib/auth/session";

  let form = $state({
    email: "",
    password: "",
  });

  let isSubmitting = $state(false);
  let loginError = $state("");
  let isMockAuthRunning = $state(false);
  let mockAuthError = $state("");
  let mockAuthResults = $state<MockChainAuthResult[]>([]);
  let showRegister = $state(false);

  let registerForm = $state({
    email: "",
    displayName: "",
    password: "",
  });

  let isRegistering = $state(false);
  let registerError = $state("");
  let registerSuccess = $state("");

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    loginError = "";

    if (!form.email.trim() || !form.password.trim()) {
      loginError = "Email and password are required.";
      return;
    }

    isSubmitting = true;
    try {
      await login(form.email.trim(), form.password);
      await goto(resolve("/account"));
    } catch (err) {
      loginError = err instanceof Error ? err.message : "Login failed.";
    } finally {
      isSubmitting = false;
    }
  };

  const handleRegister = async (event: SubmitEvent) => {
    event.preventDefault();
    registerError = "";
    registerSuccess = "";

    if (
      !registerForm.email.trim() ||
      !registerForm.displayName.trim() ||
      !registerForm.password.trim()
    ) {
      registerError = "Email, display name, and password are required.";
      return;
    }

    isRegistering = true;
    try {
      await registerUser(
        registerForm.email.trim(),
        registerForm.displayName.trim(),
        registerForm.password,
      );
      registerSuccess = "Account created. You can now log in.";
      form.email = registerForm.email.trim();
      form.password = "";
    } catch (err) {
      registerError = err instanceof Error ? err.message : "Registration failed.";
    } finally {
      isRegistering = false;
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

  const mockAuthSuccessCount = $derived.by(() =>
    mockAuthResults.reduce((count, result) => count + (result.success ? 1 : 0), 0),
  );

  onMount(() => {
    if (getToken()) {
      goto(resolve("/account"));
      return;
    }

    const navigationState = page.state as Record<string, unknown> | null;
    if (navigationState?.register === true) {
      showRegister = true;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.has("register")) {
      showRegister = true;
    }

    void handleAuthenticateAllMockAccounts();
  });
</script>

<div class="auth-page">
  <SectionShell>
    <div class="header">
      <h1 class="title">Log in</h1>
      <p class="subtitle">Access your account and toolbox.</p>
    </div>

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

      <div class="actions dev-actions">
        <Button
          variant="ghost"
          type="button"
          onclick={handleAuthenticateAllMockAccounts}
          disabled={isSubmitting || isMockAuthRunning}
        >
          {isMockAuthRunning ? "Authenticating mock accounts..." : "Authenticate all mock accounts"}
        </Button>
      </div>

      {#if mockAuthError}
        <p class="error">{mockAuthError}</p>
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

      <button type="button" class="toggle" onclick={() => (showRegister = !showRegister)}>
        Don't have an account yet? <span class="toggle-emphasis">Register</span>
      </button>
    </form>

    {#if showRegister}
      <div class="register">
        <div class="register-header">
          <h2 class="register-title">Create account</h2>
          <p class="register-subtitle">Join the network with a new identity.</p>
        </div>

        <form class="form" onsubmit={handleRegister}>
          <Input
            label="Email"
            type="email"
            bind:value={registerForm.email}
            placeholder="you@hypermusic.ai"
          />
          <Input
            label="Display name"
            type="text"
            bind:value={registerForm.displayName}
            placeholder="Your public handle"
          />
          <Input
            label="Password"
            type="password"
            bind:value={registerForm.password}
            placeholder="••••••••"
          />

          {#if registerError}
            <p class="error">{registerError}</p>
          {/if}

          {#if registerSuccess}
            <p class="success">{registerSuccess}</p>
          {/if}

          <div class="actions">
            <Button variant="primary" type="submit" disabled={isRegistering}>
              {isRegistering ? "Creating..." : "Create account"}
            </Button>
            <Button variant="ghost" type="button" onclick={() => (showRegister = false)}>
              Back to login
            </Button>
          </div>
        </form>
      </div>
    {/if}
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

  .toggle {
    @apply text-xs text-white/60 underline text-left;
  }

  .toggle-emphasis {
    @apply text-white/80;
  }

  .register {
    @apply mt-8 border-t border-white/10 pt-6 space-y-4;
  }

  .register-header {
    @apply space-y-1;
  }

  .register-title {
    @apply text-lg font-semibold text-white;
  }

  .register-subtitle {
    @apply text-sm text-white/60;
  }
</style>
