<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import {
    DEFAULT_AUTHENTICATED_ROUTE,
    DEFAULT_UNAUTHENTICATED_ROUTE,
  } from "$lib/auth/routeAccess";
  import { hasAuthSession } from "$lib/auth/session";

  let message = $state("Opening app...");

  onMount(async () => {
    if (hasAuthSession()) {
      message = "Opening network...";
      await goto(resolve(DEFAULT_AUTHENTICATED_ROUTE), { replaceState: true });
      return;
    }

    message = "Opening worlds...";
    await goto(resolve(DEFAULT_UNAUTHENTICATED_ROUTE), { replaceState: true });
  });
</script>

<div class="root-redirect-page">
  <SectionShell>
    <div class="root-redirect-card">
      <p class="root-redirect-label">decentralised.art</p>
      <p class="root-redirect-message">{message}</p>
    </div>
  </SectionShell>
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .root-redirect-page {
    @apply flex-1 min-h-0 flex items-center justify-center px-4 py-10;
  }

  .root-redirect-card {
    @apply min-w-[18rem] rounded-2xl border px-6 py-5 text-center;
    background: var(--surface-card);
    border-color: var(--border-subtle);
    box-shadow: var(--shadow-soft);
  }

  .root-redirect-label {
    @apply text-xs uppercase tracking-[0.28em];
    color: var(--text-faint);
  }

  .root-redirect-message {
    @apply mt-3 text-sm;
    color: var(--text-secondary);
  }
</style>
