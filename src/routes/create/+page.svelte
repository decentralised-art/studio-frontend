<script lang="ts">
  import { onMount } from "svelte";

  import Button from "$lib/components/ui/Button.svelte";
  import CreateParticleExplorer from "$lib/components/create/CreateParticleExplorer.svelte";
  import CreateVisualizerPanel from "$lib/components/create/CreateVisualizerPanel.svelte";
  import WorkspaceWindow from "$lib/components/workspace-window/WorkspaceWindow.svelte";

  import {
    mockExploreParticles,
    mockParticleViews,
    type ExploreParticle,
    type ParticleView,
  } from "$lib/data/exploreParticles";
  import { mockUsers, mockUsersById, type User } from "$lib/data/users";

  type ViewFilter = ParticleView["id"] | "all";
  type AuthorFilter = User["id"] | "all";
  type ResizeHandle = "left" | "right";
  type MobileView = "explorer" | "flow" | "visualiser";

  const MIN_LEFT = 200;
  const MIN_CENTER = 420;
  const MIN_RIGHT = 260;
  const HANDLE_SIZE = 8;

  const viewOptions = mockParticleViews;
  const usersById = mockUsersById;

  let selectedViewId = $state<ViewFilter>("all");
  let selectedAuthorId = $state<AuthorFilter>("all");
  let selectedParticleId = $state<ExploreParticle["id"] | null>(null);
  let mobileView = $state<MobileView>("flow");

  const authorOptions = $derived.by(() =>
    [...mockUsers].sort((a, b) => a.nickname.localeCompare(b.nickname)),
  );

  let container: HTMLDivElement | null = null;
  let leftWidth = $state(260);
  let rightWidth = $state(360);
  let activeHandle = $state<ResizeHandle | null>(null);
  let hasUserSized = $state(false);

  type FlowPreview = {
    title: string;
    summary?: string;
    viewLabel?: string;
  };

  const filteredParticles = $derived.by(() => {
    let list = [...mockExploreParticles];

    if (selectedViewId !== "all") list = list.filter((p) => p.viewId === selectedViewId);
    if (selectedAuthorId !== "all") list = list.filter((p) => p.authorId === selectedAuthorId);

    list.sort((a, b) => b.createdAt - a.createdAt);
    return list;
  });

  let flowPreview = $state<FlowPreview | null>(null);

  const handleSelect = (id: ExploreParticle["id"]) => {
    selectedParticleId = id;
  };

  const handleAuthorSelect = (id: User["id"]) => {
    selectedAuthorId = id;
  };

  const handleAdd = (particle: ExploreParticle) => {
    selectedParticleId = particle.id;
  };

  const clampWidths = (left: number, right: number, width: number, handle: ResizeHandle | null) => {
    const available = Math.max(0, width - HANDLE_SIZE * 2);
    const maxTotal = Math.max(0, available - MIN_CENTER);

    let nextLeft = Math.max(MIN_LEFT, left);
    let nextRight = Math.max(MIN_RIGHT, right);

    if (nextLeft + nextRight > maxTotal) {
      const overflow = nextLeft + nextRight - maxTotal;
      if (handle === "left") {
        nextRight = Math.max(MIN_RIGHT, nextRight - overflow);
      } else if (handle === "right") {
        nextLeft = Math.max(MIN_LEFT, nextLeft - overflow);
      } else {
        const total = nextLeft + nextRight || 1;
        nextLeft = Math.max(MIN_LEFT, nextLeft - (overflow * nextLeft) / total);
        nextRight = Math.max(MIN_RIGHT, nextRight - (overflow * nextRight) / total);
      }
    }

    if (nextLeft + nextRight > maxTotal) {
      if (handle === "left") {
        nextLeft = Math.max(MIN_LEFT, maxTotal - nextRight);
      } else {
        nextRight = Math.max(MIN_RIGHT, maxTotal - nextLeft);
      }
    }

    return { left: nextLeft, right: nextRight };
  };

  const syncWidthsToContainer = (handle: ResizeHandle | null) => {
    if (!container) return;
    const width = container.getBoundingClientRect().width;
    const { left, right } = clampWidths(leftWidth, rightWidth, width, handle);
    leftWidth = left;
    rightWidth = right;
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!container || !activeHandle) return;

    const rect = container.getBoundingClientRect();
    const position = event.clientX - rect.left;

    let nextLeft = leftWidth;
    let nextRight = rightWidth;

    if (activeHandle === "left") {
      nextLeft = position - HANDLE_SIZE / 2;
    } else {
      nextRight = rect.width - position - HANDLE_SIZE / 2;
    }

    const clamped = clampWidths(nextLeft, nextRight, rect.width, activeHandle);
    leftWidth = clamped.left;
    rightWidth = clamped.right;
  };

  const stopResize = () => {
    activeHandle = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopResize);
  };

  const startResize = (handle: ResizeHandle) => (event: PointerEvent) => {
    if (!container || window.innerWidth < 1024) return;
    event.preventDefault();
    hasUserSized = true;
    activeHandle = handle;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
  };

  onMount(() => {
    if (!container) return;

    const handleResize = () => {
      if (!container) return;
      const width = container.getBoundingClientRect().width;
      if (!hasUserSized) {
        const initialLeft = width * 0.22;
        const initialRight = width * 0.3;
        const clamped = clampWidths(initialLeft, initialRight, width, null);
        leftWidth = clamped.left;
        rightWidth = clamped.right;
        return;
      }
      syncWidthsToContainer(null);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  });
</script>

<div class="page">
  <div class="page-inner">
    <div class="mobile-tabs lg:hidden">
      <Button
        variant="ghost"
        selected={mobileView === "explorer"}
        onclick={() => (mobileView = "explorer")}
        ariaPressed={mobileView === "explorer"}
      >
        Particles
      </Button>
      <Button
        variant="ghost"
        selected={mobileView === "flow"}
        onclick={() => (mobileView = "flow")}
        ariaPressed={mobileView === "flow"}
      >
        Flow
      </Button>
      <Button
        variant="ghost"
        selected={mobileView === "visualiser"}
        onclick={() => (mobileView = "visualiser")}
        ariaPressed={mobileView === "visualiser"}
      >
        Visualiser
      </Button>
    </div>

    <div
      class="layout layout-resizable"
      bind:this={container}
      data-mobile={mobileView}
      style={`--left-col:${leftWidth}px; --right-col:${rightWidth}px; --handle:${HANDLE_SIZE}px;`}
    >
      <div class="column column-left">
        <CreateParticleExplorer
          particles={filteredParticles}
          views={viewOptions}
          {usersById}
          authors={authorOptions}
          selectedId={selectedParticleId ?? undefined}
          bind:selectedViewId
          bind:selectedAuthorId
          onSelect={handleSelect}
          onAuthorSelect={handleAuthorSelect}
          onAdd={handleAdd}
        />
      </div>

      <div
        class="resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize explorer and flow"
        onpointerdown={startResize("left")}
      >
        <span class="handle-grip" aria-hidden="true"></span>
      </div>

      <div class="column column-center">
        <WorkspaceWindow />
      </div>

      <div
        class="resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize flow and visualiser"
        onpointerdown={startResize("right")}
      >
        <span class="handle-grip" aria-hidden="true"></span>
      </div>

      <div class="column column-right">
        <CreateVisualizerPanel preview={flowPreview} />
      </div>
    </div>
  </div>
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .page {
    @apply flex-1 min-h-0 overflow-hidden flex flex-col;
  }

  .page-inner {
    @apply flex-1 min-h-0 px-2 py-6 flex flex-col;
  }

  .layout {
    @apply flex-1 min-h-0 grid gap-4;
  }

  .column {
    @apply min-h-0 flex flex-col overflow-hidden;
  }

  .mobile-tabs {
    @apply flex flex-wrap gap-2 pb-4;
  }

  .column-left {
    @apply lg:pr-4;
  }

  .column-center {
    @apply lg:px-4;
  }

  .column-right {
    @apply lg:pl-4;
  }

  .resize-handle {
    @apply hidden lg:flex items-center justify-center cursor-col-resize
      bg-white/5 hover:bg-white/10 touch-none;
    width: var(--handle);
  }

  .handle-grip {
    @apply h-10 w-[2px] rounded-full bg-white/25;
  }

  @media (min-width: 1024px) {
    .mobile-tabs {
      display: none;
    }

    .layout {
      grid-template-columns:
        minmax(0, var(--left-col))
        var(--handle)
        minmax(0, 1fr)
        var(--handle)
        minmax(0, var(--right-col));
      @apply gap-0;
    }
  }

  @media (max-width: 1023px) {
    .layout[data-mobile="explorer"] .column-center,
    .layout[data-mobile="explorer"] .column-right {
      display: none;
    }

    .layout[data-mobile="flow"] .column-left,
    .layout[data-mobile="flow"] .column-right {
      display: none;
    }

    .layout[data-mobile="visualiser"] .column-left,
    .layout[data-mobile="visualiser"] .column-center {
      display: none;
    }
  }
</style>
