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
  };

  const handleAuthorSelect = (id: User["id"]) => {
    pushPanel({ type: "user", id });
  };

  const handleViewFilter = (id: ViewFilter) => {
    selectedViewId = id;
  };

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
    <div class={`layout ${hasPanel ? "layout--panel" : ""}`}>
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
                onAuthorSelect={handleAuthorSelect}
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
              onAuthorSelect={handleAuthorSelect}
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
    @apply lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]
      lg:gap-0 lg:divide-x lg:divide-white/10 lg:items-start;
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
