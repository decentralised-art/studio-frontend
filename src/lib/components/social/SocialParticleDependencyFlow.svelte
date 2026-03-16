<script lang="ts">
  import { Background, SvelteFlow, type Edge, type NodeTypes } from "@xyflow/svelte";
  import { SvelteMap } from "svelte/reactivity";
  import { tick } from "svelte";
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

  const {
    particleId,
    onParticleOpen,
    displayMode = "card",
  }: {
    particleId: string;
    onParticleOpen?: ((particleId: string) => void) | undefined;
    displayMode?: "card" | "page";
  } = $props();

  const graph = $derived.by(() => buildParticleDependencyGraph(particleId));
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
      setTimeout(() => runFit(stablePadding), 80);
      setTimeout(() => runFit(stablePadding), 220);
      setTimeout(() => runFit(stablePadding), 420);
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
        style: { stroke: "rgba(255,255,255,0.28)", strokeWidth: 1.4 },
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
      <Background bgColor="black" />
    </SvelteFlow>
  {/key}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .social-dependency-flow {
    @apply relative h-full w-full rounded-2xl border border-white/10 bg-black/40 overflow-hidden;
    height: var(--social-flow-height);
  }

  .flow-expand-btn {
    @apply absolute top-2 right-2 z-10 h-8 w-8 rounded-lg border border-white/15 bg-black/70
      text-white/80 transition hover:border-white/35 hover:text-white hover:bg-black/85;
    display: grid;
    place-items: center;
    backdrop-filter: blur(8px);
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
    stroke: rgba(255, 255, 255, 0.04);
  }

  .social-dependency-flow :global(.svelte-flow__edge-path) {
    stroke: rgba(255, 255, 255, 0.24);
    stroke-width: 1.25px;
  }

  .social-dependency-flow :global(.svelte-flow__edge-text) {
    fill: rgba(255, 255, 255, 0.9) !important;
  }

  .social-dependency-flow :global(.svelte-flow__edge-textbg) {
    fill: transparent !important;
    stroke: transparent !important;
  }

  .social-dependency-flow :global(.svelte-flow__edge-label) {
    color: rgba(255, 255, 255, 0.92) !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
  }

  .social-dependency-flow :global(.svelte-flow__edge-label-renderer .svelte-flow__edge-label) {
    color: rgba(255, 255, 255, 0.92) !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
  }
</style>
