<script lang="ts">
  import { onMount } from "svelte";
  import { resolve } from "$app/paths";

  import WorldFrame from "$lib/components/worlds/WorldFrame.svelte";
  import type { StudioPluginRuntimeData } from "$lib/studio/plugins/runtime";
  import type { StudioWorldConnectorSetSelection } from "$lib/studio/plugins/worldCompatibility";
  import {
    buildBackendWorldRuntimeInput,
    connectorBindingValueKey,
    type ConnectorBindingValues,
  } from "$lib/worlds/runtimeInput";
  import {
    type WorldAcceptedConnectorSet,
    type WorldDescriptor,
    type WorldRuntimeInput,
  } from "$lib/worlds/types";

  type Props = {
    label: string;
    enlarged?: boolean;
    onToggleSize?: () => void;
    world: WorldDescriptor;
    runtimeData: StudioPluginRuntimeData | null;
    connectorSetSelection?: StudioWorldConnectorSetSelection;
    selectedConnectorContextNames?: string[];
    selectedConnectorContextPathPrefixes?: string[];
  };

  let {
    label,
    world,
    enlarged = false,
    onToggleSize,
    runtimeData,
    connectorSetSelection,
    selectedConnectorContextNames = [],
    selectedConnectorContextPathPrefixes = [],
  }: Props = $props();

  let worldShell: HTMLDivElement | null = $state(null);
  let isFullscreen = $state(false);
  let canFullscreen = $state(false);
  let viewError = $state("");
  onMount(() => {
    canFullscreen = document.fullscreenEnabled;
  });
  const syncFullscreen = () => {
    isFullscreen = document.fullscreenElement === worldShell;
    viewError = "";
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === worldShell) await document.exitFullscreen();
      else await worldShell?.requestFullscreen();
    } catch {
      viewError = "Full screen is unavailable in this browser. Use Enlarge instead.";
    }
  };

  const normalizeConnectorName = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";

  const resolveStudioConnectorSetIndex = (
    connectorSets: WorldAcceptedConnectorSet[] | undefined,
    targets: string[],
  ): number | undefined => {
    if (!connectorSets?.length) return undefined;
    const targetNames = targets.map(normalizeConnectorName).filter(Boolean);
    const exactIndex = connectorSets.findIndex((connectorSet) =>
      connectorSet.connectors.every((slot) => targetNames.includes(normalizeConnectorName(slot))),
    );
    return exactIndex >= 0 ? exactIndex : undefined;
  };

  const buildStudioConnectorBindingValues = (
    connectorSet: WorldAcceptedConnectorSet | undefined,
    targets: string[],
  ): ConnectorBindingValues => {
    if (!connectorSet) return {};
    const normalizedTargets = targets.map(normalizeConnectorName);
    const values: ConnectorBindingValues = {};
    const usedTargetIndexes: number[] = [];

    const hasUsedTarget = (index: number): boolean => usedTargetIndexes.includes(index);
    const markTargetUsed = (index: number) => {
      if (index >= 0 && normalizedTargets[index] && !hasUsedTarget(index)) {
        usedTargetIndexes.push(index);
      }
    };

    connectorSet.connectors.forEach((slot, index) => {
      const normalizedSlot = normalizeConnectorName(slot);
      if (!normalizedSlot) return;
      const exactTargetIndex = normalizedTargets.findIndex(
        (target, targetIndex) => target === normalizedSlot && !hasUsedTarget(targetIndex),
      );
      const fallbackTarget = normalizedTargets[index] || normalizedSlot;
      const targetIndex = exactTargetIndex >= 0 ? exactTargetIndex : index;
      markTargetUsed(targetIndex);
      values[connectorBindingValueKey(normalizedSlot)] =
        exactTargetIndex >= 0 ? normalizedTargets[exactTargetIndex] : fallbackTarget;
    });

    connectorSet.optionalConnectors.forEach((slot) => {
      const normalizedSlot = normalizeConnectorName(slot);
      if (!normalizedSlot) return;
      const exactTargetIndex = normalizedTargets.findIndex(
        (target, targetIndex) => target === normalizedSlot && !hasUsedTarget(targetIndex),
      );
      if (exactTargetIndex < 0) return;
      markTargetUsed(exactTargetIndex);
      values[connectorBindingValueKey(normalizedSlot, true)] = normalizedTargets[exactTargetIndex];
    });

    return values;
  };

  const streams = $derived(
    runtimeData?.streams.map((stream) => ({
      path: stream.feature_path,
      data: [...stream.data],
    })) ?? [],
  );
  const connectorTargets = $derived(runtimeData?.connectorTargets ?? []);
  const streamCount = $derived(streams.length);
  const valueCount = $derived(streams.reduce((count, stream) => count + stream.data.length, 0));
  const particlesCount = $derived.by(() => {
    const counts = streams.map((stream) => stream.data.length).filter((count) => count > 0);
    return counts.length ? Math.max(...counts) : undefined;
  });
  const connectorName = $derived(connectorTargets.join(" + ") || undefined);
  const fallbackConnectorSetIndex = $derived.by(() =>
    resolveStudioConnectorSetIndex(world.acceptedConnectorSets, connectorTargets),
  );
  const selectedConnectorSetIndex = $derived.by(() => {
    const selectedIndex = connectorSetSelection?.connectorSetIndex;
    if (selectedIndex !== undefined && world.acceptedConnectorSets?.[selectedIndex]) {
      return selectedIndex;
    }
    return fallbackConnectorSetIndex;
  });
  const connectorBindingValues = $derived.by(() =>
    connectorSetSelection && connectorSetSelection.connectorSetIndex === selectedConnectorSetIndex
      ? connectorSetSelection.connectorBindingValues
      : buildStudioConnectorBindingValues(
          selectedConnectorSetIndex === undefined
            ? undefined
            : world.acceptedConnectorSets?.[selectedConnectorSetIndex],
          connectorTargets,
        ),
  );
  const statsText = $derived(
    runtimeData
      ? `${streamCount} streams | ${valueCount} values | backend world`
      : "Awaiting flow output",
  );

  const worldInput = $derived<WorldRuntimeInput>(
    buildBackendWorldRuntimeInput({
      world,
      surface: "studio-plugin",
      label,
      connectorName,
      connectorSetIndex: selectedConnectorSetIndex,
      connectorBindingValues,
      particlesCount,
      selectedConnectorContextNames,
      selectedConnectorContextPathPrefixes,
      executeOutput: streams,
      executionProvenance: runtimeData?.executionProvenance,
      executionMode: runtimeData?.executionMode,
    }),
  );
</script>

<svelte:document onfullscreenchange={syncFullscreen} />

<div class="backend-world-shell" bind:this={worldShell}>
  <div class="backend-world-toolbar">
    <div class="backend-world-meta">{statsText}</div>
    <div class="backend-world-actions nodrag nopan nowheel">
      {#if onToggleSize && !isFullscreen}
        <button
          class="backend-world-open"
          type="button"
          onclick={onToggleSize}
          aria-label={enlarged ? "Restore World size" : "Enlarge World"}
          title={enlarged
            ? "Restore previous size and flow view"
            : "Enlarge and frame this World in the flow"}
        >
          {enlarged ? "Restore" : "Enlarge"}
        </button>
      {/if}
      <button
        class="backend-world-open"
        type="button"
        onclick={toggleFullscreen}
        disabled={!canFullscreen}
        aria-label={isFullscreen ? "Exit full screen World" : "Full screen World"}
        title={!canFullscreen
          ? "Full screen is unavailable in this browser. Use Enlarge instead."
          : isFullscreen
            ? "Return to the flow (Escape)"
            : "Evaluate this live World in full screen"}
      >
        {isFullscreen ? "Exit full screen" : "Full screen"}
      </button>
      <a
        class="backend-world-open"
        href={resolve("/worlds/[slug]", { slug: world.slug })}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open
      </a>
    </div>
  </div>
  {#if viewError}<p class="backend-world-view-error" role="status">{viewError}</p>{/if}

  <div class="backend-world-frame">
    <WorldFrame {world} input={worldInput} title={`${label} preview`} />
  </div>
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .backend-world-shell {
    @apply mt-3 flex min-h-0 flex-1 flex-col;
  }

  .backend-world-toolbar {
    @apply flex flex-wrap items-center justify-between gap-2;
  }

  .backend-world-shell:fullscreen {
    margin: 0;
    padding: 12px;
    width: 100%;
    height: 100%;
    background: var(--surface-page, #111);
    color: var(--text-primary, #eee);
  }

  .backend-world-shell:fullscreen .backend-world-frame {
    min-height: 0;
  }

  .backend-world-actions {
    @apply flex flex-wrap items-center gap-1;
  }

  .backend-world-view-error {
    @apply mt-2 text-xs;
  }

  .backend-world-meta {
    @apply text-[0.55rem] uppercase tracking-[0.18em] text-white/55;
  }

  .backend-world-open {
    @apply rounded-md border border-white/15 px-2 py-1 text-[0.52rem] uppercase tracking-[0.16em] text-white/60 no-underline;
  }

  .backend-world-open:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .backend-world-open:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  .backend-world-open:hover {
    @apply border-white/30 text-white/85;
  }

  .backend-world-frame {
    @apply mt-3 flex min-h-[280px] flex-1 overflow-hidden;
  }

  :global(:root[data-theme="light"] .backend-world-meta) {
    color: var(--text-muted) !important;
  }

  :global(:root[data-theme="light"] .backend-world-open) {
    border-color: var(--border-muted) !important;
    color: var(--text-muted) !important;
  }
</style>
