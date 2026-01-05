<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";

  import { login, registerUser } from "$lib/auth/api";
  import { getToken } from "$lib/auth/session";

  let form = $state({
    email: "",
    password: "",
  });

  let isSubmitting = $state(false);
  let loginError = $state("");
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

  onMount(() => {
    if (getToken()) {
      goto(resolve("/account"));
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.has("register")) {
      showRegister = true;
    }
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
