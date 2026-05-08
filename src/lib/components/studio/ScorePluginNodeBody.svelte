<script lang="ts">
  import { browser } from "$app/environment";

  import WorldFrame from "$lib/components/worlds/WorldFrame.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import { downloadMusicXml } from "$lib/score/musicXmlSerializer";
  import type { ScoreDiagnostic } from "$lib/score/types";
  import { buildScorePluginRuntimeData } from "$lib/studio/plugins/scoreRuntime";
  import type { StudioPluginRuntimeData } from "$lib/studio/plugins/runtime";
  import { buildMusicXmlWorldInput, MUSICXML_SCORE_WORLD } from "$lib/worlds/registry";

  type Props = {
    label: string;
    runtimeData: StudioPluginRuntimeData | null;
  };

  const { label, runtimeData }: Props = $props();

  let loggedDiagnosticSignature = "";

  const scoreData = $derived(runtimeData ? buildScorePluginRuntimeData(runtimeData) : null);
  const hasMusicXml = $derived(Boolean(scoreData?.musicXml));
  const diagnostics = $derived<ScoreDiagnostic[]>(scoreData?.diagnostics ?? []);
  const statsText = $derived.by(() => {
    if (!scoreData) return "";
    const { stats } = scoreData;
    return `${stats.noteCount} notes · ${stats.measureCount} measures · ${stats.partCount} parts · ${stats.adapterId}`;
  });
  const worldInput = $derived(
    scoreData
      ? buildMusicXmlWorldInput({
          scoreData,
          label,
          surface: "studio-plugin",
          connectorTargets: runtimeData?.connectorTargets ?? [],
        })
      : null,
  );

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

    const message = `[HyperMusic Score World] ${diagnostics.length} score diagnostic(s) for ${label}`;
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
        <Button variant="ghost" type="button" onclick={download}>Download MusicXML</Button>
      </div>
    </div>

    <div class="score-world-frame">
      <WorldFrame
        world={MUSICXML_SCORE_WORLD}
        input={worldInput}
        title={`${label} MusicXML world preview`}
      />
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

  .score-world-frame {
    @apply mt-3 flex min-h-[220px] flex-1 overflow-hidden;
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

  :global(:root[data-theme="light"] .score-empty-frame) {
    background: #ffffff !important;
    border-color: var(--studio-node-border) !important;
  }
</style>
