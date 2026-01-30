<script lang="ts">
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Tag from "$lib/components/ui/Tag.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import type { ExploreParticle, ParticleView } from "$lib/data/exploreParticles";
  import MidiTonePreview from "$lib/components/visualisers/MidiTonePreview.svelte";
  import MusicScorePreview from "$lib/components/visualisers/MusicScorePreview.svelte";
  import ExploreLineageMiniFlow from "$lib/components/explore/ExploreLineageMiniFlow.svelte";
  import type { MidiParticle } from "$lib/particles/ptMidiAdapter";
  import type {
    LineageEdge,
    LineageNode,
    MockRunDescriptor,
    RunInstanceInput,
  } from "$lib/particles/mockPtNetwork";
  import type { User } from "$lib/data/users";

  let {
    particle,
    author,
    view,
    midiPreview = null,
    lineageNodes = [],
    lineageEdges = [],
    runCount = "12",
    runDescriptors = [],
    runInstances = [],
    onAdd,
    onRerun,
    onAuthorSelect,
    onRunCountChange,
    onRunInstanceChange,
  }: {
    particle: ExploreParticle;
    author: User;
    view: ParticleView | null;
    midiPreview?: MidiParticle | null;
    lineageNodes?: LineageNode[];
    lineageEdges?: LineageEdge[];
    runCount?: string;
    runDescriptors?: MockRunDescriptor[];
    runInstances?: RunInstanceInput[];
    onAdd?: (particle: ExploreParticle) => void;
    onRerun?: (particle: ExploreParticle) => void;
    onAuthorSelect?: (id: User["id"]) => void;
    onRunCountChange?: (value: string) => void;
    onRunInstanceChange?: (
      index: number,
      field: "startPoint" | "transformShift",
      value: string,
    ) => void;
  } = $props();

  const handleAdd = () => onAdd?.(particle);
  const handleRerun = () => onRerun?.(particle);
  const handleAuthorSelect = () => onAuthorSelect?.(author.id);
  const isScoreView = $derived.by(() => view?.id === "music-score");
</script>

<SectionShell>
  <div class="header">
    <div class="header-content">
      <div class="meta-row">
        <Tag variant="accent">{view?.label ?? "Unknown view"}</Tag>
        <span class="mono-label">{particle.createdLabel}</span>
      </div>

      <div class="title-block">
        <h3 class="title">{particle.name}</h3>
        <p class="summary">{particle.summary}</p>
      </div>

      <p class="author-line">
        <span class="author-label">Author:</span>
        <Button type="button" variant="subtle" onclick={handleAuthorSelect}>
          {author.nickname}
        </Button>
      </p>
    </div>
  </div>
</SectionShell>

<SectionShell>
  <div class="actions">
    <Button variant="primary" onclick={handleRerun}>Re-run PT</Button>
    <Button variant="subtle" onclick={handleAdd}>Add to toolbox</Button>
  </div>

  <div class="run-controls">
    <p class="run-title">Run settings</p>
    <div class="run-grid">
      <Input
        label="Notes (N)"
        type="number"
        min="1"
        max="128"
        step="1"
        inputmode="numeric"
        value={runCount}
        oninput={(event) =>
          onRunCountChange?.((event.currentTarget as HTMLInputElement | null)?.value ?? "")}
      />
    </div>
    <p class="run-hint">
      Select a node in the lineage flow to adjust per-dimension start and shift values.
    </p>
  </div>

  <div class="preview-head">
    <div class="preview-text">
      <p class="preview-title">Particle view preview</p>
      <p class="preview-subtitle">
        Visualization for {view?.label ?? "this view"} will appear here.
      </p>
    </div>
    <Tag variant="outline">{view?.label ?? "Unknown view"}</Tag>
  </div>

  <div class="preview-box">
    {#if midiPreview}
      {#if isScoreView}
        <MusicScorePreview midi={midiPreview} />
      {:else}
        <MidiTonePreview midi={midiPreview} />
      {/if}
    {:else}
      <p>Preview window placeholder</p>
    {/if}
  </div>
</SectionShell>

<SectionShell>
  <div class="lineage-head">
    <div class="lineage-text">
      <p class="lineage-title">Performative transaction lineage</p>
      <p class="lineage-subtitle">Tree view and dependency previews will live here.</p>
    </div>
    <Tag variant="outline">{lineageNodes.length} nodes</Tag>
  </div>

  <div class="deps-box">
    {#if lineageNodes.length > 0}
      <ExploreLineageMiniFlow
        nodes={lineageNodes}
        edges={lineageEdges}
        {runDescriptors}
        {runInstances}
        {onRunInstanceChange}
      />
    {:else}
      <p class="deps-title">Dependency snapshot</p>
      <div class="deps-tags">
        {#each particle.dependencies as dependency (dependency)}
          <Tag variant="outline">{dependency}</Tag>
        {/each}
      </div>
    {/if}
  </div>
</SectionShell>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .mono-label {
    @apply text-[0.7rem] font-mono tracking-[0.28em] uppercase text-white/40;
  }

  .header {
    @apply flex flex-wrap items-start justify-between gap-4;
  }

  .header-content {
    @apply space-y-2;
  }

  .meta-row {
    @apply flex flex-wrap items-center gap-2;
  }

  .title-block {
    @apply text-left;
  }

  .title {
    @apply text-lg font-semibold text-white;
  }

  .summary {
    @apply text-sm text-white/70;
  }

  .author-line {
    @apply text-sm text-white/70 flex items-center gap-2;
  }

  .author-label {
    @apply text-sm text-white/70;
  }

  .actions {
    @apply flex flex-wrap items-center justify-end gap-2 pb-3 border-b border-white/10;
  }

  .run-controls {
    @apply mt-4 space-y-2;
  }

  .run-title {
    @apply text-[0.7rem] font-mono tracking-[0.24em] uppercase text-white/50;
  }

  .run-grid {
    @apply grid gap-3 sm:grid-cols-3;
  }

  .run-hint {
    @apply text-[0.7rem] text-white/45 leading-relaxed;
  }

  .preview-head {
    @apply flex items-center justify-between gap-3 pt-3;
  }

  .preview-text {
    @apply min-w-0;
  }

  .preview-title {
    @apply text-sm font-semibold text-white;
  }

  .preview-subtitle {
    @apply text-xs text-white/50;
  }

  .preview-box {
    @apply mt-4 rounded-2xl border border-dashed border-white/15 bg-white/5
      min-h-[260px] lg:min-h-[360px] p-6 text-sm text-white/50 text-left;
  }

  .lineage-head {
    @apply flex items-center justify-between gap-3;
  }

  .lineage-text {
    @apply min-w-0;
  }

  .lineage-title {
    @apply text-sm font-semibold text-white;
  }

  .lineage-subtitle {
    @apply text-xs text-white/50;
  }

  .deps-box {
    @apply mt-4 rounded-2xl border border-dashed border-white/15 bg-white/5
      p-4 text-xs text-white/50;
  }

  .deps-title {
    @apply mb-3 text-sm text-white/60;
  }

  .deps-tags {
    @apply flex flex-wrap gap-2;
  }
</style>
