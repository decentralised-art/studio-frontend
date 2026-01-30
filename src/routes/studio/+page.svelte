<script lang="ts">
  import { onMount } from "svelte";

  import { Background, SvelteFlow, type OnSelectionChange } from "@xyflow/svelte";
  import "@xyflow/svelte/dist/style.css";

  import Button from "$lib/components/ui/Button.svelte";
  import DockPanel from "$lib/components/ui/DockPanel.svelte";
  import CreateParticleExplorer from "$lib/components/create/CreateParticleExplorer.svelte";
  import FlowInstanceBridge from "$lib/components/studio/FlowInstanceBridge.svelte";
  import StudioLibraryList from "$lib/components/studio/StudioLibraryList.svelte";
  import {
    mockExploreParticles,
    mockParticleViews,
    type ExploreParticle,
  } from "$lib/data/exploreParticles";
  import {
    mockConditions,
    mockFeatures,
    mockPlugins,
    mockTransformations,
    type LibraryItem,
  } from "$lib/data/studioLibrary";
  import { mockCurrentUserId, mockUsersById } from "$lib/data/users";

  type PanelMode = "open" | "hidden";
  type RightPanelMode = "assistant" | "inspector" | "hidden";

  let leftMode = $state<PanelMode>("open");
  let rightMode = $state<RightPanelMode>("assistant");
  let lastRightMode = $state<Exclude<RightPanelMode, "hidden">>("assistant");
  let topMode = $state<PanelMode>("open");
  let bottomMode = $state<PanelMode>("open");
  let savedModes = $state<{
    left: PanelMode;
    right: RightPanelMode;
    top: PanelMode;
    bottom: PanelMode;
  } | null>(null);

  type StudioNodeData = {
    label: string;
    kind: string;
    particleId?: string;
    sourceId?: string;
    viewId?: string;
  };
  type StudioNode = {
    id: string;
    position: { x: number; y: number };
    data: StudioNodeData;
    selected?: boolean;
  };

  let nodes = $state.raw<StudioNode[]>([]);
  let edges = $state.raw([]);
  let selectedParticleId = $state<ExploreParticle["id"] | undefined>(undefined);
  let selectedNodeId = $state<string | null>(null);
  let selectedViewId = $state<"all" | string>("all");
  let explorerSource = $state<"network" | "toolbox">("network");
  let libraryTab = $state<"particles" | "features" | "transformations" | "conditions" | "plugins">(
    "particles",
  );
  let tooltipX = $state(0);
  let tooltipY = $state(0);
  let leftTabsEl = $state<HTMLDivElement | null>(null);
  let canvasEl = $state<HTMLDivElement | null>(null);
  let screenToFlowPosition:
    | ((client: { x: number; y: number }) => { x: number; y: number })
    | null = null;

  type ToolboxLibrary = {
    particles: string[];
    feature: string[];
    transformation: string[];
    condition: string[];
    plugin: string[];
  };

  type QuickNodeKind = "feature" | "transformation" | "condition" | "plugin" | "agent";

  const panelSize = (mode: PanelMode, open: string) => (mode === "hidden" ? "0px" : open);

  const leftSize = $derived.by(() => panelSize(leftMode, "280px"));
  const rightSize = $derived.by(() => (rightMode === "hidden" ? "0px" : "300px"));
  const topSize = $derived.by(() => panelSize(topMode, "max-content"));
  const bottomSize = $derived.by(() => panelSize(bottomMode, "max-content"));

  const hidePanel = (setter: (mode: PanelMode) => void) => setter("hidden");
  const showPanel = (setter: (mode: PanelMode) => void) => setter("open");
  const togglePanel = (mode: PanelMode, setter: (mode: PanelMode) => void) =>
    setter(mode === "hidden" ? "open" : "hidden");
  const openRightPanel = (mode: Exclude<RightPanelMode, "hidden">) => {
    rightMode = mode;
    lastRightMode = mode;
  };
  const hideRightPanel = () => {
    rightMode = "hidden";
  };
  const toggleRightPanel = () => {
    if (rightMode === "hidden") openRightPanel(lastRightMode);
    else hideRightPanel();
  };

  const hideAll = () => {
    if (!savedModes) {
      savedModes = {
        left: leftMode,
        right: rightMode,
        top: topMode,
        bottom: bottomMode,
      };
    }
    leftMode = "hidden";
    rightMode = "hidden";
    topMode = "hidden";
    bottomMode = "hidden";
  };

  const restoreAll = () => {
    if (!savedModes) {
      leftMode = "open";
      rightMode = "assistant";
      lastRightMode = "assistant";
      topMode = "open";
      bottomMode = "open";
      return;
    }
    leftMode = savedModes.left;
    rightMode = savedModes.right;
    if (savedModes.right !== "hidden") lastRightMode = savedModes.right;
    topMode = savedModes.top;
    bottomMode = savedModes.bottom;
    savedModes = null;
  };

  const toggleAllPanels = () => {
    const allHidden =
      leftMode === "hidden" &&
      rightMode === "hidden" &&
      topMode === "hidden" &&
      bottomMode === "hidden";
    if (allHidden) restoreAll();
    else hideAll();
  };

  const isEditableTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
  };

  onMount(() => {
    const handleDragOverCapture = (event: DragEvent) => {
      handleDragOver(event);
    };
    const handleDropCapture = (event: DragEvent) => {
      handleDrop(event);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();

      if (key === "[") {
        event.preventDefault();
        togglePanel(leftMode, (mode) => (leftMode = mode));
      }
      if (key === "]") {
        event.preventDefault();
        toggleRightPanel();
      }
      if (key === "t") {
        event.preventDefault();
        togglePanel(topMode, (mode) => (topMode = mode));
      }
      if (key === "b") {
        event.preventDefault();
        togglePanel(bottomMode, (mode) => (bottomMode = mode));
      }
      if (key === "\\") {
        event.preventDefault();
        toggleAllPanels();
      }
    };

    window.addEventListener("keydown", handleKey);
    if (canvasEl) {
      canvasEl.addEventListener("dragover", handleDragOverCapture, { capture: true });
      canvasEl.addEventListener("drop", handleDropCapture, { capture: true });
    }

    return () => {
      window.removeEventListener("keydown", handleKey);
      if (canvasEl) {
        canvasEl.removeEventListener("dragover", handleDragOverCapture, { capture: true });
        canvasEl.removeEventListener("drop", handleDropCapture, { capture: true });
      }
    };
  });

  const normalizeToolboxId = (id: string) => id.replace(/^particle-/, "");

  const initialParticleToolbox = (mockUsersById[mockCurrentUserId]?.toolbox ?? []).map(
    normalizeToolboxId,
  );

  let toolboxLibrary = $state<ToolboxLibrary>({
    particles: initialParticleToolbox,
    feature: [],
    transformation: [],
    condition: [],
    plugin: [],
  });

  const availableParticles = $derived.by(() => {
    const base = [...mockExploreParticles].sort((a, b) => b.createdAt - a.createdAt);
    if (explorerSource === "toolbox") {
      return base.filter((particle) => toolboxLibrary.particles.includes(particle.id));
    }
    return base;
  });

  const filteredParticles = $derived.by(() => availableParticles);
  const selectedNode = $derived.by(() => nodes.find((node) => node.id === selectedNodeId) ?? null);

  const handleParticleSelect = (id: ExploreParticle["id"]) => {
    selectedParticleId = id;
  };

  const addParticleToToolbox = (particle: ExploreParticle) => {
    const id = normalizeToolboxId(particle.id);
    if (toolboxLibrary.particles.includes(id)) return;
    toolboxLibrary = { ...toolboxLibrary, particles: [...toolboxLibrary.particles, id] };
  };

  const addLibraryToToolbox = (item: LibraryItem) => {
    const kind = item.kind;
    if (toolboxLibrary[kind].includes(item.id)) return;
    toolboxLibrary = { ...toolboxLibrary, [kind]: [...toolboxLibrary[kind], item.id] };
  };

  const libraryKindForTab = (tab: typeof libraryTab): LibraryItem["kind"] | null => {
    switch (tab) {
      case "features":
        return "feature";
      case "transformations":
        return "transformation";
      case "conditions":
        return "condition";
      case "plugins":
        return "plugin";
      default:
        return null;
    }
  };

  const libraryItems = $derived.by(() => {
    const kind = libraryKindForTab(libraryTab);
    if (!kind) return [];

    let source: LibraryItem[] = [];
    switch (kind) {
      case "feature":
        source = mockFeatures;
        break;
      case "transformation":
        source = mockTransformations;
        break;
      case "condition":
        source = mockConditions;
        break;
      case "plugin":
        source = mockPlugins;
        break;
    }

    if (explorerSource === "toolbox") {
      const saved = toolboxLibrary[kind];
      return source.filter((item) => saved.includes(item.id));
    }

    return source;
  });

  const listTitle = $derived.by(() => {
    switch (libraryTab) {
      case "particles":
        return "Particles";
      case "features":
        return "Features";
      case "transformations":
        return "Transformations";
      case "conditions":
        return "Conditions";
      case "plugins":
        return "Plugins";
      default:
        return "Library";
    }
  });

  const listTooltip = $derived.by(() => {
    switch (libraryTab) {
      case "particles":
        return "A particle is a producer of values. It can be built from many other particles created by different users (humans and AI agents). It connects to other particles through a feature, using the feature’s dimensions as connection points to other particles and selection rules (how to select values from referenced particles).";
      case "features":
        return "A feature defines dimensions (connection points) and the transformations that live on those dimensions. It is a template that tells a particle how it can select values from attached particles or output its own values. A feature alone produces nothing; it only gains output when used by a particle.";
      case "transformations":
        return "Transformations live on dimensions of a feature. Each dimension has its own list of transformations that specify how values are selected from the particle attached at that dimension.";
      case "conditions":
        return "A particle only outputs values if its condition is met. Conditions can be financial (e.g., send funds to an address) or non-financial (artistic, contextual, etc.).";
      case "plugins":
        return "A plugin consumes the runner’s output streams and renders or sonifies them (MIDI, score, audio, image, etc.).";
      default:
        return "";
    }
  });

  const addParticleNode = (
    particle: ExploreParticle,
    position: { x: number; y: number } | null = null,
  ) => {
    const nodePosition = position ?? {
      x: 120 + Math.round(Math.random() * 200),
      y: 120 + Math.round(Math.random() * 200),
    };
    nodes = [
      ...nodes,
      {
        id: `particle-${particle.id}-${crypto.randomUUID()}`,
        position: nodePosition,
        data: {
          label: particle.name,
          kind: "particle",
          particleId: particle.id,
          viewId: particle.viewId,
        },
      },
    ];
  };

  const addLibraryNode = (item: LibraryItem, position: { x: number; y: number } | null = null) => {
    const nodePosition = position ?? {
      x: 160 + Math.round(Math.random() * 200),
      y: 160 + Math.round(Math.random() * 200),
    };
    nodes = [
      ...nodes,
      {
        id: `${item.kind}-${item.id}-${crypto.randomUUID()}`,
        position: nodePosition,
        data: {
          label: item.name,
          kind: item.kind,
          sourceId: item.id,
          viewId: item.viewId,
        },
      },
    ];
  };

  const getCanvasCenter = () => {
    if (!canvasEl) return { x: 220, y: 220 };
    const rect = canvasEl.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    return screenToFlowPosition ? screenToFlowPosition(center) : { x: center.x, y: center.y };
  };

  const addQuickNode = (
    kind: QuickNodeKind,
    label: string,
    position: { x: number; y: number } | null = null,
  ) => {
    const nodePosition = position ?? getCanvasCenter();
    const node = {
      id: `${kind}-quick-${crypto.randomUUID()}`,
      position: nodePosition,
      selected: true,
      data: {
        label,
        kind,
      },
    };
    nodes = nodes.map((existing) => ({ ...existing, selected: false }));
    nodes = [...nodes, node];
  };

  const handleDragStart = (event: DragEvent, particle: ExploreParticle) => {
    event.dataTransfer?.setData("application/x-hypermusic-particle", JSON.stringify(particle));
    event.dataTransfer?.setData("text/plain", particle.name);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  };

  const handleLibraryDragStart = (event: DragEvent, item: LibraryItem) => {
    event.dataTransfer?.setData("application/x-hypermusic-library", JSON.stringify(item));
    event.dataTransfer?.setData("text/plain", item.name);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  };

  const handleQuickDragStart = (event: DragEvent, kind: QuickNodeKind, label: string) => {
    event.dataTransfer?.setData("application/x-hypermusic-quick", JSON.stringify({ kind, label }));
    event.dataTransfer?.setData("text/plain", label);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "copyMove";
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    const quickPayload = event.dataTransfer?.getData("application/x-hypermusic-quick");
    if (quickPayload) {
      try {
        const payload = JSON.parse(quickPayload) as {
          kind: QuickNodeKind;
          label: string;
        };
        const position = screenToFlowPosition
          ? screenToFlowPosition({ x: event.clientX, y: event.clientY })
          : { x: event.clientX, y: event.clientY };
        addQuickNode(payload.kind, payload.label, position);
        return;
      } catch (error) {
        console.warn("Failed to parse dropped quick payload", error);
      }
    }
    const libraryPayload = event.dataTransfer?.getData("application/x-hypermusic-library");
    if (libraryPayload) {
      try {
        const item = JSON.parse(libraryPayload) as LibraryItem;
        const position = screenToFlowPosition
          ? screenToFlowPosition({ x: event.clientX, y: event.clientY })
          : { x: event.clientX, y: event.clientY };
        addLibraryNode(item, position);
        return;
      } catch (error) {
        console.warn("Failed to parse dropped library payload", error);
      }
    }
    const payload = event.dataTransfer?.getData("application/x-hypermusic-particle");
    if (!payload) return;
    try {
      const particle = JSON.parse(payload) as ExploreParticle;
      const position = screenToFlowPosition
        ? screenToFlowPosition({ x: event.clientX, y: event.clientY })
        : { x: event.clientX, y: event.clientY };
      addParticleNode(particle, position);
    } catch (error) {
      console.warn("Failed to parse dropped particle payload", error);
    }
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer) {
      const types = Array.from(event.dataTransfer.types);
      event.dataTransfer.dropEffect = types.includes("application/x-hypermusic-quick")
        ? "copy"
        : "move";
    }
  };

  const handleSelectionChange: OnSelectionChange<StudioNode, unknown> = ({
    nodes: selectedNodes,
  }) => {
    selectedNodeId = selectedNodes[0]?.id ?? null;
  };
</script>

<div
  class="studio"
  style={`--left-size:${leftSize}; --right-size:${rightSize}; --top-size:${topSize}; --bottom-size:${bottomSize};`}
>
  {#if topMode !== "hidden"}
    <DockPanel
      title="Create element"
      position="top"
      inline
      onHide={() => hidePanel((mode) => (topMode = mode))}
    >
      <Button
        variant="ghost"
        ariaLabel="New Feature"
        title="New Feature — A feature defines dimensions (connection points) and the transformations that live on those dimensions."
        className="icon-btn"
        draggable
        onclick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          addQuickNode("feature", "New Feature");
        }}
        ondragstart={(event) => handleQuickDragStart(event, "feature", "New Feature")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2"></rect>
          <path d="M12 8v8M8 12h8"></path>
        </svg>
      </Button>
      <Button
        variant="ghost"
        ariaLabel="New Transformation"
        title="New Transformation — Transformations live on dimensions of a feature and specify how values are selected from the attached particle."
        className="icon-btn"
        draggable
        onclick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          addQuickNode("transformation", "New Transformation");
        }}
        ondragstart={(event) => handleQuickDragStart(event, "transformation", "New Transformation")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 8h10l-3-3"></path>
          <path d="M18 16H8l3 3"></path>
        </svg>
      </Button>
      <Button
        variant="ghost"
        ariaLabel="New Condition"
        title="New Condition — A particle only outputs values if its condition is met."
        className="icon-btn"
        draggable
        onclick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          addQuickNode("condition", "New Condition");
        }}
        ondragstart={(event) => handleQuickDragStart(event, "condition", "New Condition")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16l-6 7v6l-4-2v-4z"></path>
        </svg>
      </Button>
      <Button
        variant="ghost"
        ariaLabel="New Agent"
        title="New Agent"
        className="icon-btn"
        draggable
        onclick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          addQuickNode("agent", "New Agent");
        }}
        ondragstart={(event) => handleQuickDragStart(event, "agent", "New Agent")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="3"></circle>
          <path d="M5 20a7 7 0 0 1 14 0"></path>
        </svg>
      </Button>
      <Button
        variant="ghost"
        ariaLabel="New Plugin"
        title="New Plugin — A plugin consumes the runner’s output streams and renders or sonifies them."
        className="icon-btn"
        draggable
        onclick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          addQuickNode("plugin", "New Plugin");
        }}
        ondragstart={(event) => handleQuickDragStart(event, "plugin", "New Plugin")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 6v6M16 6v6"></path>
          <path d="M6 12h12v3a6 6 0 0 1-12 0v-3z"></path>
          <path d="M12 18v3"></path>
        </svg>
      </Button>
    </DockPanel>
  {/if}

  {#if leftMode !== "hidden"}
    <DockPanel
      title="Add element"
      position="left"
      onHide={() => hidePanel((mode) => (leftMode = mode))}
    >
      <div class="left-panel">
        <div class="source-tabs">
          <button
            type="button"
            class={`source-tab ${explorerSource === "network" ? "is-active" : ""}`}
            onclick={() => (explorerSource = "network")}
          >
            Network
          </button>
          <button
            type="button"
            class={`source-tab ${explorerSource === "toolbox" ? "is-active" : ""}`}
            onclick={() => (explorerSource = "toolbox")}
          >
            Toolbox
          </button>
        </div>
        <div class="left-tabs">
          <button
            type="button"
            class="scroll-arrow"
            aria-label="Scroll element tabs left"
            onclick={() => leftTabsEl?.scrollBy({ left: -120, behavior: "smooth" })}
          >
            ‹
          </button>
          <div class="left-tabs-track" bind:this={leftTabsEl}>
            <Button
              variant="subtle"
              selected={libraryTab === "particles"}
              onclick={() => (libraryTab = "particles")}
            >
              Particles
            </Button>
            <Button
              variant="subtle"
              selected={libraryTab === "features"}
              onclick={() => (libraryTab = "features")}
            >
              Features
            </Button>
            <Button
              variant="subtle"
              selected={libraryTab === "transformations"}
              onclick={() => (libraryTab = "transformations")}
            >
              Transformations
            </Button>
            <Button
              variant="subtle"
              selected={libraryTab === "conditions"}
              onclick={() => (libraryTab = "conditions")}
            >
              Conditions
            </Button>
            <Button
              variant="subtle"
              selected={libraryTab === "plugins"}
              onclick={() => (libraryTab = "plugins")}
            >
              Plugins
            </Button>
          </div>
          <button
            type="button"
            class="scroll-arrow"
            aria-label="Scroll element tabs right"
            onclick={() => leftTabsEl?.scrollBy({ left: 120, behavior: "smooth" })}
          >
            ›
          </button>
        </div>
        <div class="list-header">
          <div class="list-title">{listTitle}</div>
          <button
            class="info-dot"
            type="button"
            data-tooltip={listTooltip}
            style={`--tooltip-x:${tooltipX}px; --tooltip-y:${tooltipY}px;`}
            aria-label={`${listTitle} definition`}
            onmousemove={(event) => {
              tooltipX = event.clientX;
              tooltipY = event.clientY;
            }}
          >
            ?
          </button>
        </div>
        {#if libraryTab === "particles"}
          <CreateParticleExplorer
            particles={filteredParticles}
            views={mockParticleViews}
            usersById={mockUsersById}
            selectedId={selectedParticleId}
            bind:selectedViewId
            onSelect={handleParticleSelect}
            onAdd={(particle) => addParticleNode(particle, null)}
            onToolbox={addParticleToToolbox}
            onDragStart={handleDragStart}
            draggable
            showHeader={false}
            showViewFilter={false}
          />
        {:else if libraryTab === "features"}
          <StudioLibraryList
            title="Features"
            items={libraryItems}
            usersById={mockUsersById}
            onAdd={(item) => addLibraryNode(item, null)}
            onToolbox={addLibraryToToolbox}
            onDragStart={handleLibraryDragStart}
            draggable
            showHeader={false}
          />
        {:else if libraryTab === "transformations"}
          <StudioLibraryList
            title="Transformations"
            items={libraryItems}
            usersById={mockUsersById}
            onAdd={(item) => addLibraryNode(item, null)}
            onToolbox={addLibraryToToolbox}
            onDragStart={handleLibraryDragStart}
            draggable
            showHeader={false}
          />
        {:else if libraryTab === "conditions"}
          <StudioLibraryList
            title="Conditions"
            items={libraryItems}
            usersById={mockUsersById}
            onAdd={(item) => addLibraryNode(item, null)}
            onToolbox={addLibraryToToolbox}
            onDragStart={handleLibraryDragStart}
            draggable
            showHeader={false}
          />
        {:else}
          <StudioLibraryList
            title="Plugins"
            items={libraryItems}
            usersById={mockUsersById}
            onAdd={(item) => addLibraryNode(item, null)}
            onToolbox={addLibraryToToolbox}
            onDragStart={handleLibraryDragStart}
            draggable
            showHeader={false}
          />
        {/if}
      </div>
    </DockPanel>
  {/if}

  <div class="canvas" role="application" aria-label="Flow canvas" bind:this={canvasEl}>
    <SvelteFlow
      bind:nodes
      bind:edges
      onselectionchange={handleSelectionChange}
      fitView
      zoomOnScroll
      zoomOnPinch
      panOnDrag
      proOptions={{ hideAttribution: true }}
    >
      <Background bgColor="black" />
      <FlowInstanceBridge onReady={(fn) => (screenToFlowPosition = fn)} />
    </SvelteFlow>
  </div>

  {#if rightMode === "assistant"}
    <DockPanel title="Assistant" position="right" onHide={hideRightPanel}>
      <div class="assistant-placeholder">Agent assistant chat goes here.</div>
    </DockPanel>
  {/if}

  {#if rightMode === "inspector"}
    <DockPanel title="Inspector" position="right" onHide={hideRightPanel}>
      <div class="inspector">
        <div class="inspector-title">Node inspector</div>
        {#if selectedNode}
          <div class="inspector-row">
            <span>Type</span>
            <span>{selectedNode.data.kind}</span>
          </div>
          <div class="inspector-row">
            <span>Name</span>
            <span>{selectedNode.data.label}</span>
          </div>
          {#if selectedNode.data.particleId}
            <div class="inspector-row">
              <span>Particle</span>
              <span>{selectedNode.data.particleId}</span>
            </div>
          {/if}
          {#if selectedNode.data.sourceId}
            <div class="inspector-row">
              <span>Source</span>
              <span>{selectedNode.data.sourceId}</span>
            </div>
          {/if}
          {#if selectedNode.data.viewId}
            <div class="inspector-row">
              <span>View</span>
              <span>{selectedNode.data.viewId}</span>
            </div>
          {/if}
        {:else}
          <div class="inspector-empty">Select a node to view details.</div>
        {/if}
      </div>
    </DockPanel>
  {/if}

  {#if bottomMode !== "hidden"}
    <DockPanel
      title="Utilities"
      position="bottom"
      inline
      onHide={() => hidePanel((mode) => (bottomMode = mode))}
    >
      <Button variant="subtle" ariaLabel="Clear canvas" title="Clear canvas" className="icon-btn">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16"></path>
          <path d="M9 7V5h6v2"></path>
          <path d="M7 7l1 12h8l1-12"></path>
        </svg>
      </Button>
      <Button variant="subtle" ariaLabel="Auto layout" title="Auto layout" className="icon-btn">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="6" height="6"></rect>
          <rect x="14" y="4" width="6" height="6"></rect>
          <rect x="4" y="14" width="6" height="6"></rect>
          <rect x="14" y="14" width="6" height="6"></rect>
        </svg>
      </Button>
      <Button variant="subtle" ariaLabel="Zoom to fit" title="Zoom to fit" className="icon-btn">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2"></rect>
          <path d="M9 9h6v6H9z"></path>
        </svg>
      </Button>
      <Button
        variant="subtle"
        ariaLabel="Hide all panels"
        title="Hide all panels (\\)"
        className="icon-btn"
        onclick={toggleAllPanels}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"></path>
          <path d="M4 4l16 16"></path>
        </svg>
      </Button>
    </DockPanel>
  {/if}

  {#if topMode === "hidden"}
    <button
      class="panel-tab panel-tab--top"
      type="button"
      title="Create element panel (T)"
      aria-label="Create element panel"
      onclick={() => showPanel((m) => (topMode = m))}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v16M4 12h16"></path>
      </svg>
    </button>
  {/if}

  {#if bottomMode === "hidden"}
    <button
      class="panel-tab panel-tab--bottom"
      type="button"
      title="Utilities panel (B)"
      aria-label="Utilities panel"
      onclick={() => showPanel((m) => (bottomMode = m))}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 12h16"></path>
        <path d="M7 8h4M13 16h4"></path>
      </svg>
    </button>
  {/if}

  {#if leftMode === "hidden"}
    <button
      class="panel-tab panel-tab--left"
      type="button"
      title="Add element panel ([)"
      aria-label="Add element panel"
      onclick={() => showPanel((m) => (leftMode = m))}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="6" width="14" height="12" rx="2"></rect>
        <path d="M9 10h6M9 14h6"></path>
      </svg>
    </button>
  {/if}

  {#if rightMode === "hidden"}
    <div class="panel-tab-stack panel-tab-stack--right">
      <button
        class="panel-tab"
        type="button"
        title="Assistant panel (])"
        aria-label="Assistant panel"
        onclick={() => openRightPanel("assistant")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16v10H8l-4 4z"></path>
          <path d="M8 10h8M8 13h6"></path>
        </svg>
      </button>
      <button
        class="panel-tab"
        type="button"
        title="Inspector panel"
        aria-label="Inspector panel"
        onclick={() => openRightPanel("inspector")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="7"></circle>
          <path d="M12 11v5"></path>
          <path d="M12 8h.01"></path>
        </svg>
      </button>
    </div>
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .studio {
    @apply relative h-[calc(100vh-4rem)] w-full grid gap-0;
    grid-template-columns: var(--left-size) minmax(0, 1fr) var(--right-size);
    grid-template-rows: var(--top-size) minmax(0, 1fr) var(--bottom-size);
    grid-template-areas:
      "top top top"
      "left canvas right"
      "bottom bottom bottom";
  }

  .canvas {
    grid-area: canvas;
    @apply min-h-0 bg-black;
  }

  .studio :global(.svelte-flow) {
    @apply h-full w-full;
  }

  .studio > :global(.dock--top) {
    grid-area: top;
  }

  .studio > :global(.dock--left) {
    grid-area: left;
  }

  .studio > :global(.dock--right) {
    grid-area: right;
  }

  .studio > :global(.dock--bottom) {
    grid-area: bottom;
  }

  .left-panel {
    @apply flex flex-col gap-2 min-h-0;
  }

  .source-tabs {
    @apply flex border-b border-white/10;
  }

  .source-tab {
    @apply px-3 py-2 text-[0.6rem] uppercase tracking-[0.24em]
      text-white/60 border border-white/10 border-b-0
      bg-black/30;
    margin-bottom: -1px;
  }

  .source-tab + .source-tab {
    margin-left: -1px;
  }

  .source-tab.is-active {
    @apply text-white border-white/30 bg-black/80;
    border-bottom-color: transparent;
  }

  .left-tabs {
    @apply flex items-center gap-1;
  }

  .left-tabs-track {
    @apply flex items-center gap-1;
    overflow-x: auto;
    scroll-behavior: smooth;
    scrollbar-width: none;
  }

  .left-tabs-track::-webkit-scrollbar {
    display: none;
  }

  .left-tabs-track :global(.btn) {
    @apply px-2 py-1 text-[0.55rem] uppercase tracking-[0.18em] inline-flex items-center justify-center gap-1;
    flex: 0 0 auto;
  }

  .scroll-arrow {
    @apply h-6 w-6 flex items-center justify-center
      rounded-md border border-white/10 bg-white/5
      text-white/60 hover:text-white hover:border-white/30;
    flex: 0 0 auto;
  }

  .info-dot {
    @apply relative inline-flex items-center justify-center
      h-4 w-4 rounded-full border border-white/20
      text-[0.55rem] font-semibold text-white/60
      hover:text-white hover:border-white/40;
  }

  .info-dot::after {
    content: attr(data-tooltip);
    @apply fixed z-[60] opacity-0 pointer-events-none
      rounded-md border border-white/10 bg-black/90
      px-2 py-1 text-[0.6rem] normal-case tracking-normal text-white/80;
    width: max-content;
    max-width: 240px;
    left: var(--tooltip-x);
    top: var(--tooltip-y);
    transform: translateY(-100%);
    transition:
      opacity 150ms ease,
      transform 150ms ease;
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.45);
  }

  .info-dot:hover::after,
  .info-dot:focus-visible::after {
    opacity: 1;
    transform: translateY(-100%);
  }

  .list-header {
    @apply flex items-center gap-2 text-white/70;
  }

  .list-title {
    @apply text-[0.7rem] uppercase tracking-[0.28em] text-white/70;
  }

  .studio :global(.svelte-flow__node) {
    @apply rounded-md border border-white/15 bg-black/80 text-white/80;
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.45);
    background-color: rgba(6, 8, 12, 0.85) !important;
    color: rgba(255, 255, 255, 0.85) !important;
    border-color: rgba(255, 255, 255, 0.15) !important;
  }

  .studio :global(.svelte-flow__node.selected) {
    @apply border-emerald-400/60 text-emerald-200;
    box-shadow:
      0 0 0 1px rgba(52, 211, 153, 0.3),
      0 16px 28px rgba(0, 0, 0, 0.5);
    border-color: rgba(52, 211, 153, 0.6) !important;
    color: rgba(167, 243, 208, 0.95) !important;
  }

  .studio :global(.svelte-flow__node .svelte-flow__node-content) {
    @apply text-[0.7rem] font-semibold tracking-[0.08em];
  }

  .studio :global(.dock--top .btn),
  .studio :global(.dock--bottom .btn) {
    @apply px-2 py-1 text-xs;
  }

  .studio :global(.icon-btn) {
    @apply rounded-md border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white;
  }

  .studio :global(.icon-btn svg) {
    @apply h-4 w-4;
    stroke: currentColor;
    stroke-width: 1.6;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .studio :global(.dock--top .dock-title),
  .studio :global(.dock--bottom .dock-title) {
    @apply text-[0.55rem];
  }

  .inspector {
    @apply rounded-md border border-white/10 bg-black/60 p-3 text-white/70;
  }

  .inspector-title {
    @apply text-[0.55rem] uppercase tracking-[0.24em] text-white/60;
  }

  .inspector-row {
    @apply mt-2 flex items-center justify-between text-[0.7rem] text-white/80;
  }

  .inspector-row span:last-child {
    @apply text-white/90;
  }

  .inspector-empty {
    @apply mt-2 text-[0.65rem] text-white/50;
  }

  .assistant-placeholder {
    @apply mt-4 text-[0.8rem] text-white/60;
  }

  .panel-tab {
    @apply grid place-items-center rounded-md border border-white/15 bg-black/80
      h-7 w-7 text-white/60 hover:text-white hover:border-white/30;
  }

  .panel-tab svg {
    @apply h-4 w-4;
    stroke: currentColor;
    stroke-width: 1.6;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .panel-tab--top {
    @apply absolute z-20 top-2 left-1/2 -translate-x-1/2;
  }

  .panel-tab--bottom {
    @apply absolute z-20 bottom-2 left-1/2 -translate-x-1/2;
  }

  .panel-tab--left {
    @apply absolute z-20 top-1/2 left-2 -translate-y-1/2;
  }

  .panel-tab-stack {
    @apply absolute z-20 flex flex-col gap-2;
  }

  .panel-tab-stack--right {
    @apply top-1/2 right-2 -translate-y-1/2;
  }
</style>
