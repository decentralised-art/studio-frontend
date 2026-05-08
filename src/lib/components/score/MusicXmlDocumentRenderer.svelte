<script lang="ts">
  import { browser } from "$app/environment";
  import { onDestroy, tick } from "svelte";

  import Button from "$lib/components/ui/Button.svelte";
  import { downloadMusicXml } from "$lib/score/musicXmlSerializer";

  type OsmdInstance = {
    load: (musicXml: string) => Promise<unknown>;
    render: () => void | Promise<void>;
    clear?: () => void;
    Zoom: number;
  };

  type Props = {
    musicXml: string;
    label?: string;
    statsText?: string;
    showToolbar?: boolean;
    showDownload?: boolean;
    initialZoom?: number;
    emptyMessage?: string;
    frameLabel?: string;
  };

  const {
    musicXml,
    label = "MusicXML score",
    statsText = "",
    showToolbar = true,
    showDownload = false,
    initialZoom = 0.82,
    emptyMessage = "No MusicXML payload has been received.",
    frameLabel = "Music score preview",
  }: Props = $props();

  let scoreContainer: HTMLDivElement | null = $state(null);
  let renderStatus = $state<"idle" | "loading" | "ready" | "error">("idle");
  let renderMessage = $state("");
  let renderRunId = 0;
  let osmd: OsmdInstance | null = null;

  const hasMusicXml = $derived(Boolean(musicXml));

  const formatRenderError = (error: unknown): string => {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "object" && error && "message" in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message;
    }
    return "The score renderer could not load this MusicXML.";
  };

  const download = () => {
    if (!musicXml) return;
    downloadMusicXml(musicXml, label);
  };

  $effect(() => {
    const container = scoreContainer;
    const currentMusicXml = musicXml;
    const currentZoom = initialZoom;

    if (!browser || !container || !currentMusicXml) {
      renderRunId += 1;
      osmd?.clear?.();
      renderStatus = currentMusicXml ? "idle" : "error";
      renderMessage = currentMusicXml ? "" : emptyMessage;
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
        await osmd.load(currentMusicXml);
        if (currentRunId !== renderRunId) return;
        await osmd.render();
        renderStatus = "ready";
        renderMessage = "";
      } catch (error) {
        if (currentRunId !== renderRunId) return;
        renderStatus = "error";
        renderMessage = formatRenderError(error);
        console.error(`[HyperMusic Score Renderer] Renderer failed for ${label}`, {
          label,
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

<div class="score-document">
  {#if !hasMusicXml}
    <div class="score-empty-frame" aria-label="Empty music score preview">
      <div class="score-empty-staff" aria-hidden="true">
        {#each Array.from({ length: 5 }, (_, index) => index) as line (line)}
          <span></span>
        {/each}
      </div>
      <div class="score-empty-message">{emptyMessage}</div>
    </div>
  {:else}
    {#if showToolbar}
      <div class="score-toolbar">
        <div class="score-meta">{statsText || label}</div>
        {#if showDownload}
          <div class="score-actions">
            <Button variant="ghost" type="button" className="btn-compact" onclick={download}
              >Download MusicXML</Button
            >
          </div>
        {/if}
      </div>
    {/if}

    <div class="score-frame" aria-busy={renderStatus === "loading"}>
      {#if renderStatus === "loading"}
        <div class="score-render-status">{renderMessage}</div>
      {:else if renderStatus === "error" && renderMessage}
        <div class="score-render-status is-error">{renderMessage}</div>
      {/if}
      <div bind:this={scoreContainer} class="score-osmd" aria-label={frameLabel}></div>
    </div>
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .score-document {
    @apply flex min-h-0 flex-1 flex-col;
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
    @apply relative flex min-h-[190px] flex-1 items-start overflow-hidden rounded-md border border-white/10 bg-white px-5 py-10;
  }

  .score-empty-message {
    @apply absolute bottom-3 left-5 right-5 text-[0.55rem] uppercase tracking-[0.16em] text-slate-500;
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

  :global(:root[data-theme="light"] .score-render-status) {
    background: var(--surface-floating-hover) !important;
    border-color: var(--border-subtle) !important;
    color: var(--text-primary) !important;
  }
</style>
