<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { browser } from "$app/environment";

  import Button from "$lib/components/ui/Button.svelte";
  import type { MidiNote, MidiParticle } from "$lib/particles/ptMidiAdapter";

  const { midi }: { midi: MidiParticle | null } = $props();

  const basePixelsPerBeat = 72;
  const basePaddingX = 16;
  const baseStaffLineSpacing = 12;
  const baseStaffGap = 28;
  const baseStaffPadding = 14;
  const minScoreHeight = 240;
  const baseNoteHeadWidth = 10;
  const baseNoteHeadHeight = 7;
  const baseClefWidth = 26;
  const baseClefPadding = 10;
  const minZoom = 0.7;
  const maxZoom = 2;

  const pitchClassToLetterIndex = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  const trebleBaseDiatonic = 4 * 7 + 2; // E4 bottom line
  const trebleTopDiatonic = trebleBaseDiatonic + 8; // F5 top line
  const bassBaseDiatonic = 2 * 7 + 4; // G2 bottom line
  const bassTopDiatonic = bassBaseDiatonic + 8; // A3 top line
  const trebleStemPivotPitch = 71; // B4
  const bassStemPivotPitch = 50; // D3
  const splitPitch = 60; // Middle C and above goes to treble

  let isReady = $state(false);
  let isPlaying = $state(false);
  let status = $state("Click Play to enable audio");
  let zoom = $state(1);
  let playheadX = $state(0);
  let scoreWidth = $state(0);
  let scoreHeight = $state(minScoreHeight);

  let scoreViewport = $state<HTMLDivElement | null>(null);
  let scoreCanvas = $state<HTMLCanvasElement | null>(null);
  let resizeObserver: ResizeObserver | null = null;
  let rafId: number | null = null;

  let toneModule: typeof import("tone") | null = null;
  let synths: Array<import("tone").PolySynth | import("tone").Synth> = [];

  const disposeSynths = () => {
    synths.forEach((synth) => synth.dispose());
    synths = [];
  };

  const ensureTone = async () => {
    if (!browser) return;
    if (!toneModule) {
      toneModule = await import("tone");
    }
    await toneModule.start();
    isReady = true;
    status = "Audio ready";
  };

  const getDiatonic = (pitch: number) => {
    const octave = Math.floor(pitch / 12) - 1;
    const letterIndex = pitchClassToLetterIndex[pitch % 12] ?? 0;
    return octave * 7 + letterIndex;
  };

  const splitNotes = (notes: MidiNote[]) => ({
    treble: notes.filter((note) => note.pitch >= splitPitch),
    bass: notes.filter((note) => note.pitch < splitPitch),
  });

  const colorForChannel = (channel: number, velocity: number) => {
    const hue = (channel * 48) % 360;
    const lightness = 46 + Math.round((velocity / 127) * 18);
    return `hsla(${hue}, 70%, ${lightness}%, 0.9)`;
  };

  const clampZoom = (value: number) => Math.min(maxZoom, Math.max(minZoom, value));

  const handleZoomIn = () => {
    zoom = clampZoom(zoom + 0.15);
    redraw();
  };

  const handleZoomOut = () => {
    zoom = clampZoom(zoom - 0.15);
    redraw();
  };

  const handleWheel = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey && !event.altKey) return;
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    zoom = clampZoom(zoom + direction * 0.08);
    redraw();
  };

  const drawLedgerLines = (
    ctx: CanvasRenderingContext2D,
    x: number,
    diatonic: number,
    staffBase: number,
    staffTop: number,
    staffBottomY: number,
    ledgerWidth: number,
    stepHeightPx: number,
  ) => {
    if (diatonic < staffBase) {
      for (let step = staffBase - 2; step >= diatonic; step -= 2) {
        const y = staffBottomY - (step - staffBase) * stepHeightPx;
        ctx.beginPath();
        ctx.moveTo(x - ledgerWidth / 2, y);
        ctx.lineTo(x + ledgerWidth / 2, y);
        ctx.stroke();
      }
    }

    if (diatonic > staffTop) {
      for (let step = staffTop + 2; step <= diatonic; step += 2) {
        const y = staffBottomY - (step - staffBase) * stepHeightPx;
        ctx.beginPath();
        ctx.moveTo(x - ledgerWidth / 2, y);
        ctx.lineTo(x + ledgerWidth / 2, y);
        ctx.stroke();
      }
    }
  };

  const drawScore = () => {
    if (!scoreCanvas || !scoreViewport || !midi) return;
    const pixelsPerBeat = basePixelsPerBeat * zoom;
    const paddingX = basePaddingX * zoom;
    const staffLineSpacing = baseStaffLineSpacing * zoom;
    const staffGap = baseStaffGap * zoom;
    const staffPadding = baseStaffPadding * zoom;
    const noteHeadWidth = baseNoteHeadWidth * zoom;
    const noteHeadHeight = baseNoteHeadHeight * zoom;
    const clefWidth = baseClefWidth * zoom;
    const clefPadding = baseClefPadding * zoom;
    const clefX = paddingX + 2 * zoom;
    const noteStartX = paddingX + clefWidth + clefPadding;
    const stepHeightPx = staffLineSpacing / 2;
    const ledgerWidth = noteHeadWidth + 6 * zoom;

    const { treble: trebleNotes, bass: bassNotes } = splitNotes(midi.notes);
    const viewportWidth = scoreViewport.clientWidth || 320;
    const width = Math.max(viewportWidth, noteStartX + midi.lengthBeats * pixelsPerBeat + paddingX);

    const trebleDiatonics =
      trebleNotes.length > 0 ? trebleNotes.map((note) => getDiatonic(note.pitch)) : [];
    const bassDiatonics =
      bassNotes.length > 0 ? bassNotes.map((note) => getDiatonic(note.pitch)) : [];

    const trebleMin = trebleDiatonics.length
      ? Math.min(...trebleDiatonics, trebleBaseDiatonic)
      : trebleBaseDiatonic;
    const trebleMax = trebleDiatonics.length
      ? Math.max(...trebleDiatonics, trebleTopDiatonic)
      : trebleTopDiatonic;
    const bassMin = bassDiatonics.length
      ? Math.min(...bassDiatonics, bassBaseDiatonic)
      : bassBaseDiatonic;
    const bassMax = bassDiatonics.length
      ? Math.max(...bassDiatonics, bassTopDiatonic)
      : bassTopDiatonic;

    const trebleExtraAbove = Math.max(0, trebleMax - trebleTopDiatonic);
    const trebleExtraBelow = Math.max(0, trebleBaseDiatonic - trebleMin);
    const bassExtraAbove = Math.max(0, bassMax - bassTopDiatonic);
    const bassExtraBelow = Math.max(0, bassBaseDiatonic - bassMin);

    const trebleBlockHeight =
      staffPadding * 2 +
      staffLineSpacing * 4 +
      (trebleExtraAbove + trebleExtraBelow) * stepHeightPx;
    const bassBlockHeight =
      staffPadding * 2 + staffLineSpacing * 4 + (bassExtraAbove + bassExtraBelow) * stepHeightPx;

    const trebleTopY = staffPadding + trebleExtraAbove * stepHeightPx;
    const trebleBottomY = trebleTopY + staffLineSpacing * 4;
    const bassTopY = trebleBlockHeight + staffGap + staffPadding + bassExtraAbove * stepHeightPx;
    const bassBottomY = bassTopY + staffLineSpacing * 4;

    const totalHeight = trebleBlockHeight + staffGap + bassBlockHeight;

    scoreWidth = width;
    scoreHeight = Math.max(minScoreHeight, totalHeight);

    const ctx = scoreCanvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    scoreCanvas.width = scoreWidth * dpr;
    scoreCanvas.height = scoreHeight * dpr;
    scoreCanvas.style.width = `${scoreWidth}px`;
    scoreCanvas.style.height = `${scoreHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, scoreWidth, scoreHeight);
    ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
    ctx.fillRect(0, 0, scoreWidth, scoreHeight);

    const totalBeats = Math.ceil(midi.lengthBeats || 0);
    for (let beat = 0; beat <= totalBeats; beat += 1) {
      const x = noteStartX + beat * pixelsPerBeat;
      ctx.strokeStyle = beat % 4 === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, scoreHeight);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;

    const drawStaff = (staffTop: number) => {
      for (let line = 0; line < 5; line += 1) {
        const y = staffTop + line * staffLineSpacing;
        ctx.beginPath();
        ctx.moveTo(paddingX, y);
        ctx.lineTo(scoreWidth - paddingX, y);
        ctx.stroke();
      }
    };

    drawStaff(trebleTopY);
    drawStaff(bassTopY);

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(noteStartX - clefPadding, trebleTopY);
    ctx.lineTo(noteStartX - clefPadding, bassBottomY);
    ctx.stroke();
    ctx.lineWidth = 1;

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `${28 * zoom}px "Bravura", "Petaluma", "Noto Music", "Apple Symbols", "Segoe UI Symbol", serif`;
    const trebleClefY =
      trebleBottomY - (getDiatonic(67) - trebleBaseDiatonic) * stepHeightPx + 6 * zoom;
    ctx.fillText("𝄞", clefX, trebleClefY);

    const bassClefY = bassBottomY - (getDiatonic(53) - bassBaseDiatonic) * stepHeightPx + 6 * zoom;
    ctx.fillText("𝄢", clefX + 2, bassClefY);

    const drawNotes = (
      notes: MidiNote[],
      staffBase: number,
      staffTop: number,
      staffBottom: number,
      stemPivot: number,
    ) => {
      notes.forEach((note) => {
        const x = noteStartX + note.time * pixelsPerBeat;
        const diatonic = getDiatonic(note.pitch);
        const y = staffBottom - (diatonic - staffBase) * stepHeightPx;
        const fill = colorForChannel(note.channel, note.velocity);

        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        drawLedgerLines(
          ctx,
          x,
          diatonic,
          staffBase,
          staffTop,
          staffBottom,
          ledgerWidth,
          stepHeightPx,
        );

        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.ellipse(x, y, noteHeadWidth / 2, noteHeadHeight / 2, -0.35, 0, Math.PI * 2);
        ctx.fill();

        const stemUp = note.pitch < stemPivot;
        const stemLength = staffLineSpacing * 3.1;
        if (note.duration <= 1.5) {
          ctx.strokeStyle = fill;
          ctx.beginPath();
          ctx.moveTo(x + (stemUp ? noteHeadWidth / 2 - 1 : -noteHeadWidth / 2 + 1), y);
          ctx.lineTo(
            x + (stemUp ? noteHeadWidth / 2 - 1 : -noteHeadWidth / 2 + 1),
            y + (stemUp ? -stemLength : stemLength),
          );
          ctx.stroke();
        }
      });
    };

    drawNotes(
      trebleNotes,
      trebleBaseDiatonic,
      trebleTopDiatonic,
      trebleBottomY,
      trebleStemPivotPitch,
    );
    drawNotes(bassNotes, bassBaseDiatonic, bassTopDiatonic, bassBottomY, bassStemPivotPitch);
  };

  const scheduleMidi = () => {
    if (!toneModule || !midi) return;

    toneModule.Transport.stop();
    toneModule.Transport.cancel(0);
    toneModule.Transport.loop = false;
    disposeSynths();

    const channelCount = Math.max(1, midi.channels || 1);
    const tempo = midi.tempo || 120;
    const secondsPerBeat = 60 / tempo;

    toneModule.Transport.bpm.value = tempo;

    for (let i = 0; i < channelCount; i += 1) {
      const synth = new toneModule.PolySynth(toneModule.Synth, {
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.5 },
      }).toDestination();
      synths.push(synth);
    }

    midi.notes.forEach((note) => {
      const channelIndex = Math.max(0, note.channel - 1);
      const synth = synths[channelIndex % synths.length];
      if (!synth) return;
      const time = Math.max(0, note.time) * secondsPerBeat;
      const duration = Math.max(0.02, note.duration * secondsPerBeat);
      const velocity = Math.min(1, Math.max(0, note.velocity / 127));
      const freq = toneModule.Frequency(note.pitch, "midi");

      toneModule.Transport.schedule((t) => {
        synth.triggerAttackRelease(freq, duration, t, velocity);
      }, time);
    });

    const totalSeconds = Math.max(0, midi.lengthBeats) * secondsPerBeat;
    if (totalSeconds > 0) {
      toneModule.Transport.scheduleOnce(() => {
        stop();
      }, totalSeconds + 0.05);
    }
  };

  const updatePlayhead = () => {
    if (!toneModule || !midi) return;
    const pixelsPerBeat = basePixelsPerBeat * zoom;
    const paddingX = basePaddingX * zoom;
    const noteStartX = paddingX + baseClefWidth * zoom + baseClefPadding * zoom;
    const secondsPerBeat = 60 / (midi.tempo || 120);
    const beat = toneModule.Transport.seconds / secondsPerBeat;
    playheadX = noteStartX + beat * pixelsPerBeat;
    rafId = window.requestAnimationFrame(updatePlayhead);
  };

  const play = async () => {
    await ensureTone();
    if (!toneModule || !midi) return;
    scheduleMidi();
    toneModule.Transport.seconds = 0;
    toneModule.Transport.start("+0.05");
    isPlaying = true;
    status = "Playing";
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = window.requestAnimationFrame(updatePlayhead);
  };

  const stop = () => {
    if (toneModule) {
      toneModule.Transport.stop();
      toneModule.Transport.cancel(0);
    }
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    isPlaying = false;
    status = isReady ? "Audio ready" : "Click Play to enable audio";
  };

  const redraw = () => {
    if (!midi) return;
    drawScore();
    const paddingX = basePaddingX * zoom;
    const noteStartX = paddingX + baseClefWidth * zoom + baseClefPadding * zoom;
    playheadX = noteStartX;
  };

  $effect(() => {
    if (!midi) return;
    redraw();
    if (!isReady) return;
    scheduleMidi();
  });

  onMount(() => {
    if (!browser || !scoreViewport) return;
    resizeObserver = new ResizeObserver(() => {
      redraw();
    });
    resizeObserver.observe(scoreViewport);
  });

  onDestroy(() => {
    if (toneModule) {
      toneModule.Transport.stop();
      toneModule.Transport.cancel(0);
    }
    disposeSynths();
    if (rafId) window.cancelAnimationFrame(rafId);
    resizeObserver?.disconnect();
  });
</script>

<div class="score-preview">
  <div class="score-controls">
    <Button variant="primary" onclick={play} disabled={!midi || isPlaying}>Play</Button>
    <Button variant="ghost" onclick={stop} disabled={!isPlaying}>Stop</Button>
    <div class="zoom-controls">
      <Button
        variant="ghost"
        onclick={handleZoomOut}
        ariaLabel="Zoom out"
        disabled={zoom <= minZoom}
      >
        -
      </Button>
      <span class="zoom-label">{Math.round(zoom * 100)}%</span>
      <Button variant="ghost" onclick={handleZoomIn} ariaLabel="Zoom in" disabled={zoom >= maxZoom}>
        +
      </Button>
    </div>
    <span class="status">{status}</span>
  </div>

  {#if !midi}
    <p class="empty">Re-run PT to generate score data.</p>
  {:else}
    <div class="score-frame">
      <div class="score-viewport" bind:this={scoreViewport} onwheel={handleWheel}>
        <div class="score-content" style={`height:${scoreHeight}px; width:${scoreWidth}px;`}>
          <canvas bind:this={scoreCanvas} class="score-canvas"></canvas>
          <div class="playhead" style={`left:${playheadX}px;`}></div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .score-preview {
    @apply w-full space-y-4;
  }

  .score-controls {
    @apply flex flex-wrap items-center gap-3;
  }

  .zoom-controls {
    @apply flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1;
  }

  .zoom-label {
    @apply text-[0.65rem] uppercase tracking-[0.18em] text-white/50;
  }

  .status {
    @apply text-xs uppercase tracking-[0.2em] text-white/40;
  }

  .empty {
    @apply text-sm text-white/50;
  }

  .score-frame {
    @apply rounded-2xl border border-white/10 bg-black/30 p-3;
  }

  .score-viewport {
    @apply relative w-full overflow-x-auto overflow-y-auto;
    max-height: 320px;
  }

  .score-content {
    @apply relative;
  }

  .score-canvas {
    display: block;
  }

  .playhead {
    @apply absolute top-0 bottom-0 w-[2px] bg-emerald-300/70 shadow-[0_0_18px_rgba(16,185,129,0.6)];
  }
</style>
