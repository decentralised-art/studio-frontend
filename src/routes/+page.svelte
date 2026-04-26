<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import { DEFAULT_AUTHENTICATED_ROUTE, LOGIN_ROUTE } from "$lib/auth/routeAccess";
  import { hasAuthSession } from "$lib/auth/session";

  let message = $state("Opening app...");

  onMount(async () => {
    if (hasAuthSession()) {
      message = "Opening network...";
      await goto(resolve(DEFAULT_AUTHENTICATED_ROUTE), { replaceState: true });
      return;
    }

    message = "Opening login...";
    await goto(resolve(LOGIN_ROUTE), { replaceState: true });
  });
</script>

<div class="root-redirect-page">
  <SectionShell>
    <div class="root-redirect-card">
      <p class="root-redirect-label">Hypermusic.ai</p>
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
    @apply min-w-[18rem] rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-center;
  }

  .root-redirect-label {
    @apply text-xs uppercase tracking-[0.28em] text-white/40;
  }

  .root-redirect-message {
    @apply mt-3 text-sm text-white/80;
  }
</style>
