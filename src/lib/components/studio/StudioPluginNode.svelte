<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { browser } from "$app/environment";
  import { Handle, NodeResizer, Position, type Node, type NodeProps } from "@xyflow/svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import {
    formatMidiSkippedReason,
    midiChannelColor,
    midiNoteName,
    type MidiSkippedNoteReason,
  } from "$lib/midi/midiClip";
  import { downloadMidiClip, pluginRuntimeToMidiClip } from "$lib/studio/plugins/midiExport";
  import {
    SALAMANDER_GRAND_PIANO_SAMPLE_BASE_URL,
    SALAMANDER_GRAND_PIANO_SAMPLE_URLS,
  } from "$lib/studio/plugins/salamanderGrandPiano";
  import type { StudioPluginRuntimeData } from "$lib/studio/plugins/runtime";

  type PluginNodeData = {
    label: string;
    sourceId?: string;
    pluginData?: StudioPluginRuntimeData;
    pluginTargets?: string[];
  };

  type PluginNode = Node<PluginNodeData, "plugin">;
  type PlaybackInstrumentMode = "analog-synth" | "grand-piano";
  type PlaybackInstrument = import("tone").PolySynth | import("tone").Sampler;

  const { data, selected }: NodeProps<PluginNode> = $props();
  const selectedClass = $derived(selected ? "is-selected" : "");
  const runtimeData = $derived<StudioPluginRuntimeData | null>(data.pluginData ?? null);
  let tempoSetting = $state(120);
  const midiClip = $derived(
    runtimeData ? pluginRuntimeToMidiClip(runtimeData, { tempo: tempoSetting }) : null,
  );
  const hasOutput = $derived(Boolean(midiClip && midiClip.notes.length > 0));
  const noteCount = $derived(midiClip?.notes.length ?? 0);
  const skippedCount = $derived(midiClip?.skippedNotes ?? 0);
  const groupsCount = $derived(runtimeData?.midiGroups.length ?? 0);
  const pluginId = $derived(data.sourceId ?? runtimeData?.pluginId ?? "");
  const tempo = $derived(midiClip?.tempo ?? 120);
  const channelCount = $derived(midiClip?.channels ?? 1);

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
  let isAudioReady = $state(false);
  let isPlaying = $state(false);
  let showPlayhead = $state(false);
  let audioStatus = $state("Click Play to enable audio");
  let playheadBeat = $state(0);
  let instrumentMode = $state<PlaybackInstrumentMode>("analog-synth");
  let playbackRunId = 0;
  let toneModule: typeof import("tone") | null = null;
  let playbackInstrument: PlaybackInstrument | null = null;
  let rafId: number | null = null;
  let lastRuntimeData: StudioPluginRuntimeData | null | undefined = undefined;

  const pixelsPerBeat = $derived(basePixelsPerBeat * zoom);
  const noteRowHeight = $derived(baseNoteRowHeight * zoom);
  const zoomPercent = $derived(Math.round(zoom * 100));
  const noteRectHeight = $derived(Math.max(3, noteRowHeight - 1.5));
  const clipLengthBeats = $derived(Math.max(1, midiClip?.lengthBeats ?? 0));
  const playheadLeft = $derived(rollLeftGutter + rollPadding + playheadBeat * pixelsPerBeat);

  const clampZoom = (value: number) => Math.min(maxZoom, Math.max(minZoom, value));
  const zoomIn = () => (zoom = clampZoom(zoom + 0.15));
  const zoomOut = () => (zoom = clampZoom(zoom - 0.15));
  const resetZoom = () => (zoom = 1);
  const setGridDivision = (next: 1 | 2 | 4) => {
    gridDivision = next;
  };
  const setTempo = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement | null;
    const value = Number(input?.value);
    if (!Number.isFinite(value)) return;
    const nextTempo = Math.max(10, Math.min(300, Math.round(value)));
    if (tempoSetting === nextTempo) return;
    stopPlayback();
    tempoSetting = nextTempo;
  };
  const setInstrumentMode = (nextMode: PlaybackInstrumentMode) => {
    if (instrumentMode === nextMode) return;
    instrumentMode = nextMode;
    stopPlayback();
    disposePlaybackInstrument();
  };

  const disposePlaybackInstrument = () => {
    playbackInstrument?.dispose();
    playbackInstrument = null;
  };

  const resetTransport = (tone: typeof import("tone")) => {
    const resetTime = tone.immediate();
    tone.Transport.stop(resetTime);
    tone.Transport.cancel(0);
  };

  const stopPlayback = () => {
    playbackRunId += 1;
    if (toneModule) {
      resetTransport(toneModule);
    }
    disposePlaybackInstrument();
    if (rafId && browser) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    isPlaying = false;
    showPlayhead = false;
    playheadBeat = 0;
    audioStatus = isAudioReady ? "Audio ready" : "Click Play to enable audio";
  };

  const ensureTone = async () => {
    if (!browser) return false;
    if (!toneModule) {
      toneModule = await import("tone");
    }
    await toneModule.start();
    isAudioReady = true;
    audioStatus = "Audio ready";
    return true;
  };

  const createPlaybackInstrument = async (
    tone: typeof import("tone"),
    runId: number,
  ): Promise<PlaybackInstrument | null> => {
    disposePlaybackInstrument();

    if (instrumentMode === "grand-piano") {
      audioStatus = "Loading grand piano samples";
      const sampler = new tone.Sampler({
        urls: SALAMANDER_GRAND_PIANO_SAMPLE_URLS,
        baseUrl: SALAMANDER_GRAND_PIANO_SAMPLE_BASE_URL,
        attack: 0,
        release: 1,
      }).toDestination();
      playbackInstrument = sampler;
      await tone.loaded();
      return runId === playbackRunId ? sampler : null;
    }

    const synth = new tone.PolySynth(tone.Synth, {
      envelope: { attack: 0, decay: 0.1, sustain: 0.4, release: 0.4 },
    }).toDestination();
    playbackInstrument = synth;
    return synth;
  };

  const beatsToTransportTicks = (tone: typeof import("tone"), beats: number) =>
    `${Math.max(0, Math.round(beats * tone.Transport.PPQ))}i`;

  const updatePlayhead = () => {
    if (!browser || !toneModule || !midiClip) return;
    const transport = toneModule.Transport;
    const currentTicks = transport.getTicksAtTime(toneModule.immediate());
    playheadBeat = Math.max(0, currentTicks / transport.PPQ);
    if (transport.state === "started") {
      audioStatus = "Playing";
    }
    if (playheadBeat >= midiClip.lengthBeats) {
      stopPlayback();
      return;
    }
    rafId = window.requestAnimationFrame(updatePlayhead);
  };

  const scheduleMidi = async (runId: number): Promise<{ totalBeats: number } | null> => {
    const tone = toneModule;
    const clip = midiClip;
    if (!tone || !clip || clip.notes.length === 0) return null;

    const transport = tone.Transport;
    resetTransport(tone);
    transport.loop = false;
    transport.bpm.value = clip.tempo;
    const instrument = await createPlaybackInstrument(tone, runId);
    if (!instrument || runId !== playbackRunId) return null;

    const secondsPerBeat = 60 / clip.tempo;
    clip.notes.forEach((note) => {
      const durationSeconds = Math.max(0.02, note.duration * secondsPerBeat);
      const durationBeats = durationSeconds / secondsPerBeat;
      const velocity = Math.min(1, Math.max(0, note.velocity / 127));
      const pitch = midiNoteName(note.pitch);

      transport.schedule(
        (time) => {
          if (runId !== playbackRunId) return;
          instrument.triggerAttackRelease(
            pitch,
            beatsToTransportTicks(tone, durationBeats),
            time,
            velocity,
          );
        },
        beatsToTransportTicks(tone, note.time),
      );
    });

    return { totalBeats: Math.max(0, clip.lengthBeats) };
  };

  const play = async () => {
    if (!midiClip || midiClip.notes.length === 0) return;
    const runId = playbackRunId + 1;
    playbackRunId = runId;
    const ready = await ensureTone();
    if (!ready || !toneModule || runId !== playbackRunId) return;
    const tone = toneModule;
    const scheduled = await scheduleMidi(runId);
    if (!scheduled || runId !== playbackRunId) return;
    playheadBeat = 0;
    isPlaying = true;
    showPlayhead = true;
    audioStatus = "Starting";
    if (browser) {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(updatePlayhead);
    }
    tone.Transport.start(tone.now() + 0.05, "0i");
  };

  const pitchRange = $derived.by(() => {
    if (!midiClip || midiClip.notes.length === 0) return { min: 48, max: 72 };
    const pitches = midiClip.notes.map((note) => note.pitch);
    let min = Math.min(...pitches);
    let max = Math.max(...pitches);
    if (max - min < 12) {
      min = Math.max(0, min - 6);
      max = Math.min(127, max + 6);
    }
    return { min, max };
  });
  const rollWidth = $derived.by(() => {
    return Math.max(360, rollLeftGutter + clipLengthBeats * pixelsPerBeat + rollPadding * 2);
  });
  const rollHeight = $derived.by(() => {
    const rows = pitchRange.max - pitchRange.min + 1;
    return Math.max(170, rollTopGutter + rows * noteRowHeight + rollPadding * 2);
  });
  const beatGrid = $derived.by(() => {
    const beats = Math.max(1, Math.ceil(clipLengthBeats));
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
        pitch === pitchRange.max || pitch === pitchRange.min || isGuide ? midiNoteName(pitch) : "";
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
    const maxBeat = Math.max(1, Math.ceil(clipLengthBeats));
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
      return {
        id: `${index}-${note.time}-${note.pitch}`,
        top,
        left,
        width,
        height: noteRectHeight,
        color: midiChannelColor(note.channel, note.velocity),
        title: `${midiNoteName(note.pitch)} · beat ${note.time} · duration ${note.duration} · velocity ${note.velocity} · ${note.groupPath}`,
      };
    });
  });

  const diagnosticLines = $derived.by(() => {
    if (!midiClip) return [];
    const lines = midiClip.diagnostics.flatMap((diagnostic) => {
      const label = diagnostic.groupPath === "/" ? "root group" : diagnostic.groupPath;
      const current: string[] = [];
      if (diagnostic.missing.length > 0) {
        current.push(`${label}: missing ${diagnostic.missing.join(", ")}`);
      }
      const reasonSummary = Object.entries(diagnostic.skippedReasons).map(
        ([reason, count]) => `${count} ${formatMidiSkippedReason(reason as MidiSkippedNoteReason)}`,
      );
      if (reasonSummary.length > 0) {
        current.push(`${label}: skipped ${reasonSummary.join(", ")}`);
      }
      return current;
    });
    return lines.slice(0, 4);
  });
  const hiddenDiagnosticCount = $derived.by(() => {
    if (!midiClip) return 0;
    const totalLines = midiClip.diagnostics.reduce((count, diagnostic) => {
      const missingLine = diagnostic.missing.length > 0 ? 1 : 0;
      const skippedLine = Object.keys(diagnostic.skippedReasons).length > 0 ? 1 : 0;
      return count + missingLine + skippedLine;
    }, 0);
    return Math.max(0, totalLines - diagnosticLines.length);
  });

  const download = () => {
    if (!midiClip || midiClip.notes.length === 0) return;
    downloadMidiClip(midiClip, data.label);
  };

  $effect(() => {
    const currentRuntimeData = runtimeData;
    if (currentRuntimeData === lastRuntimeData) return;
    const hadPreviousRuntimeData = lastRuntimeData !== undefined;
    lastRuntimeData = currentRuntimeData;
    if (hadPreviousRuntimeData) {
      untrack(() => stopPlayback());
    }
  });

  onDestroy(() => {
    stopPlayback();
    disposePlaybackInstrument();
  });
</script>

<div class="plugin-node {selectedClass}">
  <NodeResizer
    isVisible={selected}
    minWidth={360}
    minHeight={260}
    color="#34d399"
    handleClass="plugin-resize-handle"
    lineClass="plugin-resize-line"
  />
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
    <div class="plugin-empty">No MIDI notes mapped yet.</div>
    {#if diagnosticLines.length}
      <div class="plugin-diagnostics">
        {#each diagnosticLines as line (line)}
          <div>{line}</div>
        {/each}
        {#if hiddenDiagnosticCount > 0}
          <div>+ {hiddenDiagnosticCount} more issue{hiddenDiagnosticCount === 1 ? "" : "s"}</div>
        {/if}
      </div>
    {:else}
      <div class="plugin-empty">Run the flow to generate plugin data.</div>
    {/if}
  {:else}
    <div class="plugin-toolbar">
      <div class="plugin-meta">
        {noteCount} notes · {groupsCount} groups · {channelCount} channels · {tempo} BPM
        {#if skippedCount > 0}
          · skipped {skippedCount}
        {/if}
      </div>
      <div class="plugin-actions">
        <Button variant="ghost" type="button" onclick={play} disabled={isPlaying}>Play</Button>
        <Button variant="ghost" type="button" onclick={stopPlayback} disabled={!isPlaying}
          >Stop</Button
        >
        <label class="tempo-control">
          <span>Tempo</span>
          <input
            type="number"
            min="10"
            max="300"
            step="1"
            value={tempoSetting}
            oninput={setTempo}
          />
        </label>
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
        <div class="sound-controls" aria-label="Playback sound">
          <button
            type="button"
            class={`sound-btn ${instrumentMode === "analog-synth" ? "is-active" : ""}`}
            onclick={() => setInstrumentMode("analog-synth")}
          >
            Synth
          </button>
          <button
            type="button"
            class={`sound-btn ${instrumentMode === "grand-piano" ? "is-active" : ""}`}
            onclick={() => setInstrumentMode("grand-piano")}
          >
            Piano
          </button>
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
        {#if isPlaying && showPlayhead}
          <div class="roll-playhead" style={`left:${playheadLeft}px;`}></div>
        {/if}
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
            title={note.title}
          ></div>
        {/each}
      </div>
    </div>
    <div class="plugin-audio-status">{audioStatus}</div>
    {#if skippedCount > 0}
      <div class="plugin-diagnostics">
        {#each diagnosticLines as line (line)}
          <div>{line}</div>
        {/each}
        {#if hiddenDiagnosticCount > 0}
          <div>+ {hiddenDiagnosticCount} more issue{hiddenDiagnosticCount === 1 ? "" : "s"}</div>
        {/if}
      </div>
    {/if}
  {/if}
  <Handle type="source" position={Position.Bottom} id="out" />
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .plugin-node {
    @apply relative flex h-full min-h-[260px] w-full min-w-[360px] flex-col overflow-hidden rounded-md border border-white/10 bg-black/80 px-3 py-2 text-white/75 shadow-lg;
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

  .plugin-diagnostics {
    @apply mt-2 space-y-1 rounded-md border border-amber-300/20 bg-amber-300/8 px-2 py-2 text-[0.5rem] leading-relaxed tracking-[0.12em] text-amber-100/85;
  }

  .plugin-audio-status {
    @apply mt-2 text-[0.48rem] uppercase tracking-[0.16em] text-white/45;
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

  .sound-controls {
    @apply mr-2 flex items-center gap-1 text-[0.5rem] uppercase tracking-[0.14em] text-white/45;
  }

  .tempo-control {
    @apply mr-2 flex items-center gap-1 text-[0.5rem] uppercase tracking-[0.14em] text-white/45;
  }

  .tempo-control input {
    @apply w-14 rounded-md border border-white/20 bg-black/45 px-1.5 py-1 text-[0.55rem] tracking-normal text-white/80 outline-none;
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

  .sound-btn {
    @apply rounded-md border border-white/20 px-1.5 py-1 text-[0.5rem] tracking-[0.12em] text-white/65;
  }

  .sound-btn:hover {
    @apply border-white/35 text-white/85;
  }

  .sound-btn.is-active {
    @apply border-cyan-300/60 text-cyan-100;
    background: rgba(34, 211, 238, 0.16);
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
    @apply mt-3 min-h-[170px] flex-1 overflow-auto rounded-md border border-white/10 bg-black/55;
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

  .roll-playhead {
    @apply absolute bottom-0 top-0 z-10 w-[2px] bg-emerald-300/75 shadow-[0_0_14px_rgba(16,185,129,0.65)];
  }

  .roll-note {
    @apply absolute h-[7px] rounded-[2px] shadow-sm;
  }

  :global(.plugin-resize-handle) {
    width: 9px;
    height: 9px;
    z-index: 30;
    border: 1px solid rgba(16, 185, 129, 0.9);
    border-radius: 2px;
    background: rgba(3, 7, 18, 0.95);
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.45);
  }

  :global(.plugin-resize-line) {
    z-index: 25;
    border-color: rgba(52, 211, 153, 0.42);
  }

  :global(.plugin-resize-line.svelte-flow__resize-control.line.left),
  :global(.plugin-resize-line.svelte-flow__resize-control.line.right) {
    width: 12px;
  }

  :global(.plugin-resize-line.svelte-flow__resize-control.line.top),
  :global(.plugin-resize-line.svelte-flow__resize-control.line.bottom) {
    height: 12px;
  }

  :global(.plugin-resize-line.svelte-flow__resize-control.line.left) {
    background: linear-gradient(
      to right,
      rgba(52, 211, 153, 0),
      rgba(52, 211, 153, 0.18) 45%,
      rgba(52, 211, 153, 0.42) 50%,
      rgba(52, 211, 153, 0.18) 55%,
      rgba(52, 211, 153, 0)
    );
  }

  :global(.plugin-resize-line.svelte-flow__resize-control.line.right) {
    background: linear-gradient(
      to right,
      rgba(52, 211, 153, 0),
      rgba(52, 211, 153, 0.18) 45%,
      rgba(52, 211, 153, 0.42) 50%,
      rgba(52, 211, 153, 0.18) 55%,
      rgba(52, 211, 153, 0)
    );
  }

  :global(.plugin-resize-line.svelte-flow__resize-control.line.top) {
    background: linear-gradient(
      to bottom,
      rgba(52, 211, 153, 0),
      rgba(52, 211, 153, 0.18) 45%,
      rgba(52, 211, 153, 0.42) 50%,
      rgba(52, 211, 153, 0.18) 55%,
      rgba(52, 211, 153, 0)
    );
  }

  :global(.plugin-resize-line.svelte-flow__resize-control.line.bottom) {
    background: linear-gradient(
      to bottom,
      rgba(52, 211, 153, 0),
      rgba(52, 211, 153, 0.18) 45%,
      rgba(52, 211, 153, 0.42) 50%,
      rgba(52, 211, 153, 0.18) 55%,
      rgba(52, 211, 153, 0)
    );
  }
</style>
