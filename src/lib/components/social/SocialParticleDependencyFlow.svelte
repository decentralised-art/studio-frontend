<script lang="ts">
  import { Background, SvelteFlow, type Edge, type NodeTypes } from "@xyflow/svelte";
  import { SvelteMap, SvelteSet } from "svelte/reactivity";
  import { onMount, tick } from "svelte";
  import "@xyflow/svelte/dist/style.css";

  import FlowInstanceBridge from "$lib/components/studio/FlowInstanceBridge.svelte";
  import StudioConnectorNode from "$lib/components/studio/StudioConnectorNode.svelte";
  import StudioConditionNode from "$lib/components/studio/StudioConditionNode.svelte";
  import StudioDimensionNode from "$lib/components/studio/StudioDimensionNode.svelte";
  import StudioParticleNode from "$lib/components/studio/StudioParticleNode.svelte";
  import {
    buildParticleDependencyGraph,
    type StudioDependencyNode,
  } from "$lib/studio/particleDependencyGraph";
  import { ensureParticleRecordLoadedById } from "$lib/feed/particlePostData";

  const {
    particleId,
    onParticleOpen,
    displayMode = "card",
  }: {
    particleId: string;
    onParticleOpen?: ((particleId: string) => void) | undefined;
    displayMode?: "card" | "page";
  } = $props();

  let graphRevision = $state(0);
  const graph = $derived.by(() => {
    void graphRevision;
    return buildParticleDependencyGraph(particleId);
  });
  const builtNodes = $derived.by(() => graph.nodes);
  const builtEdges = $derived.by(() => graph.edges);
  const flowId = $derived(`social-flow-${particleId}`);
  const graphSignature = $derived.by(
    () => `${particleId}:${builtNodes.length}:${builtEdges.length}`,
  );
  const flowHeight = $derived.by(() => {
    const dimCount = builtNodes.filter((node) => node.data.kind === "dimension").length;
    const depCount = builtNodes.filter((node) => node.data.kind === "particle").length;
    if (displayMode === "page") {
      if (dimCount === 0 && depCount === 0) return 420;
      return Math.min(760, Math.max(420, 340 + dimCount * 34 + depCount * 24));
    }
    if (dimCount === 0 && depCount === 0) return 280;
    return Math.min(520, Math.max(300, 240 + dimCount * 24 + depCount * 18));
  });

  const nodeTypes = {
    feature: StudioConnectorNode,
    connector: StudioConnectorNode,
    condition: StudioConditionNode,
    dimension: StudioDimensionNode,
    particle: StudioParticleNode,
  } as unknown as NodeTypes;

  let flowApi = $state<{
    getZoom: () => number;
    fitView: (options?: { padding?: number; duration?: number }) => void;
  } | null>(null);
  let flowShellEl = $state<HTMLDivElement | null>(null);
  let flowNodes = $state<StudioDependencyNode[]>([]);
  let flowEdges = $state<Edge[]>([]);
  let fitSeq = 0;
  let flowReady = $state(false);
  let layoutFrame: number | null = null;
  let fitTimeouts = $state<Array<ReturnType<typeof setTimeout>>>([]);
  let graphHydrationRequestVersion = 0;
  let graphHydrationBusy = $state(false);
  let graphHydrationRetryTimeout: ReturnType<typeof setTimeout> | null = null;
  const GRAPH_HYDRATION_RETRY_DELAY_MS = 1800;

  const beginGraphHydrationRequest = (): number => {
    graphHydrationRequestVersion += 1;
    return graphHydrationRequestVersion;
  };

  const isGraphHydrationRequestActive = (requestVersion: number): boolean =>
    requestVersion === graphHydrationRequestVersion;

  const graphNeedsHydration = (nodes: StudioDependencyNode[]): boolean =>
    nodes.length === 0 || nodes.some((node) => node.data.placeholder === true);

  const clearGraphHydrationRetryTimeout = () => {
    if (graphHydrationRetryTimeout === null) return;
    if (typeof clearTimeout === "function") {
      clearTimeout(graphHydrationRetryTimeout);
    }
    graphHydrationRetryTimeout = null;
  };

  const scheduleGraphHydrationRetry = () => {
    clearGraphHydrationRetryTimeout();
    if (typeof setTimeout !== "function") {
      graphRevision += 1;
      return;
    }
    graphHydrationRetryTimeout = setTimeout(() => {
      graphHydrationRetryTimeout = null;
      graphRevision += 1;
    }, GRAPH_HYDRATION_RETRY_DELAY_MS);
  };

  const hydrateParticleDependencyRecords = async (
    rootParticleId: string,
    requestVersion: number,
  ): Promise<void> => {
    const queue: string[] = [rootParticleId.trim()];
    const seen = new SvelteSet<string>();
    let guard = 0;

    while (queue.length > 0 && guard < 96) {
      const current = queue.shift()?.trim() ?? "";
      if (!current || seen.has(current)) continue;
      seen.add(current);
      guard += 1;

      const record = await ensureParticleRecordLoadedById(current);
      if (!isGraphHydrationRequestActive(requestVersion)) return;
      if (!record) continue;

      record.dependencies.forEach((dependencyId) => {
        const normalizedDependency = dependencyId.trim();
        if (!normalizedDependency || seen.has(normalizedDependency)) return;
        queue.push(normalizedDependency);
      });
    }
  };

  const clearPendingFitTimers = () => {
    if (typeof clearTimeout !== "function") return;
    fitTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    fitTimeouts = [];
  };

  const handleNodeClick = (payload: { node?: StudioDependencyNode } | undefined) => {
    const node = payload?.node;
    if (!node || node.data.kind !== "particle") return;
    if (node.data.particleId) onParticleOpen?.(node.data.particleId);
  };

  const openAnnouncedParticle = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onParticleOpen?.(particleId);
  };

  const scheduleLayout = () => {
    if (typeof requestAnimationFrame !== "function") return;
    if (!flowShellEl) return;
    if (layoutFrame !== null) cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = null;
      layoutFeatureClusters();
    });
  };

  const measureNodeSize = (nodeId: string, fallback: { width: number; height: number }) => {
    if (!flowShellEl) return fallback;
    const el = flowShellEl.querySelector<HTMLElement>(`.svelte-flow__node[data-id="${nodeId}"]`);
    if (!el) return fallback;
    const rect = el.getBoundingClientRect();
    const zoom = Math.max(0.1, flowApi?.getZoom?.() ?? 1);
    return {
      width: rect.width / zoom,
      height: rect.height / zoom,
    };
  };

  const fallbackNodeSize = (node: StudioDependencyNode): { width: number; height: number } => {
    switch (node.data.kind) {
      case "feature":
      case "connector":
        return { width: 360, height: 190 };
      case "dimension":
        return { width: 220, height: 120 };
      case "particle":
        return { width: 180, height: 78 };
      case "condition":
        return { width: 220, height: 90 };
      default:
        return { width: 180, height: 80 };
    }
  };

  const boxesOverlap = (
    lhs: { x: number; y: number; width: number; height: number },
    rhs: { x: number; y: number; width: number; height: number },
    padding = 26,
  ) =>
    lhs.x < rhs.x + rhs.width + padding &&
    lhs.x + lhs.width + padding > rhs.x &&
    lhs.y < rhs.y + rhs.height + padding &&
    lhs.y + lhs.height + padding > rhs.y;

  const enforceNodeSpacing = (sourceNodes: StudioDependencyNode[]) => {
    if (!flowShellEl || !sourceNodes.length) return sourceNodes;

    const placed: Array<{ x: number; y: number; width: number; height: number }> = [];
    const nextNodes = sourceNodes.map((node) => ({
      ...node,
      position: { ...node.position },
    }));
    const byId = new SvelteMap(nextNodes.map((node) => [node.id, node] as const));
    let changed = false;

    const ordered = [...nextNodes].sort(
      (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
    );

    ordered.forEach((node) => {
      const current = byId.get(node.id);
      if (!current) return;
      const size = measureNodeSize(current.id, fallbackNodeSize(current));
      let x = current.position.x;
      let y = current.position.y;
      let guard = 0;
      while (guard < 240) {
        const overlap = placed.find((other) =>
          boxesOverlap({ x, y, width: size.width, height: size.height }, other),
        );
        if (!overlap) break;
        x = overlap.x + overlap.width + 26;
        guard += 1;
      }
      if (Math.abs(current.position.x - x) > 0.5 || Math.abs(current.position.y - y) > 0.5) {
        current.position = { x, y };
        changed = true;
      }
      placed.push({ x, y, width: size.width, height: size.height });
    });

    return changed ? nextNodes : sourceNodes;
  };

  const getDimensionNodesForFeature = (featureId: string) =>
    flowNodes.filter(
      (node) => node.data.kind === "dimension" && node.data.parentFeatureId === featureId,
    );

  const getCompositeForDimension = (dimensionId: string) => {
    const edge = flowEdges.find(
      (item) => item.source === dimensionId && item.sourceHandle === "out",
    );
    if (!edge?.target) return null;
    const target = flowNodes.find((node) => node.id === edge.target);
    if (!target || target.data.kind !== "particle") return null;
    return target;
  };

  const layoutFeatureClusters = () => {
    if (!flowShellEl || !flowNodes.length) return;

    const updates = new SvelteMap<string, { x: number; y: number }>();
    const gapX = 24;
    const gapY = 48;
    const defaultSize = { width: 160, height: 60 };
    const defaultDimensionSize = { width: 180, height: 80 };

    flowNodes
      .filter((node) => node.data.kind === "feature" || node.data.kind === "connector")
      .forEach((feature) => {
        const dimensions = getDimensionNodesForFeature(feature.id).sort(
          (a, b) => (a.data.dimensionIndex ?? 0) - (b.data.dimensionIndex ?? 0),
        );
        if (!dimensions.length) return;

        const featureSize = measureNodeSize(feature.id, defaultSize);
        const dimensionSizes = dimensions.map((dimension) =>
          measureNodeSize(dimension.id, defaultDimensionSize),
        );
        const maxDimensionHeight = Math.max(...dimensionSizes.map((size) => size.height));

        const totalWidth =
          dimensionSizes.reduce((sum, size) => sum + size.width, 0) +
          gapX * Math.max(0, dimensions.length - 1);
        const featureCenter = feature.position.x + featureSize.width / 2;
        let cursorX = featureCenter - totalWidth / 2;

        const dimensionRowY = feature.position.y + featureSize.height + gapY;
        const compositeRowY = dimensionRowY + maxDimensionHeight + gapY;

        dimensions.forEach((dimension, index) => {
          const size = dimensionSizes[index] ?? defaultDimensionSize;
          const nextX = cursorX;
          const nextY = dimensionRowY;

          if (
            Math.abs(dimension.position.x - nextX) > 0.5 ||
            Math.abs(dimension.position.y - nextY) > 0.5
          ) {
            updates.set(dimension.id, { x: nextX, y: nextY });
          }

          const composite = getCompositeForDimension(dimension.id);
          if (composite) {
            const compositeSize = measureNodeSize(composite.id, defaultSize);
            const compositeX = nextX + (size.width - compositeSize.width) / 2;
            if (
              Math.abs(composite.position.x - compositeX) > 0.5 ||
              Math.abs(composite.position.y - compositeRowY) > 0.5
            ) {
              updates.set(composite.id, { x: compositeX, y: compositeRowY });
            }
          }

          cursorX += size.width + gapX;
        });
      });

    const nextNodes = updates.size
      ? flowNodes.map((node) => {
          const update = updates.get(node.id);
          return update ? { ...node, position: update } : node;
        })
      : flowNodes;
    const spaced = enforceNodeSpacing(nextNodes);
    if (spaced !== flowNodes) {
      flowNodes = spaced;
    }
  };

  const fitFlow = async () => {
    if (!flowApi?.fitView) return;
    const seq = ++fitSeq;
    await tick();
    if (seq !== fitSeq) return;
    const stablePadding = 0.22;
    const runFit = (padding: number) => {
      if (seq !== fitSeq || !flowApi?.fitView) return;
      flowApi.fitView({ padding, duration: 0 });
    };

    runFit(stablePadding);

    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        runFit(stablePadding);
        requestAnimationFrame(() => {
          runFit(stablePadding);
        });
      });
    }

    if (typeof setTimeout === "function") {
      clearPendingFitTimers();
      const registerFitTimeout = (delay: number) => {
        const timeoutId = setTimeout(() => {
          fitTimeouts = fitTimeouts.filter((entry) => entry !== timeoutId);
          runFit(stablePadding);
        }, delay);
        fitTimeouts = [...fitTimeouts, timeoutId];
      };
      registerFitTimeout(80);
      registerFitTimeout(220);
      registerFitTimeout(420);
    }
  };

  $effect(() => {
    void graphSignature;
    flowNodes = builtNodes.map((node) => ({ ...node, position: { ...node.position } }));
    flowEdges = builtEdges.map((edge) => ({ ...edge }));
    scheduleLayout();
  });

  $effect(() => {
    void graphSignature;
    if (!flowApi || !flowReady) return;
    scheduleLayout();
    void fitFlow();
  });

  $effect(() => {
    const normalizedParticleId = particleId.trim();
    if (!normalizedParticleId) return;
    if (!graphNeedsHydration(builtNodes)) return;
    if (graphHydrationBusy) return;
    graphHydrationBusy = true;

    const requestVersion = beginGraphHydrationRequest();
    void hydrateParticleDependencyRecords(normalizedParticleId, requestVersion)
      .then(() => {
        if (!isGraphHydrationRequestActive(requestVersion)) return;
        graphRevision += 1;
        scheduleLayout();
        graphHydrationBusy = false;

        const hydratedNodes = buildParticleDependencyGraph(normalizedParticleId).nodes;
        if (graphNeedsHydration(hydratedNodes)) {
          scheduleGraphHydrationRetry();
        }
      })
      .catch((error) => {
        if (!isGraphHydrationRequestActive(requestVersion)) return;
        console.warn("[Social flow] Failed to hydrate dependency graph records.", error);
        graphHydrationBusy = false;
        scheduleGraphHydrationRetry();
      });
  });

  onMount(() => {
    return () => {
      graphHydrationRequestVersion += 1;
      graphHydrationBusy = false;
      clearGraphHydrationRetryTimeout();
      if (layoutFrame !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(layoutFrame);
        layoutFrame = null;
      }
      clearPendingFitTimers();
      flowReady = false;
      flowApi = null;
    };
  });
</script>

<div
  class="social-dependency-flow"
  bind:this={flowShellEl}
  style={`--social-flow-height: ${flowHeight}px;`}
>
  <button
    type="button"
    class="flow-expand-btn"
    aria-label="Open announced connector in studio"
    title="Open in Studio"
    onclick={openAnnouncedParticle}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9V4h5"></path>
      <path d="M15 4h5v5"></path>
      <path d="M20 15v5h-5"></path>
      <path d="M9 20H4v-5"></path>
    </svg>
  </button>
  {#key `${particleId}:${builtNodes.length}:${builtEdges.length}`}
    <SvelteFlow
      id={flowId}
      bind:nodes={flowNodes}
      bind:edges={flowEdges}
      {nodeTypes}
      defaultEdgeOptions={{
        style: "stroke: var(--studio-flow-pattern); stroke-width: 1.4px;",
      }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag
      zoomOnScroll
      zoomOnDoubleClick={false}
      zoomOnPinch
      minZoom={0.12}
      maxZoom={1.8}
      onnodeclick={handleNodeClick}
      proOptions={{ hideAttribution: true }}
    >
      <FlowInstanceBridge
        onReady={(api) => {
          flowApi = { fitView: api.fitView, getZoom: api.getZoom };
          flowReady = true;
          scheduleLayout();
          void fitFlow();
        }}
      />
      <Background bgColor="var(--studio-flow-bg)" patternColor="var(--studio-flow-pattern)" />
    </SvelteFlow>
  {/key}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .social-dependency-flow {
    @apply relative h-full w-full overflow-hidden rounded-2xl border;
    height: var(--social-flow-height);
    background: var(--studio-flow-bg);
    border-color: var(--border-subtle);
  }

  .flow-expand-btn {
    @apply absolute right-2 top-2 z-10 h-8 w-8 rounded-lg border transition;
    display: grid;
    place-items: center;
    backdrop-filter: blur(8px);
    background: var(--surface-floating);
    border-color: var(--border-subtle);
    color: var(--text-muted);
  }

  .flow-expand-btn:hover {
    background: var(--surface-floating-hover);
    border-color: var(--border-strong);
    color: var(--text-primary);
  }

  .flow-expand-btn svg {
    width: 15px;
    height: 15px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .social-dependency-flow :global(.svelte-flow) {
    @apply rounded-2xl;
    --xy-background-color: var(--studio-flow-bg);
    --xy-background-pattern-color: var(--studio-flow-pattern);
    --xy-background-pattern-dots-color-default: var(--studio-flow-pattern);
    --xy-background-pattern-lines-color-default: var(--studio-flow-pattern);
    --xy-background-pattern-cross-color-default: var(--studio-flow-pattern);
  }

  .social-dependency-flow :global(.svelte-flow__attribution) {
    display: none;
  }

  .social-dependency-flow :global(.svelte-flow__controls) {
    display: none;
  }

  .social-dependency-flow :global(.svelte-flow__panel) {
    display: none;
  }

  .social-dependency-flow :global(.svelte-flow__background path) {
    stroke: var(--studio-flow-pattern);
  }

  .social-dependency-flow :global(.svelte-flow__edge-path) {
    stroke: var(--studio-flow-pattern);
    stroke-width: 1.25px;
  }

  .social-dependency-flow :global(.svelte-flow__edge-text) {
    fill: var(--text-primary) !important;
  }

  .social-dependency-flow :global(.svelte-flow__edge-textbg) {
    fill: transparent !important;
    stroke: transparent !important;
  }

  .social-dependency-flow :global(.svelte-flow__edge-label) {
    color: var(--text-primary) !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    text-shadow: none;
  }

  .social-dependency-flow :global(.svelte-flow__edge-label-renderer .svelte-flow__edge-label) {
    color: var(--text-primary) !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    text-shadow: none;
  }
</style>
