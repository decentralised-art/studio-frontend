<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { browser } from "$app/environment";

  import Button from "$lib/components/ui/Button.svelte";
  import type { MidiParticle } from "$lib/particles/ptMidiAdapter";

  const { midi }: { midi: MidiParticle | null } = $props();

  const basePixelsPerBeat = 72;
  const baseNoteHeight = 12;
  const minRollHeight = 200;
  const paddingX = 12;
  const paddingY = 10;
  const minZoom = 0.6;
  const maxZoom = 2.2;

  let isReady = $state(false);
  let isPlaying = $state(false);
  let status = $state("Click Play to enable audio");
  let zoom = $state(1);
  let playheadX = $state(0);
  let rollWidth = $state(0);
  let rollHeight = $state(minRollHeight);

  let rollViewport = $state<HTMLDivElement | null>(null);
  let rollCanvas = $state<HTMLCanvasElement | null>(null);
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

  const getPitchBounds = () => {
    if (!midi || midi.notes.length === 0) {
      return { min: 48, max: 72 };
    }
    const pitches = midi.notes.map((note) => note.pitch);
    let min = Math.min(...pitches);
    let max = Math.max(...pitches);
    if (max - min < 12) {
      min = Math.max(0, min - 6);
      max = Math.min(127, max + 6);
    }
    return { min, max };
  };

  const colorForChannel = (channel: number, velocity: number) => {
    const hue = (channel * 42) % 360;
    const lightness = 42 + Math.round((velocity / 127) * 18);
    return `hsla(${hue}, 70%, ${lightness}%, 0.85)`;
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

  const drawRoll = () => {
    if (!rollCanvas || !rollViewport || !midi) return;
    const pixelsPerBeat = basePixelsPerBeat * zoom;
    const noteHeight = baseNoteHeight * zoom;
    const { min, max } = getPitchBounds();
    const pitchCount = max - min + 1;

    const viewportWidth = rollViewport.clientWidth || 320;
    const width = Math.max(viewportWidth, midi.lengthBeats * pixelsPerBeat + paddingX * 2);
    const height = Math.max(minRollHeight, pitchCount * noteHeight + paddingY * 2);

    rollWidth = width;
    rollHeight = height;

    const ctx = rollCanvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    rollCanvas.width = width * dpr;
    rollCanvas.height = height * dpr;
    rollCanvas.style.width = `${width}px`;
    rollCanvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
    ctx.fillRect(0, 0, width, height);

    const totalBeats = Math.ceil(midi.lengthBeats || 0);
    for (let beat = 0; beat <= totalBeats; beat += 1) {
      const x = paddingX + beat * pixelsPerBeat;
      ctx.strokeStyle = beat % 4 === 0 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.moveTo(x, paddingY);
      ctx.lineTo(x, height - paddingY);
      ctx.stroke();
    }

    for (let i = 0; i < pitchCount; i += 1) {
      const y = paddingY + i * noteHeight;
      if ((max - i) % 12 === 0) {
        ctx.fillStyle = "rgba(16,185,129,0.07)";
        ctx.fillRect(paddingX, y, width - paddingX * 2, noteHeight);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.beginPath();
      ctx.moveTo(paddingX, y);
      ctx.lineTo(width - paddingX, y);
      ctx.stroke();
    }

    midi.notes.forEach((note) => {
      const x = paddingX + note.time * pixelsPerBeat;
      const w = Math.max(2, note.duration * pixelsPerBeat);
      const pitchIndex = max - note.pitch;
      const y = paddingY + pitchIndex * noteHeight + 1;
      const h = noteHeight - 2;
      ctx.fillStyle = colorForChannel(note.channel, note.velocity);
      ctx.fillRect(x, y, w, h);
    });
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
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.4 },
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
    const secondsPerBeat = 60 / (midi.tempo || 120);
    const beat = toneModule.Transport.seconds / secondsPerBeat;
    playheadX = paddingX + beat * pixelsPerBeat;
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
    drawRoll();
    playheadX = paddingX;
  };

  $effect(() => {
    if (!midi) return;
    redraw();
    if (!isReady) return;
    scheduleMidi();
  });

  onMount(() => {
    if (!browser || !rollViewport) return;
    resizeObserver = new ResizeObserver(() => {
      redraw();
    });
    resizeObserver.observe(rollViewport);
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

<div class="tone-preview">
  <div class="tone-controls">
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
    <p class="empty">Re-run PT to generate MIDI data.</p>
  {:else}
    <div class="roll-frame">
      <div class="roll-viewport" bind:this={rollViewport} onwheel={handleWheel}>
        <div class="roll-content" style={`height:${rollHeight}px; width:${rollWidth}px;`}>
          <canvas bind:this={rollCanvas} class="roll-canvas"></canvas>
          <div class="playhead" style={`left:${playheadX}px;`}></div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .tone-preview {
    @apply w-full space-y-4;
  }

  .tone-controls {
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

  .roll-frame {
    @apply rounded-2xl border border-white/10 bg-black/30 p-3;
  }

  .roll-viewport {
    @apply relative w-full overflow-x-auto overflow-y-auto;
    max-height: 280px;
  }

  .roll-content {
    @apply relative;
  }

  .roll-canvas {
    display: block;
  }

  .playhead {
    @apply absolute top-0 bottom-0 w-[2px] bg-emerald-300/70 shadow-[0_0_18px_rgba(16,185,129,0.6)];
  }
</style>
