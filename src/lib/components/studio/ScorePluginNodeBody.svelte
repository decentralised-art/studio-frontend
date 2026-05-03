<script lang="ts">
  import { browser } from "$app/environment";
  import { onDestroy, tick } from "svelte";

  import Button from "$lib/components/ui/Button.svelte";
  import { downloadMusicXml } from "$lib/score/musicXmlSerializer";
  import type { ScoreDiagnostic } from "$lib/score/types";
  import { buildScorePluginRuntimeData } from "$lib/studio/plugins/scoreRuntime";
  import type { StudioPluginRuntimeData } from "$lib/studio/plugins/runtime";

  type OsmdInstance = {
    load: (musicXml: string) => Promise<unknown>;
    render: () => void | Promise<void>;
    clear?: () => void;
    Zoom: number;
  };

  type Props = {
    label: string;
    runtimeData: StudioPluginRuntimeData | null;
  };

  const { label, runtimeData }: Props = $props();

  let scoreContainer: HTMLDivElement | null = $state(null);
  let renderStatus = $state<"idle" | "loading" | "ready" | "error">("idle");
  let renderMessage = $state("");
  let zoom = $state(0.82);
  let renderRunId = 0;
  let osmd: OsmdInstance | null = null;

  const scoreData = $derived(runtimeData ? buildScorePluginRuntimeData(runtimeData) : null);
  const hasMusicXml = $derived(Boolean(scoreData?.musicXml));
  const diagnostics = $derived<ScoreDiagnostic[]>(scoreData?.diagnostics ?? []);
  const visibleDiagnostics = $derived(diagnostics.slice(0, 5));
  const hiddenDiagnosticCount = $derived(
    Math.max(0, diagnostics.length - visibleDiagnostics.length),
  );
  const statsText = $derived.by(() => {
    if (!scoreData) return "";
    const { stats } = scoreData;
    return `${stats.noteCount} notes · ${stats.measureCount} measures · ${stats.partCount} parts · ${stats.adapterId}`;
  });
  const zoomPercent = $derived(Math.round(zoom * 100));

  const clampZoom = (value: number) => Math.min(1.8, Math.max(0.45, value));
  const zoomIn = () => (zoom = clampZoom(zoom + 0.08));
  const zoomOut = () => (zoom = clampZoom(zoom - 0.08));
  const resetZoom = () => (zoom = 0.82);

  const download = () => {
    if (!scoreData?.musicXml) return;
    downloadMusicXml(scoreData.musicXml, label);
  };

  $effect(() => {
    const container = scoreContainer;
    const musicXml = scoreData?.musicXml ?? "";
    const currentZoom = zoom;

    if (!browser || !container || !musicXml) {
      renderRunId += 1;
      osmd?.clear?.();
      renderStatus = musicXml ? "idle" : "error";
      renderMessage = musicXml ? "" : "No score notation could be built from the current output.";
      return;
    }

    const currentRunId = renderRunId + 1;
    renderRunId = currentRunId;

    void (async () => {
      try {
        renderStatus = "loading";
        renderMessage = "Rendering score";
        await tick();
        if (currentRunId !== renderRunId) return;

        const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");
        if (currentRunId !== renderRunId) return;

        osmd?.clear?.();
        osmd = new OpenSheetMusicDisplay(container, {
          autoResize: true,
          backend: "svg",
          drawTitle: false,
          drawingParameters: "compacttight",
        }) as OsmdInstance;
        osmd.Zoom = currentZoom;
        await osmd.load(musicXml);
        if (currentRunId !== renderRunId) return;
        await osmd.render();
        renderStatus = "ready";
        renderMessage = "";
      } catch (error) {
        if (currentRunId !== renderRunId) return;
        renderStatus = "error";
        renderMessage =
          error instanceof Error
            ? error.message
            : "The score renderer could not load this MusicXML.";
      }
    })();
  });

  onDestroy(() => {
    renderRunId += 1;
    osmd?.clear?.();
    osmd = null;
  });
</script>

<div class="score-shell">
  {#if !runtimeData}
    <div class="score-empty">No plugin runtime data yet.</div>
  {:else if !hasMusicXml}
    <div class="score-empty">{renderMessage}</div>
  {:else}
    <div class="score-toolbar">
      <div class="score-meta">{statsText}</div>
      <div class="score-actions">
        <Button variant="ghost" type="button" onclick={zoomOut}>-</Button>
        <button class="score-zoom-readout" type="button" onclick={resetZoom}>{zoomPercent}%</button>
        <Button variant="ghost" type="button" onclick={zoomIn}>+</Button>
        <Button variant="ghost" type="button" onclick={download}>Download MusicXML</Button>
      </div>
    </div>

    <div class="score-frame" aria-busy={renderStatus === "loading"}>
      {#if renderStatus === "loading"}
        <div class="score-render-status">{renderMessage}</div>
      {:else if renderStatus === "error" && renderMessage}
        <div class="score-render-status is-error">{renderMessage}</div>
      {/if}
      <div bind:this={scoreContainer} class="score-osmd" aria-label="Music score preview"></div>
    </div>
  {/if}

  {#if visibleDiagnostics.length}
    <div class="score-diagnostics">
      {#each visibleDiagnostics as diagnostic (`${diagnostic.code}-${diagnostic.message}-${diagnostic.path ?? ""}`)}
        <div class={`score-diagnostic is-${diagnostic.level}`}>
          <span>{diagnostic.level}</span>
          {diagnostic.message}
        </div>
      {/each}
      {#if hiddenDiagnosticCount > 0}
        <div class="score-diagnostic">
          + {hiddenDiagnosticCount} more issue{hiddenDiagnosticCount === 1 ? "" : "s"}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .score-shell {
    @apply mt-3 flex min-h-0 flex-1 flex-col;
  }

  .score-toolbar {
    @apply flex items-center justify-between gap-2;
  }

  .score-meta {
    @apply text-[0.55rem] uppercase tracking-[0.18em] text-white/55;
  }

  .score-actions {
    @apply flex items-center gap-1;
  }

  .score-zoom-readout {
    @apply rounded-md border border-white/20 px-2 py-1 text-[0.55rem] tracking-[0.12em] text-white/70;
  }

  .score-zoom-readout:hover {
    @apply border-white/35 text-white;
  }

  .score-frame {
    @apply relative mt-3 min-h-[190px] flex-1 overflow-auto rounded-md border border-white/10 bg-white;
    overscroll-behavior: contain;
  }

  .score-osmd {
    @apply min-h-[190px] min-w-[480px] p-4;
  }

  .score-render-status {
    @apply absolute right-2 top-2 z-10 rounded-md border border-white/15 bg-black/70 px-2 py-1 text-[0.52rem] uppercase tracking-[0.16em] text-white/70;
  }

  .score-render-status.is-error {
    @apply border-rose-300/30 bg-rose-950/80 text-rose-100;
  }

  .score-empty {
    @apply mt-3 text-[0.55rem] uppercase tracking-[0.2em] text-white/40;
  }

  .score-diagnostics {
    @apply mt-2 space-y-1 rounded-md border border-amber-300/20 bg-amber-300/8 px-2 py-2 text-[0.5rem] leading-relaxed tracking-[0.12em] text-amber-100/85;
  }

  .score-diagnostic span {
    @apply mr-1 font-semibold uppercase;
  }

  :global(:root[data-theme="light"] .score-meta),
  :global(:root[data-theme="light"] .score-empty) {
    color: var(--text-muted) !important;
  }

  :global(:root[data-theme="light"] .score-frame) {
    background: #ffffff !important;
    border-color: var(--studio-node-border) !important;
  }

  :global(:root[data-theme="light"] .score-zoom-readout) {
    background: var(--studio-node-bg-soft) !important;
    border-color: var(--studio-node-border) !important;
    color: var(--text-secondary) !important;
  }

  :global(:root[data-theme="light"] .score-zoom-readout:hover) {
    background: var(--studio-node-bg-hover) !important;
    border-color: var(--studio-node-border-strong) !important;
    color: var(--text-primary) !important;
  }

  :global(:root[data-theme="light"] .score-render-status) {
    background: var(--surface-floating-hover) !important;
    border-color: var(--border-subtle) !important;
    color: var(--text-primary) !important;
  }

  :global(:root[data-theme="light"] .score-diagnostics) {
    background: rgba(217, 119, 6, 0.1) !important;
    border-color: rgba(217, 119, 6, 0.28) !important;
    color: #92400e !important;
  }
</style>
