<script lang="ts">
  import { browser } from "$app/environment";
  import { onDestroy, tick } from "svelte";

  import Button from "$lib/components/ui/Button.svelte";
  import { downloadMusicXml } from "$lib/score/musicXmlSerializer";
  import type { ScoreRenderedNote } from "$lib/score/types";
  import {
    pathContainsAnyConnectorName,
    pathStartsWithAnyConnectorPrefix,
  } from "$lib/studio/plugins/runtime";

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
    renderedNotes?: ScoreRenderedNote[];
    selectedConnectorContextNames?: string[];
    selectedConnectorContextPathPrefixes?: string[];
  };

  let {
    musicXml,
    label = "MusicXML score",
    statsText = "",
    showToolbar = true,
    showDownload = false,
    initialZoom = 0.82,
    emptyMessage = "No MusicXML payload has been received.",
    frameLabel = "Music score preview",
    renderedNotes = [],
    selectedConnectorContextNames = [],
    selectedConnectorContextPathPrefixes = [],
  }: Props = $props();

  let scoreContainer: HTMLDivElement | null = $state(null);
  let renderStatus = $state<"idle" | "loading" | "ready" | "error">("idle");
  let renderMessage = $state("");
  let renderRunId = 0;
  let osmd: OsmdInstance | null = null;

  const hasMusicXml = $derived(Boolean(musicXml));
  const hasLineageSelection = $derived(
    selectedConnectorContextPathPrefixes.length > 0 || selectedConnectorContextNames.length > 0,
  );
  const hasLineagePrefixMatch = $derived.by(() => {
    if (selectedConnectorContextPathPrefixes.length === 0) return false;
    return renderedNotes.some((note) =>
      note.sourcePaths.some((path) =>
        pathStartsWithAnyConnectorPrefix(path, selectedConnectorContextPathPrefixes),
      ),
    );
  });
  const renderedNoteLineageMatches = $derived.by(() =>
    renderedNotes.map((note) =>
      note.sourcePaths.some((path) =>
        selectedConnectorContextPathPrefixes.length > 0 && hasLineagePrefixMatch
          ? pathStartsWithAnyConnectorPrefix(path, selectedConnectorContextPathPrefixes)
          : pathContainsAnyConnectorName(path, selectedConnectorContextNames),
      ),
    ),
  );

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

  const uniqueElements = (elements: SVGElement[]): SVGElement[] => [...new Set(elements)];

  const collectRenderedNoteElements = (): SVGElement[] => {
    if (!scoreContainer) return [];

    const noteheadGroups = Array.from(
      scoreContainer.querySelectorAll<SVGElement>("g.vf-notehead, g[class*='vf-notehead']"),
    );
    if (noteheadGroups.length > 0) return uniqueElements(noteheadGroups);

    const noteheadDescendants = Array.from(
      scoreContainer.querySelectorAll<SVGElement>(".vf-notehead, [class*='vf-notehead']"),
    )
      .map((element) => element.closest("g") as SVGElement | null)
      .filter((element): element is SVGElement => Boolean(element));
    if (noteheadDescendants.length > 0) return uniqueElements(noteheadDescendants);

    return Array.from(
      scoreContainer.querySelectorAll<SVGElement>("g.vf-stavenote, g[class*='vf-stavenote']"),
    );
  };

  const clearRenderedNoteLineageClasses = () => {
    if (!scoreContainer) return;
    scoreContainer
      .querySelectorAll(".hm-score-note-highlighted, .hm-score-note-dimmed")
      .forEach((element) => {
        element.classList.remove("hm-score-note-highlighted", "hm-score-note-dimmed");
      });
  };

  const applyRenderedNoteLineage = (
    matches = renderedNoteLineageMatches,
    shouldHighlight = hasLineageSelection,
  ) => {
    clearRenderedNoteLineageClasses();
    if (!shouldHighlight || matches.length === 0) return;

    const noteElements = collectRenderedNoteElements();
    noteElements.forEach((element, index) => {
      const isHighlighted = Boolean(matches[index]);
      element.classList.toggle("hm-score-note-highlighted", isHighlighted);
      element.classList.toggle("hm-score-note-dimmed", !isHighlighted);
    });
  };

  const scheduleRenderedNoteLineage = (
    matches = renderedNoteLineageMatches,
    shouldHighlight = hasLineageSelection,
  ) => {
    const activeRunId = renderRunId;

    void tick().then(() => {
      if (activeRunId !== renderRunId) return;
      applyRenderedNoteLineage(matches, shouldHighlight);
      if (!browser) return;

      window.requestAnimationFrame(() => {
        if (activeRunId === renderRunId) applyRenderedNoteLineage(matches, shouldHighlight);
      });
      window.setTimeout(() => {
        if (activeRunId === renderRunId) applyRenderedNoteLineage(matches, shouldHighlight);
      }, 80);
    });
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
        if (currentRunId === renderRunId) scheduleRenderedNoteLineage();
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

  $effect(() => {
    const currentRenderStatus = renderStatus;
    const currentMatches = renderedNoteLineageMatches;
    const currentHasLineageSelection = hasLineageSelection;
    if (currentRenderStatus !== "ready") return;
    scheduleRenderedNoteLineage(currentMatches, currentHasLineageSelection);
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

  .score-osmd :global(.hm-score-note-highlighted) {
    opacity: 1;
  }

  .score-osmd :global(.hm-score-note-highlighted *) {
    fill: #0f766e !important;
    stroke: #0f766e !important;
  }

  .score-osmd :global(.hm-score-note-dimmed) {
    opacity: 0.16;
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
