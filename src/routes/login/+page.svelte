<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  import {
    DEFAULT_AUTHENTICATED_ROUTE,
    DEFAULT_UNAUTHENTICATED_ROUTE,
  } from "$lib/auth/routeAccess";
  import { hasAuthSession } from "$lib/auth/session";

  onMount(() => {
    void goto(
      resolve(hasAuthSession() ? DEFAULT_AUTHENTICATED_ROUTE : DEFAULT_UNAUTHENTICATED_ROUTE),
      { replaceState: true },
    );
  });
</script>

<div class="login-redirect" aria-live="polite">Opening app...</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .login-redirect {
    @apply flex-1 min-h-0 flex items-center justify-center px-4 py-10 text-sm;
    color: var(--text-muted);
  }
</style>
