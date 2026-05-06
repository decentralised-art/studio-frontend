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
  let loggedDiagnosticSignature = "";
  let osmd: OsmdInstance | null = null;

  const scoreData = $derived(runtimeData ? buildScorePluginRuntimeData(runtimeData) : null);
  const hasMusicXml = $derived(Boolean(scoreData?.musicXml));
  const diagnostics = $derived<ScoreDiagnostic[]>(scoreData?.diagnostics ?? []);
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

  const formatRenderError = (error: unknown): string => {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "object" && error && "message" in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message;
    }
    return "The score renderer could not load this MusicXML.";
  };

  const formatDiagnosticLog = (items: readonly ScoreDiagnostic[]) =>
    items
      .map((diagnostic, index) => {
        const path = diagnostic.path ? ` path=${diagnostic.path}` : "";
        return `${index + 1}. ${diagnostic.level.toUpperCase()} ${diagnostic.code}${path}: ${diagnostic.message}`;
      })
      .join("\n");

  const download = () => {
    if (!scoreData?.musicXml) return;
    downloadMusicXml(scoreData.musicXml, label);
  };

  $effect(() => {
    if (!browser || !scoreData || diagnostics.length === 0) {
      loggedDiagnosticSignature = "";
      return;
    }

    const signature = JSON.stringify({
      label,
      adapterId: scoreData.adapterId,
      stats: scoreData.stats,
      diagnostics,
    });
    if (signature === loggedDiagnosticSignature) return;
    loggedDiagnosticSignature = signature;

    const message = `[HyperMusic Score Plugin] ${diagnostics.length} score diagnostic(s) for ${label}`;
    const payload = {
      plugin: label,
      adapterId: scoreData.adapterId,
      stats: scoreData.stats,
      diagnostics,
    };
    const copyableLog = `${message}\n${formatDiagnosticLog(diagnostics)}`;
    if (diagnostics.some((diagnostic) => diagnostic.level === "error")) {
      console.error(copyableLog, payload);
    } else {
      console.warn(copyableLog, payload);
    }
  });

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
        renderMessage = formatRenderError(error);
        console.error(`[HyperMusic Score Plugin] Renderer failed for ${label}`, {
          plugin: label,
          error,
          message: renderMessage,
        });
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
  {#if !hasMusicXml}
    <div class="score-empty-frame" aria-label="Empty music score preview">
      <div class="score-empty-staff" aria-hidden="true">
        {#each Array.from({ length: 5 }, (_, index) => index) as line (line)}
          <span></span>
        {/each}
      </div>
    </div>
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

  .score-empty-frame {
    @apply mt-3 flex min-h-[190px] flex-1 items-start overflow-hidden rounded-md border border-white/10 bg-white px-5 py-10;
  }

  .score-empty-staff {
    @apply relative mt-3 h-[48px] w-full min-w-[420px];
  }

  .score-empty-staff span {
    @apply absolute left-0 block h-px w-full bg-slate-900/80;
  }

  .score-empty-staff span:nth-child(1) {
    top: 0;
  }

  .score-empty-staff span:nth-child(2) {
    top: 12px;
  }

  .score-empty-staff span:nth-child(3) {
    top: 24px;
  }

  .score-empty-staff span:nth-child(4) {
    top: 36px;
  }

  .score-empty-staff span:nth-child(5) {
    top: 48px;
  }

  :global(:root[data-theme="light"] .score-meta) {
    color: var(--text-muted) !important;
  }

  :global(:root[data-theme="light"] .score-empty-frame),
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
</style>
