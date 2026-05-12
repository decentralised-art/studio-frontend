<script lang="ts">
  import { onMount, tick } from "svelte";

  import { ChainApiRequestError } from "$lib/chain/registryApi";
  import {
    buildMidiClipFromStreamGroups,
    formatMidiSkippedReason,
    midiChannelColor,
    midiNoteName,
    type MidiSkippedNoteReason,
  } from "$lib/midi/midiClip";
  import { encodeMidiClip } from "$lib/studio/plugins/midiExport";
  import {
    groupMidiStreams,
    pathContainsAnyConnectorName,
    pathStartsWithAnyConnectorPrefix,
  } from "$lib/studio/plugins/runtime";
  import {
    decodeMidiDynamicRiQueryParam,
    executeMidiWorldRun,
    normalizeMidiParticlesCount,
  } from "$lib/worlds/midiWorldRun";
  import { MIDI_CLIP_WORLD, MIDI_CLIP_WORLD_ID } from "$lib/worlds/registry";
  import {
    isWorldStateMessage,
    WORLD_ERROR_MESSAGE_TYPE,
    WORLD_PROTOCOL_VERSION,
    WORLD_READY_MESSAGE_TYPE,
    WORLD_RENDERED_MESSAGE_TYPE,
    type WorldRuntimeInput,
  } from "$lib/worlds/types";

  let runtimeInput = $state<WorldRuntimeInput | null>(null);
  let errorMessage = $state("");
  let standaloneStatus = $state("");
  let tempoSetting = $state(120);

  const label = $derived(runtimeInput?.label ?? MIDI_CLIP_WORLD.name);
  const showDownload = $derived(Boolean(runtimeInput) && runtimeInput?.surface !== "studio-plugin");
  const selectedConnectorContextNames = $derived(runtimeInput?.selectedConnectorContextNames ?? []);
  const selectedConnectorContextPathPrefixes = $derived(
    runtimeInput?.selectedConnectorContextPathPrefixes ?? [],
  );
  const hasLineageSelection = $derived(
    selectedConnectorContextPathPrefixes.length > 0 || selectedConnectorContextNames.length > 0,
  );
  const streams = $derived.by(() =>
    (runtimeInput?.executeOutput ?? []).map((stream) => ({
      feature_path: stream.path,
      data: [...stream.data],
    })),
  );
  const midiGroups = $derived.by(() => groupMidiStreams(streams));
  const midiClip = $derived.by(() =>
    buildMidiClipFromStreamGroups(
      midiGroups.map((group) => ({
        groupPath: group.groupPath,
        pitch: group.pitch ? { path: group.pitch.feature_path, data: group.pitch.data } : undefined,
        time: group.time ? { path: group.time.feature_path, data: group.time.data } : undefined,
        duration: group.duration
          ? { path: group.duration.feature_path, data: group.duration.data }
          : undefined,
        velocity: group.velocity
          ? { path: group.velocity.feature_path, data: group.velocity.data }
          : undefined,
      })),
      { tempo: tempoSetting },
    ),
  );
  const hasOutput = $derived(midiClip.notes.length > 0);
  const statsText = $derived(
    runtimeInput?.artifacts?.midiStatsText ??
      (standaloneStatus ||
        `${midiClip.notes.length} notes | ${midiGroups.length} groups | ${midiClip.channels} channels | ${midiClip.tempo} BPM`),
  );

  const rollLeftGutter = 38;
  const rollTopGutter = 18;
  const rollPadding = 8;
  const pixelsPerBeat = 38;
  const noteRowHeight = 7;
  const noteRectHeight = 5.5;
  const clipLengthBeats = $derived(Math.max(1, midiClip.lengthBeats));
  const pitchRange = $derived.by(() => {
    if (!midiClip.notes.length) return { min: 48, max: 72 };
    const pitches = midiClip.notes.map((note) => note.pitch);
    let min = Math.min(...pitches);
    let max = Math.max(...pitches);
    if (max - min < 12) {
      min = Math.max(0, min - 6);
      max = Math.min(127, max + 6);
    }
    return { min, max };
  });
  const rollWidth = $derived(
    Math.max(360, rollLeftGutter + clipLengthBeats * pixelsPerBeat + rollPadding * 2),
  );
  const rollHeight = $derived(
    Math.max(
      180,
      rollTopGutter + (pitchRange.max - pitchRange.min + 1) * noteRowHeight + rollPadding * 2,
    ),
  );
  const beatGrid = $derived.by(() =>
    Array.from({ length: Math.max(1, Math.ceil(clipLengthBeats)) + 1 }, (_, index) => index),
  );
  const pitchLanes = $derived.by(() => {
    const lanes: Array<{
      pitch: number;
      top: number;
      label: string;
      isBlackKey: boolean;
      isC: boolean;
    }> = [];
    for (let pitch = pitchRange.max; pitch >= pitchRange.min; pitch -= 1) {
      const laneIndex = pitchRange.max - pitch;
      const top = rollTopGutter + laneIndex * noteRowHeight + rollPadding;
      const pitchClass = ((pitch % 12) + 12) % 12;
      const isBlackKey = [1, 3, 6, 8, 10].includes(pitchClass);
      const isC = pitchClass === 0;
      const label =
        pitch === pitchRange.max || pitch === pitchRange.min || isC ? midiNoteName(pitch) : "";
      lanes.push({ pitch, top, label, isBlackKey, isC });
    }
    return lanes;
  });
  const hasLineagePrefixMatch = $derived.by(() => {
    if (selectedConnectorContextPathPrefixes.length === 0) return false;
    return midiClip.notes.some((note) =>
      (note.sourcePaths ?? []).some((path) =>
        pathStartsWithAnyConnectorPrefix(path, selectedConnectorContextPathPrefixes),
      ),
    );
  });
  const pathMatchesSelectedConnectorContext = (path: string) =>
    selectedConnectorContextPathPrefixes.length > 0 && hasLineagePrefixMatch
      ? pathStartsWithAnyConnectorPrefix(path, selectedConnectorContextPathPrefixes)
      : pathContainsAnyConnectorName(path, selectedConnectorContextNames);
  const renderNotes = $derived.by(() =>
    midiClip.notes.map((note, index) => {
      const isLineageHighlighted =
        hasLineageSelection &&
        (note.sourcePaths ?? []).some((path) => pathMatchesSelectedConnectorContext(path));
      const top = (pitchRange.max - note.pitch) * noteRowHeight + rollTopGutter + rollPadding + 1;
      const left = note.time * pixelsPerBeat + rollLeftGutter + rollPadding;
      const width = Math.max(2, note.duration * pixelsPerBeat);
      return {
        id: `${index}-${note.time}-${note.pitch}-${note.channel}`,
        top,
        left,
        width,
        color: midiChannelColor(note.channel, note.velocity),
        highlighted: isLineageHighlighted,
        dimmed: hasLineageSelection && !isLineageHighlighted,
        title: `${midiNoteName(note.pitch)} | beat ${note.time} | duration ${note.duration} | velocity ${note.velocity} | ${note.groupPath}${isLineageHighlighted ? " | selected connector lineage" : ""}`,
      };
    }),
  );
  const diagnosticLines = $derived.by(() =>
    midiClip.diagnostics
      .flatMap((diagnostic) => {
        const group = diagnostic.groupPath === "/" ? "root group" : diagnostic.groupPath;
        const lines: string[] = [];
        if (diagnostic.missing.length)
          lines.push(`${group}: missing ${diagnostic.missing.join(", ")}`);
        const skipped = Object.entries(diagnostic.skippedReasons).map(
          ([reason, count]) =>
            `${count} ${formatMidiSkippedReason(reason as MidiSkippedNoteReason)}`,
        );
        if (skipped.length) lines.push(`${group}: skipped ${skipped.join(", ")}`);
        return lines;
      })
      .slice(0, 4),
  );

  const getErrorMessage = (error: unknown) => {
    const responseBody =
      error instanceof ChainApiRequestError && typeof error.responseBody === "string"
        ? error.responseBody
        : "";
    return (
      responseBody || (error instanceof Error ? error.message : "Could not render this world.")
    );
  };

  const postReady = () => {
    window.parent.postMessage(
      {
        type: WORLD_READY_MESSAGE_TYPE,
        worldId: MIDI_CLIP_WORLD_ID,
        protocolVersion: WORLD_PROTOCOL_VERSION,
      },
      "*",
    );
  };

  const postRendered = () => {
    window.parent.postMessage(
      {
        type: WORLD_RENDERED_MESSAGE_TYPE,
        worldId: MIDI_CLIP_WORLD_ID,
        requestId: runtimeInput?.requestId,
      },
      "*",
    );
  };

  const postError = (message: string) => {
    window.parent.postMessage(
      {
        type: WORLD_ERROR_MESSAGE_TYPE,
        worldId: MIDI_CLIP_WORLD_ID,
        message,
      },
      "*",
    );
  };

  const downloadMidi = () => {
    if (!hasOutput || typeof document === "undefined") return;
    const bytes = encodeMidiClip(midiClip);
    const blobPayload = new Uint8Array(bytes.byteLength);
    blobPayload.set(bytes);
    const blob = new Blob([blobPayload.buffer], { type: "audio/midi" });
    if (typeof URL.createObjectURL !== "function") return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(label || "hypermusic-midi-world").replace(/[^a-z0-9._-]+/gi, "_")}.mid`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const loadStandaloneQuery = async () => {
    const params = new URLSearchParams(window.location.search);
    const connectorName = params.get("connector")?.trim();
    if (!connectorName) return;

    try {
      errorMessage = "";
      standaloneStatus = "Running connector";
      const result = await executeMidiWorldRun({
        connectorName,
        particlesCount: normalizeMidiParticlesCount(params.get("particles")),
        dynamicRiInput: decodeMidiDynamicRiQueryParam(params.get("ri")),
        surface: "world-page",
        worldName: MIDI_CLIP_WORLD.name,
      });
      runtimeInput = result.worldInput;
      standaloneStatus = "Rendered from URL runtime values";
    } catch (error) {
      errorMessage = getErrorMessage(error);
      standaloneStatus = "Run failed";
      postError(errorMessage);
    }
  };

  $effect(() => {
    const input = runtimeInput;
    if (!input) return;
    void tick().then(postRendered);
  });

  onMount(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!isWorldStateMessage(event.data)) return;
      if (event.data.payload.worldId !== MIDI_CLIP_WORLD_ID) {
        errorMessage = "This world runtime received state for an incompatible world.";
        postError(errorMessage);
        return;
      }
      errorMessage = "";
      runtimeInput = event.data.payload;
    };

    window.addEventListener("message", handleMessage);
    postReady();
    void loadStandaloneQuery();
    return () => window.removeEventListener("message", handleMessage);
  });
</script>

<svelte:head>
  <title>MIDI World</title>
</svelte:head>

<main class="runtime-page">
  {#if errorMessage}
    <div class="runtime-error">{errorMessage}</div>
  {:else}
    <header class="runtime-toolbar">
      <div>
        <h1>{label}</h1>
        <p>{statsText}</p>
      </div>
      <div class="runtime-actions">
        <label>
          <span>Tempo</span>
          <input type="number" min="10" max="300" step="1" bind:value={tempoSetting} />
        </label>
        {#if showDownload}
          <button type="button" disabled={!hasOutput} onclick={downloadMidi}>Download MIDI</button>
        {/if}
      </div>
    </header>

    <section class="roll-wrap" aria-label="MIDI piano roll preview">
      {#if !hasOutput}
        <div class="empty-state">No MIDI notes mapped yet.</div>
      {:else}
        <div class="roll" style={`width:${rollWidth}px; height:${rollHeight}px;`}>
          <div class="roll-gutter"></div>
          {#each pitchLanes as lane (lane.pitch)}
            <div
              class={`roll-lane-band ${lane.isBlackKey ? "is-black" : ""} ${lane.isC ? "is-c" : ""}`}
              style={`top:${lane.top}px; height:${noteRowHeight}px;`}
            ></div>
            <div class="roll-lane" style={`top:${lane.top + noteRowHeight}px;`}></div>
            {#if lane.label}
              <div class="roll-lane-label" style={`top:${lane.top - 5}px;`}>{lane.label}</div>
            {/if}
          {/each}
          {#each beatGrid as beat (beat)}
            <div
              class={`roll-grid-line ${beat % 4 === 0 ? "is-bar" : "is-beat"}`}
              style={`left:${rollLeftGutter + rollPadding + beat * pixelsPerBeat}px;`}
            ></div>
            {#if beat % 4 === 0}
              <div
                class="roll-bar-label"
                style={`left:${rollLeftGutter + rollPadding + beat * pixelsPerBeat + 3}px;`}
              >
                Bar {Math.floor(beat / 4) + 1}
              </div>
            {/if}
          {/each}
          {#each renderNotes as note (note.id)}
            <div
              class={`roll-note ${note.highlighted ? "is-lineage-highlighted" : ""} ${note.dimmed ? "is-lineage-dimmed" : ""}`}
              style={`left:${note.left}px; top:${note.top}px; width:${note.width}px; height:${noteRectHeight}px; background:${note.color};`}
              title={note.title}
            ></div>
          {/each}
        </div>
      {/if}
    </section>

    {#if diagnosticLines.length}
      <section class="diagnostics" aria-label="MIDI diagnostics">
        {#each diagnosticLines as line (line)}
          <div>{line}</div>
        {/each}
      </section>
    {/if}
  {/if}
</main>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .runtime-page {
    @apply flex h-screen min-h-0 flex-col gap-2 overflow-hidden bg-slate-950 p-2 text-white;
  }

  .runtime-error {
    @apply flex h-full items-center justify-center rounded-md border border-rose-300/25 bg-rose-950/50 px-4 text-center text-xs uppercase tracking-[0.16em] text-rose-100;
  }

  .runtime-toolbar {
    @apply flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/45 px-3 py-2;
  }

  .runtime-toolbar h1 {
    @apply m-0 truncate text-sm font-semibold;
  }

  .runtime-toolbar p {
    @apply m-0 mt-1 text-[0.58rem] uppercase tracking-[0.16em] text-white/55;
  }

  .runtime-actions {
    @apply flex shrink-0 items-center gap-2;
  }

  .runtime-actions label {
    @apply flex items-center gap-1 text-[0.56rem] uppercase tracking-[0.14em] text-white/50;
  }

  .runtime-actions input {
    @apply w-14 rounded-md border border-white/15 bg-white/8 px-1.5 py-1 text-xs text-white outline-none;
  }

  .runtime-actions button {
    @apply rounded-md border border-emerald-300/30 bg-emerald-300/12 px-2.5 py-1.5 text-[0.58rem] uppercase tracking-[0.14em] text-emerald-100 transition;
  }

  .runtime-actions button:hover:not(:disabled) {
    @apply border-emerald-200/60 bg-emerald-300/20;
  }

  .runtime-actions button:disabled {
    @apply cursor-not-allowed opacity-35;
  }

  .roll-wrap {
    @apply min-h-0 flex-1 overflow-auto rounded-md border border-white/10 bg-black/70;
    overscroll-behavior: contain;
  }

  .empty-state {
    @apply flex h-full items-center justify-center px-4 text-center text-xs uppercase tracking-[0.16em] text-white/38;
  }

  .roll {
    @apply relative;
  }

  .roll-gutter {
    @apply absolute bottom-0 left-0 top-0 w-[38px] border-r border-white/10 bg-black/70;
  }

  .roll-lane-band {
    @apply absolute left-[38px] right-0;
    background: rgba(255, 255, 255, 0.022);
  }

  .roll-lane-band.is-black {
    background: rgba(255, 255, 255, 0.058);
  }

  .roll-lane-band.is-c {
    background: rgba(52, 211, 153, 0.095);
  }

  .roll-lane {
    @apply absolute left-[38px] right-0 h-px bg-white/7;
  }

  .roll-lane-label {
    @apply absolute left-2 text-[0.48rem] tracking-[0.12em] text-white/45;
  }

  .roll-grid-line {
    @apply absolute bottom-0 top-[18px] w-px bg-white/12;
  }

  .roll-grid-line.is-bar {
    @apply bg-white/35;
  }

  .roll-bar-label {
    @apply absolute top-0 text-[0.46rem] tracking-[0.14em] text-white/45;
  }

  .roll-note {
    @apply absolute rounded-[2px] shadow-sm;
  }

  .roll-note.is-lineage-highlighted {
    @apply z-[6] outline outline-2 outline-amber-200/95;
    filter: saturate(1.45) brightness(1.28);
    box-shadow:
      0 0 0 1px rgba(251, 191, 36, 0.68),
      0 0 14px rgba(251, 191, 36, 0.58);
  }

  .roll-note.is-lineage-dimmed {
    opacity: 0.1;
    filter: saturate(0.55);
  }

  .diagnostics {
    @apply rounded-md border border-amber-300/20 bg-amber-300/8 px-2 py-1.5 text-[0.55rem] leading-relaxed tracking-[0.1em] text-amber-100/85;
  }
</style>
