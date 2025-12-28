<script lang="ts">
  import ExploreParticleDetail from "$lib/components/explore/ExploreParticleDetail.svelte";
  import ExploreParticleList from "$lib/components/explore/ExploreParticleList.svelte";
  import ExploreSidePanel from "$lib/components/explore/ExploreSidePanel.svelte";
  import ExploreUserDetail from "$lib/components/explore/ExploreUserDetail.svelte";
  import {
    mockExploreParticles,
    mockParticleViews,
    type ExploreParticle,
    type ParticleView,
  } from "$lib/data/exploreParticles";
  import { mockUsers, mockUsersById, type User } from "$lib/data/users";
  import SectionShell from "$lib/components/ui/SectionShell.svelte";

  type ViewFilter = ParticleView["id"] | "all";
  type PanelState =
    | { type: "particle"; id: ExploreParticle["id"] }
    | { type: "user"; id: User["id"] };

  const viewOptions = mockParticleViews;
  const usersById = mockUsersById;
  const particlesById = Object.fromEntries(
    mockExploreParticles.map((particle) => [particle.id, particle] as const),
  );

  let selectedViewId = $state<ViewFilter>("all");
  let selectedAuthorId = $state("all");
  let selectedParticleId = $state<ExploreParticle["id"] | null>(null);
  let panelStack = $state<PanelState[]>([]);

  const authorOptions = $derived.by(() =>
    [...mockUsers].sort((a, b) => a.nickname.localeCompare(b.nickname)),
  );

  const filteredParticles = $derived.by(() => {
    let list = [...mockExploreParticles];

    if (selectedViewId !== "all") {
      list = list.filter((particle) => particle.viewId === selectedViewId);
    }

    if (selectedAuthorId !== "all") {
      list = list.filter((particle) => particle.authorId === selectedAuthorId);
    }

    list.sort((a, b) => b.createdAt - a.createdAt);

    return list;
  });

  const selectedParticle = $derived.by(() =>
    filteredParticles.find((particle) => particle.id === selectedParticleId),
  );

  const activePanel = $derived.by(() => panelStack[panelStack.length - 1] ?? null);

  const panelParticle = $derived.by(() =>
    activePanel?.type === "particle" ? (particlesById[activePanel.id] ?? null) : null,
  );

  const panelUser = $derived.by(() =>
    activePanel?.type === "user" ? (usersById[activePanel.id] ?? null) : null,
  );

  const panelView = $derived.by(() =>
    panelParticle ? (viewOptions.find((view) => view.id === panelParticle.viewId) ?? null) : null,
  );

  const panelAuthor = $derived.by(() =>
    panelParticle ? (usersById[panelParticle.authorId] ?? null) : null,
  );

  const hasPanel = $derived.by(() => panelStack.length > 0);
  const canGoBack = $derived.by(() => panelStack.length > 1);

  const isSamePanel = (a: PanelState, b: PanelState) => {
    if (a.type !== b.type) return false;
    if (a.type === "particle" && b.type === "particle") return a.id === b.id;
    if (a.type === "user" && b.type === "user") return a.id === b.id;

    return false;
  };

  const pushPanel = (panel: PanelState) => {
    const last = panelStack[panelStack.length - 1];
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
    if (panelStack.length > 1) {
      panelStack = panelStack.slice(0, -1);
    }
  };

  const handleClose = () => {
    if (panelStack.length > 1) {
      panelStack = panelStack.slice(0, -1);
      return;
    }

    panelStack = [];
    selectedParticleId = null;
  };
</script>

<div class="flex-1 min-h-0 overflow-y-auto">
  <div class="px-4 py-6">
    <div
      class={`grid gap-6 ${
        hasPanel
          ? "lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-0 lg:divide-x lg:divide-white/10 lg:items-start"
          : ""
      }`}
    >
      <SectionShell
        dot={true}
        title="Explore particles"
        subtitle="Browse particles and their performative transactions across the Decentralized Creative Network."
        className={`mt-4 ${hasPanel ? "lg:pr-6" : ""} mx-0 max-w-none`}
      >
        <div class="space-y-6">
          <div class="space-y-3">
            <div class="flex flex-wrap items-center gap-3">
              <span class="mono-label">Browse by</span>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class={`tag ${selectedViewId === "all" ? "tag-accent" : "tag-outline"} transition cursor-pointer`}
                  onclick={() => handleViewFilter("all")}
                  aria-pressed={selectedViewId === "all"}
                >
                  All views
                </button>
                {#each viewOptions as view (view.id)}
                  <button
                    type="button"
                    class={`tag ${selectedViewId === view.id ? "tag-accent" : "tag-outline"} transition cursor-pointer`}
                    onclick={() => handleViewFilter(view.id)}
                    aria-pressed={selectedViewId === view.id}
                  >
                    {view.label}
                  </button>
                {/each}
              </div>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <label class="flex flex-col gap-2 text-sm">
                <span class="input-label">Author</span>
                <select class="input" bind:value={selectedAuthorId}>
                  <option value="all">All authors</option>
                  {#each authorOptions as author (author.id)}
                    <option value={author.id}>{author.nickname}</option>
                  {/each}
                </select>
              </label>
            </div>
          </div>

          <ExploreParticleList
            particles={filteredParticles}
            views={viewOptions}
            {usersById}
            selectedId={selectedParticle?.id ?? undefined}
            onSelect={handleSelect}
            onAuthorSelect={handleAuthorSelect}
          />
        </div>
      </SectionShell>

      {#if hasPanel}
        <div class="hidden lg:block lg:pl-6">
          <ExploreSidePanel onClose={handleClose} onBack={handleBack} {canGoBack} className="mt-4">
            {#if panelParticle && panelAuthor}
              <ExploreParticleDetail
                particle={panelParticle}
                author={panelAuthor}
                view={panelView}
                onAuthorSelect={handleAuthorSelect}
              />
            {:else if panelUser}
              <ExploreUserDetail user={panelUser} {particlesById} />
            {/if}
          </ExploreSidePanel>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if hasPanel}
  <div class="lg:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm">
    <div class="h-full overflow-y-auto px-4 py-6">
      <ExploreSidePanel onClose={handleClose} onBack={handleBack} {canGoBack} className="pb-8">
        {#if panelParticle && panelAuthor}
          <ExploreParticleDetail
            particle={panelParticle}
            author={panelAuthor}
            view={panelView}
            onAuthorSelect={handleAuthorSelect}
          />
        {:else if panelUser}
          <ExploreUserDetail user={panelUser} {particlesById} />
        {/if}
      </ExploreSidePanel>
    </div>
  </div>
{/if}
