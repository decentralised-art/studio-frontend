<script lang="ts">
  import WorldFrame from "$lib/components/worlds/WorldFrame.svelte";
  import type { StudioPluginRuntimeData } from "$lib/studio/plugins/runtime";
  import { getToneWorldLayerCompatibilityFromStreams, type ToneWorldStream } from "$lib/toneWorld";
  import { buildToneWorldInput, TONE_WORLD } from "$lib/worlds/registry";

  type Props = {
    label: string;
    runtimeData: StudioPluginRuntimeData | null;
    selectedConnectorContextNames?: string[];
    selectedConnectorContextPathPrefixes?: string[];
  };

  let {
    label,
    runtimeData,
    selectedConnectorContextNames = [],
    selectedConnectorContextPathPrefixes = [],
  }: Props = $props();

  const toneStreams = $derived<ToneWorldStream[]>(
    runtimeData?.streams.map((stream) => ({
      path: stream.feature_path,
      data: [...stream.data],
    })) ?? [],
  );
  const layerCompatibility = $derived(getToneWorldLayerCompatibilityFromStreams(toneStreams));
  const hasToneLayer = $derived(layerCompatibility.hasAnyLayer);
  const particlesCount = $derived.by(() => {
    const counts = toneStreams.map((stream) => stream.data.length).filter((count) => count > 0);
    return counts.length ? Math.max(...counts) : undefined;
  });
  const layerLabel = $derived.by(() => {
    if (layerCompatibility.hasAudioLayer && layerCompatibility.hasVisualLayer) {
      return "audio + visual";
    }
    if (layerCompatibility.hasAudioLayer) return "audio";
    if (layerCompatibility.hasVisualLayer) return "visual";
    return "unmapped";
  });
  const statsText = $derived.by(() => {
    if (!runtimeData) return "";
    const valueCount = toneStreams.reduce((count, stream) => count + stream.data.length, 0);
    return `${toneStreams.length} streams | ${valueCount} values | ${layerLabel} layer`;
  });
  const missingScalarsText = $derived.by(() => {
    const missingAudio = layerCompatibility.missingAudioScalars;
    const missingVisual = layerCompatibility.missingVisualScalars;
    if (!missingAudio.length || !missingVisual.length) return "";
    return `Missing audio scalars: ${missingAudio.join(", ")}. Missing visual scalars: ${missingVisual.join(", ")}.`;
  });
  const worldInput = $derived(
    runtimeData && hasToneLayer
      ? buildToneWorldInput({
          streams: toneStreams,
          label,
          surface: "studio-plugin",
          connectorTargets: runtimeData.connectorTargets,
          particlesCount,
          statsText,
          selectedConnectorContextNames,
          selectedConnectorContextPathPrefixes,
        })
      : null,
  );
</script>

<div class="tone-world-shell">
  {#if !runtimeData}
    <div class="tone-world-empty">Run the flow to generate Tone World data.</div>
  {:else if !hasToneLayer}
    <div class="tone-world-empty">
      <div>No Tone World audio or visual layer mapped yet.</div>
      {#if missingScalarsText}
        <div class="tone-world-diagnostics">{missingScalarsText}</div>
      {/if}
    </div>
  {:else}
    <div class="tone-world-toolbar">
      <div class="tone-world-meta">{statsText}</div>
    </div>

    <div class="tone-world-frame">
      <WorldFrame
        world={TONE_WORLD}
        input={worldInput}
        title={`${label} preview`}
        showStatus={true}
      />
    </div>
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .tone-world-shell {
    @apply mt-3 flex min-h-0 flex-1 flex-col;
  }

  .tone-world-toolbar {
    @apply flex items-center justify-between gap-2;
  }

  .tone-world-meta {
    @apply text-[0.55rem] uppercase tracking-[0.18em] text-white/55;
  }

  .tone-world-frame {
    @apply mt-3 flex min-h-[280px] flex-1 overflow-hidden;
  }

  .tone-world-empty {
    @apply mt-3 rounded-md border border-amber-300/20 bg-amber-950/20 px-4 py-3 text-[0.68rem] leading-relaxed text-amber-100/75;
  }

  .tone-world-diagnostics {
    @apply mt-2 text-[0.58rem] uppercase tracking-[0.14em] text-amber-100/55;
  }

  :global(:root[data-theme="light"] .tone-world-meta) {
    color: var(--text-muted) !important;
  }

  :global(:root[data-theme="light"] .tone-world-empty) {
    background: color-mix(in srgb, var(--accent-warning) 8%, var(--surface-raised)) !important;
    border-color: color-mix(in srgb, var(--accent-warning) 24%, var(--border-muted)) !important;
    color: var(--text-primary) !important;
  }

  :global(:root[data-theme="light"] .tone-world-diagnostics) {
    color: var(--text-muted) !important;
  }
</style>
