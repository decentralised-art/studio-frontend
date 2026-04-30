<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";

  import { login, registerUser } from "$lib/auth/api";
  import { DEFAULT_AUTHENTICATED_ROUTE } from "$lib/auth/routeAccess";
  import { hasAuthSession } from "$lib/auth/session";

  type AuthMode = "login" | "register";

  let form = $state({
    email: "",
    displayName: "",
    password: "",
  });

  let authMode = $state<AuthMode>("login");
  let isSubmitting = $state(false);
  let loginError = $state("");

  const toggleAuthMode = () => {
    authMode = authMode === "login" ? "register" : "login";
    loginError = "";
  };

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    loginError = "";

    if (!form.email.trim() || !form.password.trim()) {
      loginError = "Email and password are required.";
      return;
    }

    if (authMode === "register" && !form.displayName.trim()) {
      loginError = "Display name is required.";
      return;
    }

    isSubmitting = true;
    try {
      const email = form.email.trim();
      if (authMode === "register") {
        await registerUser(email, form.displayName.trim(), form.password);
      }
      await login(email, form.password);
      await goto(resolve("/account"));
    } catch (err) {
      loginError =
        err instanceof Error
          ? err.message
          : authMode === "register"
            ? "Registration failed."
            : "Login failed.";
    } finally {
      isSubmitting = false;
    }
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
      <h1 class="title">{authMode === "register" ? "Create account" : "Log in"}</h1>
      <p class="subtitle">
        {authMode === "register"
          ? "Register a services account for your DCN profile."
          : "Access your account and toolbox."}
      </p>
    </div>

    <p class="mock-system-warning">
      Mock system warning: this deployment may still expose experimental chain data and development
      infrastructure. Accounts, follows, and toolbox entries are loaded only from your services
      profile.
    </p>

    <form class="form" onsubmit={handleSubmit}>
      <Input label="Email" type="email" bind:value={form.email} placeholder="you@hypermusic.ai" />
      {#if authMode === "register"}
        <Input label="Display name" bind:value={form.displayName} placeholder="Your public name" />
      {/if}
      <Input label="Password" type="password" bind:value={form.password} placeholder="••••••••" />

      {#if loginError}
        <p class="error">{loginError}</p>
      {/if}

      <div class="actions">
        <Button variant="primary" type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? authMode === "register"
              ? "Creating..."
              : "Signing in..."
            : authMode === "register"
              ? "Create account"
              : "Sign in"}
        </Button>
      </div>

      <button class="mode-toggle" type="button" onclick={toggleAuthMode}>
        {authMode === "register" ? "Already have an account? Sign in" : "Need an account? Register"}
      </button>
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
    @apply text-xl font-semibold;
    color: var(--text-primary);
  }

  .subtitle {
    @apply text-sm;
    color: var(--text-muted);
  }

  .mock-system-warning {
    @apply mt-4 rounded-lg border px-4 py-3 space-y-2 text-sm;
    background: color-mix(in srgb, #06b6d4 8%, transparent);
    border-color: color-mix(in srgb, #0891b2 28%, transparent);
    color: var(--text-secondary);
  }

  .form {
    @apply mt-6 space-y-4;
  }

  .actions {
    @apply flex items-center justify-end;
  }

  .error {
    @apply text-sm text-red-400;
  }

  .mode-toggle {
    @apply text-xs underline decoration-transparent underline-offset-2 transition;
    color: var(--text-muted);
  }

  .mode-toggle:hover {
    color: var(--text-primary);
    text-decoration-color: var(--border-strong);
  }
</style>
