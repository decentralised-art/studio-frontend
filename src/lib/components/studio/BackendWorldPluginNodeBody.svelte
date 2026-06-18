<script lang="ts">
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
    world: WorldDescriptor;
    runtimeData: StudioPluginRuntimeData | null;
    connectorSetSelection?: StudioWorldConnectorSetSelection;
    selectedConnectorContextNames?: string[];
    selectedConnectorContextPathPrefixes?: string[];
  };

  let {
    label,
    world,
    runtimeData,
    connectorSetSelection,
    selectedConnectorContextNames = [],
    selectedConnectorContextPathPrefixes = [],
  }: Props = $props();

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
    }),
  );
</script>

<div class="backend-world-shell">
  <div class="backend-world-toolbar">
    <div class="backend-world-meta">{statsText}</div>
    <a
      class="backend-world-open"
      href={resolve("/worlds/[slug]", { slug: world.slug })}
      target="_blank"
      rel="noopener noreferrer"
    >
      Open
    </a>
  </div>

  <div class="backend-world-frame">
    <WorldFrame {world} input={worldInput} title={`${label} preview`} showStatus={true} />
  </div>
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .backend-world-shell {
    @apply mt-3 flex min-h-0 flex-1 flex-col;
  }

  .backend-world-toolbar {
    @apply flex items-center justify-between gap-2;
  }

  .backend-world-meta {
    @apply text-[0.55rem] uppercase tracking-[0.18em] text-white/55;
  }

  .backend-world-open {
    @apply rounded-md border border-white/15 px-2 py-1 text-[0.52rem] uppercase tracking-[0.16em] text-white/60 no-underline;
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
