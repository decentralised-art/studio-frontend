<script lang="ts">
  import Button from "$lib/components/ui/Button.svelte";
  import ExploreParticleDetail from "$lib/components/explore/ExploreParticleDetail.svelte";
  import ExploreParticleList from "$lib/components/explore/ExploreParticleList.svelte";
  import ExploreSidePanel from "$lib/components/explore/ExploreSidePanel.svelte";
  import ExploreUserDetail from "$lib/components/explore/ExploreUserDetail.svelte";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";
  import SelectInput from "$lib/components/ui/SelectInput.svelte";

  import {
    mockExploreParticles,
    mockParticleViews,
    type ExploreParticle,
    type ParticleView,
  } from "$lib/data/exploreParticles";

  import { ptOutputToMidi, type MidiParticle } from "$lib/particles/ptMidiAdapter";
  import {
    getMockLineageGraph,
    getMockPtOutput,
    getMockRunDescriptors,
    type MockRunningInstance,
    type RunInstanceInput,
  } from "$lib/particles/mockPtNetwork";
  import { mockUsers, mockUsersById, type User } from "$lib/data/users";

  type ViewFilter = ParticleView["id"] | "all";

  type PanelState =
    | { type: "particle"; id: ExploreParticle["id"] }
    | { type: "user"; id: User["id"] };

  const viewOptions = mockParticleViews;
  const usersById = mockUsersById;

  const particlesById = Object.fromEntries(mockExploreParticles.map((p) => [p.id, p] as const));

  let selectedViewId = $state<ViewFilter>("all");
  let selectedAuthorId = $state<string>("all");
  let selectedParticleId = $state<ExploreParticle["id"] | null>(null);
  let panelStack = $state<PanelState[]>([]);
  let midiPreviewByParticle = $state<Record<string, MidiParticle>>({});
  let runConfigByParticle = $state<
    Record<
      string,
      {
        count: string;
        instances: RunInstanceInput[];
      }
    >
  >({});

  const authorOptions = $derived.by(() =>
    [...mockUsers].sort((a, b) => a.nickname.localeCompare(b.nickname)),
  );

  const authorSelectOptions = $derived.by(() =>
    authorOptions.map((a) => ({ value: a.id, label: a.nickname }) as const),
  );

  const filteredParticles = $derived.by(() => {
    let list = [...mockExploreParticles];

    if (selectedViewId !== "all") list = list.filter((p) => p.viewId === selectedViewId);
    if (selectedAuthorId !== "all") list = list.filter((p) => p.authorId === selectedAuthorId);

    list.sort((a, b) => b.createdAt - a.createdAt);
    return list;
  });

  const selectedParticle = $derived.by(() =>
    filteredParticles.find((p) => p.id === selectedParticleId),
  );

  const activePanel = $derived.by(() => panelStack.at(-1) ?? null);

  const panelParticle = $derived.by(() =>
    activePanel?.type === "particle" ? (particlesById[activePanel.id] ?? null) : null,
  );

  const panelUser = $derived.by(() =>
    activePanel?.type === "user" ? (usersById[activePanel.id] ?? null) : null,
  );

  const panelView = $derived.by(() =>
    panelParticle ? (viewOptions.find((v) => v.id === panelParticle.viewId) ?? null) : null,
  );

  const panelAuthor = $derived.by(() =>
    panelParticle ? (usersById[panelParticle.authorId] ?? null) : null,
  );

  const panelMidiPreview = $derived.by(() =>
    panelParticle ? (midiPreviewByParticle[panelParticle.id] ?? null) : null,
  );

  const panelLineage = $derived.by(() =>
    panelParticle ? getMockLineageGraph(panelParticle.id) : null,
  );

  const panelRunDescriptors = $derived.by(() =>
    panelParticle ? getMockRunDescriptors(panelParticle.id) : [],
  );

  const panelRunConfig = $derived.by(() =>
    panelParticle ? (runConfigByParticle[panelParticle.id] ?? null) : null,
  );

  const panelRunCount = $derived.by(() => panelRunConfig?.count ?? "12");

  const panelRunInstances = $derived.by(() => panelRunConfig?.instances ?? []);

  const hasPanel = $derived.by(() => panelStack.length > 0);
  const canGoBack = $derived.by(() => panelStack.length > 1);

  const isSamePanel = (a: PanelState, b: PanelState) => a.type === b.type && a.id === b.id;

  const pushPanel = (panel: PanelState) => {
    const last = panelStack.at(-1);
    if (last && isSamePanel(last, panel)) return;
    panelStack = [...panelStack, panel];
  };

  const handleSelect = (id: ExploreParticle["id"]) => {
    selectedParticleId = id;
    pushPanel({ type: "particle", id });
    ensureRunConfig(id);
    ensurePreview(id);
  };

  const handleAuthorSelect = (id: User["id"]) => {
    pushPanel({ type: "user", id });
  };

  const handleViewFilter = (id: ViewFilter) => {
    selectedViewId = id;
  };

  const parseOptionalInt = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const clampInt = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  const ensureRunConfig = (particleId: ExploreParticle["id"]) => {
    const descriptors = getMockRunDescriptors(particleId);
    const existing = runConfigByParticle[particleId];
    if (existing && existing.instances.length === descriptors.length) return;

    const instances = descriptors.map((descriptor) => ({
      startPoint: typeof descriptor.seed === "number" ? `${descriptor.seed}` : "",
      transformShift: "0",
    }));

    runConfigByParticle = {
      ...runConfigByParticle,
      [particleId]: {
        count: existing?.count ?? "12",
        instances,
      },
    };
  };

  const updateRunCount = (particleId: ExploreParticle["id"], value: string) => {
    ensureRunConfig(particleId);
    const existing = runConfigByParticle[particleId];
    if (!existing) return;
    runConfigByParticle = {
      ...runConfigByParticle,
      [particleId]: { ...existing, count: value },
    };
  };

  const updateRunInstance = (
    particleId: ExploreParticle["id"],
    index: number,
    field: "startPoint" | "transformShift",
    value: string,
  ) => {
    ensureRunConfig(particleId);
    const existing = runConfigByParticle[particleId];
    if (!existing) return;
    const nextInstances = existing.instances.map((instance, idx) =>
      idx === index ? { ...instance, [field]: value } : instance,
    );
    runConfigByParticle = {
      ...runConfigByParticle,
      [particleId]: { ...existing, instances: nextInstances },
    };
  };

  const buildRunningInstances = (particleId: ExploreParticle["id"]) => {
    const config = runConfigByParticle[particleId];
    const instances = config?.instances ?? [];
    return instances.map((instance) => {
      const startPoint = parseOptionalInt(instance.startPoint);
      const transformShift = parseOptionalInt(instance.transformShift) ?? 0;
      return startPoint === undefined
        ? ({ transformShift } satisfies MockRunningInstance)
        : ({ startPoint, transformShift } satisfies MockRunningInstance);
    });
  };

  const getRunConfig = (particleId: ExploreParticle["id"]) => {
    const config = runConfigByParticle[particleId];
    const samplesRaw = parseOptionalInt(config?.count ?? "12");
    const samplesCount = clampInt(samplesRaw ?? 12, 1, 128);
    const runningInstances = buildRunningInstances(particleId);

    return {
      samplesCount,
      runningInstances,
    };
  };

  const ensurePreview = (id: ExploreParticle["id"]) => {
    if (midiPreviewByParticle[id]) return;
    const particle = particlesById[id];
    if (!particle) return;
    handleRerun(particle);
  };

  const handleRerun = (particle: ExploreParticle) => {
    ensureRunConfig(particle.id);
    const output = getMockPtOutput(particle.id, getRunConfig(particle.id));
    const midi = ptOutputToMidi(output, {
      basePitch: 0,
      defaultDuration: 0.5,
      defaultStep: 1,
      defaultTempo: 120,
    });

    midiPreviewByParticle = {
      ...midiPreviewByParticle,
      [particle.id]: midi,
    };
  };

  $effect(() => {
    if (!panelParticle) return;
    ensureRunConfig(panelParticle.id);
    ensurePreview(panelParticle.id);
  });

  const handleBack = () => {
    if (panelStack.length > 1) panelStack = panelStack.slice(0, -1);
  };

  const handleClose = () => {
    panelStack = [];
    selectedParticleId = null;
  };

  const isMobileOverlayOpen = $derived.by(() => hasPanel);
</script>

<div class="page">
  <div class="page-inner">
    <div class={`layout ${hasPanel ? "layout--panel" : "layout--single"}`}>
      <!-- MAIN -->
      <SectionShell
        dot
        title="Explore particles"
        subtitle="Browse particles and their performative transactions across the Decentralized Creative Network."
      >
        <div class="content">
          <div class="filters">
            <div class="browse-row">
              <span class="mono-label">Browse by</span>

              <div class="view-tags">
                <Button
                  variant="subtle"
                  selected={selectedViewId === "all"}
                  onclick={() => handleViewFilter("all")}
                  ariaPressed={selectedViewId === "all"}
                >
                  All views
                </Button>

                {#each viewOptions as view (view.id)}
                  <Button
                    variant="subtle"
                    selected={selectedViewId === view.id}
                    onclick={() => handleViewFilter(view.id)}
                    ariaPressed={selectedViewId === view.id}
                  >
                    {view.label}
                  </Button>
                {/each}
              </div>
            </div>

            <SelectInput
              label="Author"
              options={authorSelectOptions}
              placeholder="All authors"
              placeholderValue="all"
              bind:value={selectedAuthorId}
            />
          </div>

          <ExploreParticleList
            particles={filteredParticles}
            views={viewOptions}
            {usersById}
            selectedId={selectedParticle?.id}
            onSelect={handleSelect}
            onAuthorSelect={handleAuthorSelect}
          />
        </div>
      </SectionShell>

      <!-- DESKTOP SIDE PANEL -->
      {#if hasPanel}
        <div class="panel-col">
          <ExploreSidePanel onClose={handleClose} onBack={handleBack} {canGoBack}>
            {#if panelParticle && panelAuthor}
              <ExploreParticleDetail
                particle={panelParticle}
                author={panelAuthor}
                view={panelView}
                midiPreview={panelMidiPreview}
                lineageNodes={panelLineage?.nodes}
                lineageEdges={panelLineage?.edges}
                runCount={panelRunCount}
                runDescriptors={panelRunDescriptors}
                runInstances={panelRunInstances}
                onAuthorSelect={handleAuthorSelect}
                onRerun={handleRerun}
                onRunCountChange={(value) => updateRunCount(panelParticle.id, value)}
                onRunInstanceChange={(index, field, value) =>
                  updateRunInstance(panelParticle.id, index, field, value)}
              />
            {:else if panelUser}
              <ExploreUserDetail user={panelUser} />
            {/if}
          </ExploreSidePanel>
        </div>
      {/if}
    </div>
  </div>

  <!-- MOBILE OVERLAY PANEL -->
  {#if isMobileOverlayOpen}
    <div class="overlay lg:hidden" role="dialog" aria-modal="true">
      <button class="overlay-backdrop" aria-label="Close panel" onclick={handleClose}></button>

      <div class="overlay-sheet">
        <ExploreSidePanel onClose={handleClose} onBack={handleBack} {canGoBack}>
          {#if panelParticle && panelAuthor}
            <ExploreParticleDetail
              particle={panelParticle}
              author={panelAuthor}
              view={panelView}
              midiPreview={panelMidiPreview}
              lineageNodes={panelLineage?.nodes}
              lineageEdges={panelLineage?.edges}
              runCount={panelRunCount}
              runDescriptors={panelRunDescriptors}
              runInstances={panelRunInstances}
              onAuthorSelect={handleAuthorSelect}
              onRerun={handleRerun}
              onRunCountChange={(value) => updateRunCount(panelParticle.id, value)}
              onRunInstanceChange={(index, field, value) =>
                updateRunInstance(panelParticle.id, index, field, value)}
            />
          {:else if panelUser}
            <ExploreUserDetail user={panelUser} />
          {/if}
        </ExploreSidePanel>
      </div>
    </div>
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .page {
    @apply flex-1 min-h-0 overflow-hidden flex flex-col relative;
  }

  .page-inner {
    @apply px-2 py-6 w-full;
  }

  .layout {
    @apply grid gap-6;
  }

  .layout--panel {
    @apply lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]
      lg:gap-0 lg:divide-x lg:divide-white/10 lg:items-start;
  }

  .layout--single {
    @apply lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-0 lg:items-start;
  }

  .content {
    @apply space-y-6;
  }

  .filters {
    @apply space-y-3;
  }

  .browse-row {
    @apply flex flex-wrap items-center gap-3;
  }

  .view-tags {
    @apply flex flex-wrap gap-2;
  }

  .panel-col {
    @apply hidden lg:block lg:pl-6;
  }

  .mono-label {
    @apply text-[0.7rem] font-mono tracking-[0.28em] uppercase text-white/40;
  }

  /* ---------- MOBILE OVERLAY ---------- */

  .overlay {
    @apply fixed inset-0 z-50;
  }

  .overlay-backdrop {
    @apply absolute inset-0 bg-black/60;
  }

  .overlay-sheet {
    @apply absolute left-0 right-0 bottom-0
      max-h-[85vh] overflow-y-auto
      rounded-t-3xl border border-white/10 bg-black/90
      p-2;
  }
</style>
