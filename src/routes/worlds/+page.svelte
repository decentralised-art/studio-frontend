<script lang="ts">
  import { resolve } from "$app/paths";
  import { onMount } from "svelte";

  import { FIRST_PARTY_WORLDS, loadWorldRegistry } from "$lib/worlds/registry";
  import type { WorldDescriptor } from "$lib/worlds/types";

  let worlds = $state<WorldDescriptor[]>([...FIRST_PARTY_WORLDS]);
  let registryLoading = $state(true);
  let registryLoadWarning = $state(false);

  onMount(() => {
    let mounted = true;

    const loadWorlds = async () => {
      try {
        const result = await loadWorldRegistry({ surface: "world-page" });
        if (!mounted) return;

        worlds = result.worlds;
        registryLoadWarning = result.backendError !== null && result.usedFirstPartyFallback;
      } catch {
        if (!mounted) return;
        registryLoadWarning = true;
      } finally {
        if (mounted) {
          registryLoading = false;
        }
      }
    };

    void loadWorlds();

    return () => {
      mounted = false;
    };
  });
</script>

<svelte:head>
  <title>Worlds</title>
</svelte:head>

<main class="worlds-page">
  <section class="worlds-header">
    <p>Worlds</p>
  </section>

  {#if registryLoading || registryLoadWarning}
    <p
      class="worlds-status"
      class:worlds-status-warning={registryLoadWarning}
      role="status"
      aria-live="polite"
    >
      {registryLoading
        ? "Loading worlds..."
        : "Showing bundled worlds. Backend registry unavailable."}
    </p>
  {/if}

  <section class="world-grid" aria-label="Available worlds">
    {#each worlds as world (world.id)}
      <a class="world-card" href={resolve("/worlds/[slug]", { slug: world.slug })}>
        <div class="world-graphic" style={`--world-accent: ${world.accentColor ?? "#67d6ff"}`}>
          <div class="score-lines" aria-hidden="true">
            {#each Array.from({ length: 5 }, (_, index) => index) as line (line)}
              <span></span>
            {/each}
          </div>
          <strong>{world.heroLabel ?? world.name}</strong>
        </div>
        <div class="world-card-body">
          <div>
            <h2>{world.name}</h2>
            <p>{world.shortDescription ?? world.description}</p>
          </div>
        </div>
      </a>
    {/each}

    <a class="world-card world-card-placeholder" href={resolve("/worlds/upload")}>
      <div class="world-graphic world-placeholder-graphic" style="--world-accent: #8de58f">
        <span class="world-plus" aria-hidden="true">+</span>
      </div>
      <div class="world-card-body">
        <div>
          <h2>Upload a world bundle</h2>
          <p>Validate and publish a backend-hosted iframe world from a ZIP bundle.</p>
        </div>
      </div>
    </a>
  </section>
</main>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .worlds-page {
    @apply min-h-0 flex-1 overflow-auto px-4 py-8 md:px-6 md:py-10;
    background: var(--surface-page);
    color: var(--text-primary);
  }

  .worlds-header {
    @apply mx-auto max-w-6xl;
  }

  .worlds-header p {
    @apply m-0 text-[0.68rem] uppercase tracking-[0.18em];
    color: var(--text-muted);
  }

  .worlds-status {
    @apply mx-auto mt-3 max-w-6xl text-sm;
    color: var(--text-muted);
  }

  .worlds-status-warning {
    color: #fbbf24;
  }

  .world-grid {
    @apply mx-auto mt-8 grid max-w-6xl gap-4 md:grid-cols-2 xl:grid-cols-3;
  }

  .world-card {
    @apply overflow-hidden rounded-md border transition;
    background: var(--surface-card);
    border-color: var(--border-subtle);
  }

  .world-card:hover {
    background: var(--surface-card-hover);
    border-color: var(--border-strong);
    transform: translateY(-1px);
  }

  .world-card-placeholder {
    border-style: dashed;
    opacity: 0.82;
  }

  .world-card-placeholder:hover {
    transform: none;
  }

  .world-graphic {
    @apply relative flex aspect-[4/3] items-center justify-center overflow-hidden border-b;
    border-color: var(--border-subtle);
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--world-accent) 14%, transparent),
        transparent
      ),
      var(--surface-panel-soft);
  }

  .score-lines {
    @apply absolute inset-x-6 top-1/2 grid -translate-y-1/2 gap-3;
  }

  .score-lines span {
    @apply block h-px;
    background: color-mix(in srgb, var(--world-accent) 58%, var(--border-subtle));
  }

  .world-graphic strong {
    @apply relative rounded-md border px-4 py-3 text-sm uppercase tracking-[0.18em];
    border-color: color-mix(in srgb, var(--world-accent) 45%, var(--border-subtle));
    background: color-mix(in srgb, var(--surface-card) 78%, transparent);
  }

  .world-placeholder-graphic {
    background:
      radial-gradient(
        circle at center,
        color-mix(in srgb, var(--world-accent) 18%, transparent),
        transparent 44%
      ),
      var(--surface-panel-soft);
  }

  .world-plus {
    @apply relative flex h-16 w-16 items-center justify-center rounded-full border text-5xl font-light;
    border-color: color-mix(in srgb, var(--world-accent) 42%, var(--border-subtle));
    color: color-mix(in srgb, var(--world-accent) 76%, var(--text-primary));
    background: color-mix(in srgb, var(--surface-card) 72%, transparent);
  }

  .world-card-body {
    @apply grid gap-4 p-4;
  }

  .world-card h2 {
    @apply m-0 text-lg font-semibold;
  }

  .world-card p {
    @apply m-0 mt-2 text-sm leading-6;
    color: var(--text-muted);
  }
</style>
