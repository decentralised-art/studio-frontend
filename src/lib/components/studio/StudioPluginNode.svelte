<script lang="ts">
  import { Handle, Position, type Node, type NodeProps } from "@xyflow/svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import { downloadMidiClip, pluginRuntimeToMidiClip } from "$lib/studio/plugins/midiExport";
  import type { StudioPluginRuntimeData } from "$lib/studio/plugins/runtime";

  type PluginNodeData = {
    label: string;
    sourceId?: string;
    pluginData?: StudioPluginRuntimeData;
    pluginTargets?: string[];
  };

  type PluginNode = Node<PluginNodeData, "plugin">;

  const { data, selected }: NodeProps<PluginNode> = $props();
  const selectedClass = $derived(selected ? "is-selected" : "");
  const runtimeData = $derived<StudioPluginRuntimeData | null>(data.pluginData ?? null);
  const midiClip = $derived(runtimeData ? pluginRuntimeToMidiClip(runtimeData) : null);
  const hasOutput = $derived(Boolean(midiClip && midiClip.notes.length > 0));
  const noteCount = $derived(midiClip?.notes.length ?? 0);
  const skippedCount = $derived(midiClip?.skippedNotes ?? 0);
  const groupsCount = $derived(runtimeData?.midiGroups.length ?? 0);
  const pluginId = $derived(data.sourceId ?? runtimeData?.pluginId ?? "");

  const basePixelsPerBeat = 42;
  const baseNoteRowHeight = 8;
  const rollLeftGutter = 40;
  const rollTopGutter = 18;
  const rollPadding = 8;
  const minZoom = 0.55;
  const maxZoom = 2.25;
  const gridOptions = [
    { value: 1 as const, label: "1/4" },
    { value: 2 as const, label: "1/8" },
    { value: 4 as const, label: "1/16" },
  ];
  let zoom = $state(1);
  let gridDivision = $state<1 | 2 | 4>(2);

  const pixelsPerBeat = $derived(basePixelsPerBeat * zoom);
  const noteRowHeight = $derived(baseNoteRowHeight * zoom);
  const zoomPercent = $derived(Math.round(zoom * 100));
  const noteRectHeight = $derived(Math.max(3, noteRowHeight - 1.5));

  const clampZoom = (value: number) => Math.min(maxZoom, Math.max(minZoom, value));
  const zoomIn = () => (zoom = clampZoom(zoom + 0.15));
  const zoomOut = () => (zoom = clampZoom(zoom - 0.15));
  const resetZoom = () => (zoom = 1);
  const setGridDivision = (next: 1 | 2 | 4) => {
    gridDivision = next;
  };

  const noteName = (pitch: number) => {
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const cls = names[((pitch % 12) + 12) % 12] ?? "C";
    const octave = Math.floor(pitch / 12) - 1;
    return `${cls}${octave}`;
  };

  const pitchRange = $derived.by(() => {
    if (!midiClip || midiClip.notes.length === 0) return { min: 48, max: 72 };
    const pitches = midiClip.notes.map((note) => note.pitch);
    return { min: Math.min(...pitches), max: Math.max(...pitches) };
  });
  const rollWidth = $derived.by(() => {
    const beats = midiClip?.lengthBeats ?? 0;
    return Math.max(360, rollLeftGutter + beats * pixelsPerBeat + rollPadding * 2);
  });
  const rollHeight = $derived.by(() => {
    const rows = pitchRange.max - pitchRange.min + 1;
    return Math.max(170, rollTopGutter + rows * noteRowHeight + rollPadding * 2);
  });
  const beatGrid = $derived.by(() => {
    const beats = Math.max(1, Math.ceil(midiClip?.lengthBeats ?? 0));
    return Array.from({ length: beats + 1 }, (_, index) => index);
  });
  const pitchLanes = $derived.by(() => {
    const lanes: Array<{
      pitch: number;
      top: number;
      label: string;
      isGuide: boolean;
      isBlackKey: boolean;
      isC: boolean;
    }> = [];
    for (let pitch = pitchRange.max; pitch >= pitchRange.min; pitch -= 1) {
      const laneIndex = pitchRange.max - pitch;
      const top = rollTopGutter + laneIndex * noteRowHeight + rollPadding;
      const pitchClass = ((pitch % 12) + 12) % 12;
      const isBlackKey = [1, 3, 6, 8, 10].includes(pitchClass);
      const isC = pitchClass === 0;
      const isGuide = pitch % 12 === 0;
      const label =
        pitch === pitchRange.max || pitch === pitchRange.min || isGuide ? noteName(pitch) : "";
      lanes.push({ pitch, top, label, isGuide, isBlackKey, isC });
    }
    return lanes;
  });
  const barLabels = $derived.by(() =>
    beatGrid
      .filter((beat) => beat % 4 === 0)
      .map((beat) => ({
        beat,
        bar: Math.floor(beat / 4) + 1,
        left: rollLeftGutter + rollPadding + beat * pixelsPerBeat,
      })),
  );
  const subdivisionGrid = $derived.by(() => {
    const maxBeat = Math.max(1, Math.ceil(midiClip?.lengthBeats ?? 0));
    const totalDivisions = maxBeat * gridDivision;
    return Array.from({ length: totalDivisions + 1 }, (_, index) => {
      const beat = index / gridDivision;
      return {
        beat,
        left: rollLeftGutter + rollPadding + beat * pixelsPerBeat,
        isBar: index % (gridDivision * 4) === 0,
        isBeat: index % gridDivision === 0,
      };
    });
  });
  const renderNotes = $derived.by(() => {
    if (!midiClip) return [];
    return midiClip.notes.map((note, index) => {
      const top = (pitchRange.max - note.pitch) * noteRowHeight + rollTopGutter + rollPadding + 1;
      const left = note.time * pixelsPerBeat + rollLeftGutter + rollPadding;
      const width = Math.max(1.5, note.duration * pixelsPerBeat);
      const hue = (note.channel * 41) % 360;
      const light = 42 + Math.round((note.velocity / 127) * 18);
      return {
        id: `${index}-${note.time}-${note.pitch}`,
        top,
        left,
        width,
        height: noteRectHeight,
        color: `hsla(${hue}, 70%, ${light}%, 0.88)`,
      };
    });
  });

  const download = () => {
    if (!midiClip || midiClip.notes.length === 0) return;
    downloadMidiClip(midiClip, data.label);
  };
</script>

<div class="plugin-node {selectedClass}">
  <div class="plugin-title">{data.label}</div>
  {#if data.pluginTargets?.length}
    <div class="plugin-target">connected to {data.pluginTargets.join(" + ")}</div>
  {/if}
  {#if pluginId}
    <div class="plugin-id">{pluginId}</div>
  {/if}
  {#if !runtimeData}
    <div class="plugin-empty">No plugin runtime data yet.</div>
  {:else if !hasOutput}
    <div class="plugin-empty">No MIDI notes mapped yet. Run the flow.</div>
  {:else}
    <div class="plugin-toolbar">
      <div class="plugin-meta">
        {noteCount} notes · {groupsCount} groups
        {#if skippedCount > 0}
          · skipped {skippedCount}
        {/if}
      </div>
      <div class="plugin-actions">
        <div class="grid-controls" aria-label="Grid density (visual only)">
          <span>Grid</span>
          {#each gridOptions as option (option.value)}
            <button
              type="button"
              class={`grid-btn ${gridDivision === option.value ? "is-active" : ""}`}
              onclick={() => setGridDivision(option.value)}
            >
              {option.label}
            </button>
          {/each}
        </div>
        <Button variant="ghost" type="button" onclick={zoomOut}>-</Button>
        <button class="zoom-readout" type="button" onclick={resetZoom}>{zoomPercent}%</button>
        <Button variant="ghost" type="button" onclick={zoomIn}>+</Button>
        <Button variant="ghost" type="button" onclick={download}>Download MIDI</Button>
      </div>
    </div>

    <div class="roll-wrap" role="region" aria-label="MIDI piano roll preview">
      <div class="roll" style={`width:${rollWidth}px; height:${rollHeight}px;`}>
        <div class="roll-gutter"></div>
        {#each pitchLanes as lane (lane.pitch)}
          <div
            class={`roll-lane-band ${lane.isBlackKey ? "is-black" : ""} ${lane.isC ? "is-c" : ""}`}
            style={`top:${lane.top}px; height:${noteRowHeight}px;`}
          ></div>
          <div
            class={`roll-lane ${lane.isGuide ? "is-guide" : ""}`}
            style={`top:${lane.top + noteRowHeight}px;`}
          ></div>
          {#if lane.label}
            <div class="roll-lane-label" style={`top:${lane.top - 5}px;`}>{lane.label}</div>
          {/if}
        {/each}
        {#each barLabels as label (label.beat)}
          <div class="roll-bar-label" style={`left:${label.left + 3}px;`}>Bar {label.bar}</div>
        {/each}
        {#each subdivisionGrid as division (`${division.beat}`)}
          <div
            class={`roll-grid-line ${division.isBar ? "is-bar" : division.isBeat ? "is-beat" : "is-subdivision"}`}
            style={`left:${division.left}px;`}
          ></div>
        {/each}
        {#each renderNotes as note (note.id)}
          <div
            class="roll-note"
            style={`left:${note.left}px; top:${note.top}px; width:${note.width}px; height:${note.height}px; background:${note.color};`}
          ></div>
        {/each}
      </div>
    </div>
    {#if skippedCount > 0}
      <div class="plugin-warn">
        Notes were skipped due to invalid pitch/time/duration values in connector output.
      </div>
    {/if}
  {/if}
  <Handle type="source" position={Position.Bottom} id="out" />
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .plugin-node {
    @apply min-w-[320px] rounded-md border border-white/10 bg-black/80 px-3 py-2 text-white/75 shadow-lg;
  }

  .plugin-node.is-selected {
    @apply border-emerald-400/60 text-emerald-100;
    box-shadow:
      0 0 0 1px rgba(52, 211, 153, 0.3),
      0 12px 24px rgba(0, 0, 0, 0.4);
  }

  .plugin-title {
    @apply text-[0.65rem] font-semibold uppercase tracking-[0.2em];
  }

  .plugin-target {
    @apply mt-1 text-[0.55rem] uppercase tracking-[0.2em] text-white/50;
  }

  .plugin-id {
    @apply mt-1 text-[0.52rem] tracking-[0.17em] text-emerald-300/70;
  }

  .plugin-empty {
    @apply mt-3 text-[0.55rem] uppercase tracking-[0.2em] text-white/40;
  }

  .plugin-toolbar {
    @apply mt-3 flex items-center justify-between gap-2;
  }

  .plugin-actions {
    @apply flex items-center gap-1;
  }

  .grid-controls {
    @apply mr-2 flex items-center gap-1 text-[0.5rem] uppercase tracking-[0.14em] text-white/45;
  }

  .grid-btn {
    @apply rounded-md border border-white/20 px-1.5 py-1 text-[0.5rem] tracking-[0.12em] text-white/65;
  }

  .grid-btn:hover {
    @apply border-white/35 text-white/85;
  }

  .grid-btn.is-active {
    @apply border-emerald-300/60 text-emerald-100;
    background: rgba(16, 185, 129, 0.18);
  }

  .zoom-readout {
    @apply rounded-md border border-white/20 px-2 py-1 text-[0.55rem] tracking-[0.12em] text-white/70;
  }

  .zoom-readout:hover {
    @apply border-white/35 text-white;
  }

  .plugin-meta {
    @apply text-[0.55rem] uppercase tracking-[0.18em] text-white/55;
  }

  .roll-wrap {
    @apply mt-3 max-h-[220px] overflow-auto rounded-md border border-white/10 bg-black/55;
    overscroll-behavior: contain;
  }

  .roll {
    @apply relative;
  }

  .roll-gutter {
    @apply absolute bottom-0 left-0 top-0 w-[40px] border-r border-white/10 bg-black/70;
  }

  .roll-lane-band {
    @apply absolute left-[40px] right-0;
    background: rgba(255, 255, 255, 0.02);
  }

  .roll-lane-band.is-black {
    background: rgba(255, 255, 255, 0.055);
  }

  .roll-lane-band.is-c {
    background: rgba(16, 185, 129, 0.09);
  }

  .roll-lane {
    @apply absolute left-[40px] right-0 h-px bg-white/6;
  }

  .roll-lane.is-guide {
    @apply bg-emerald-300/20;
  }

  .roll-lane-label {
    @apply absolute left-2 text-[0.48rem] tracking-[0.14em] text-white/45;
  }

  .roll-bar-label {
    @apply absolute top-0 text-[0.46rem] tracking-[0.14em] text-white/45;
  }

  .roll-grid-line {
    @apply absolute bottom-0 top-[18px] w-px bg-white/10;
  }

  .roll-grid-line.is-bar {
    @apply bg-white/35;
  }

  .roll-grid-line.is-beat {
    @apply bg-white/18;
  }

  .roll-grid-line.is-subdivision {
    @apply bg-white/8;
  }

  .roll-note {
    @apply absolute h-[7px] rounded-[2px] shadow-sm;
  }

  .plugin-warn {
    @apply mt-2 text-[0.5rem] tracking-[0.16em] text-amber-300/85;
  }
</style>
