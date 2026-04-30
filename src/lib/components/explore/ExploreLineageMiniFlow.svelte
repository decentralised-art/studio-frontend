<script lang="ts">
  import { Background, SvelteFlow } from "@xyflow/svelte";
  import { SvelteMap } from "svelte/reactivity";
  import "@xyflow/svelte/dist/style.css";

  import type {
    LineageEdge,
    LineageNode,
    MockRunDescriptor,
    RunInstanceInput,
  } from "$lib/particles/mockPtNetwork";
  import Input from "$lib/components/ui/Input.svelte";
  import LineageEdgeCard from "$lib/components/explore/LineageEdge.svelte";
  import LineageNodeCard from "$lib/components/explore/LineageNode.svelte";

  let {
    nodes = [],
    edges = [],
    runDescriptors = [],
    runInstances = [],
    onRunInstanceChange,
  }: {
    nodes?: LineageNode[];
    edges?: LineageEdge[];
    runDescriptors?: MockRunDescriptor[];
    runInstances?: RunInstanceInput[];
    onRunInstanceChange?: (
      index: number,
      field: "startPoint" | "transformShift",
      value: string,
    ) => void;
  } = $props();

  let activeNodeId = $state<string | null>(null);

  const descriptorsByParticle = $derived.by(() => {
    const map: Record<string, number[]> = {};
    runDescriptors.forEach((descriptor, index) => {
      map[descriptor.particle] = [...(map[descriptor.particle] ?? []), index];
    });
    return map;
  });

  const activeNode = $derived.by(() =>
    activeNodeId ? (nodes.find((node) => node.id === activeNodeId) ?? null) : null,
  );

  const activeDescriptorIndexes = $derived.by(() => {
    if (!activeNodeId) return [];
    return descriptorsByParticle[activeNodeId] ?? [];
  });

  const handleNodeClick = ({ node }: { node: LineageNode }) => {
    activeNodeId = node.id;
  };

  const handlePaneClick = () => {
    activeNodeId = null;
  };

  const nodeTypes = {
    lineage: LineageNodeCard,
  };

  const edgeTypes = {
    lineage: LineageEdgeCard,
  };

  const normalizedNodes = $derived.by(() => {
    if (!nodes.length) return nodes;
    const cardWidth = 220;
    const cardHeight = 72;
    const padding = 18;
    const placed: Array<{ x: number; y: number; width: number; height: number }> = [];
    const nextNodes = nodes.map((node) => ({
      ...node,
      position: { ...node.position },
    }));
    const byId = new SvelteMap(nextNodes.map((node) => [node.id, node] as const));
    const ordered = [...nextNodes].sort(
      (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
    );

    const overlaps = (
      lhs: { x: number; y: number; width: number; height: number },
      rhs: { x: number; y: number; width: number; height: number },
    ) =>
      lhs.x < rhs.x + rhs.width + padding &&
      lhs.x + lhs.width + padding > rhs.x &&
      lhs.y < rhs.y + rhs.height + padding &&
      lhs.y + lhs.height + padding > rhs.y;

    ordered.forEach((node) => {
      const current = byId.get(node.id);
      if (!current) return;
      let x = current.position.x;
      let y = current.position.y;
      let guard = 0;
      while (guard < 200) {
        const overlapping = placed.find((other) =>
          overlaps({ x, y, width: cardWidth, height: cardHeight }, other),
        );
        if (!overlapping) break;
        y = overlapping.y + overlapping.height + padding;
        guard += 1;
      }
      current.position = { x, y };
      placed.push({ x, y, width: cardWidth, height: cardHeight });
    });

    return nextNodes;
  });

  const normalizedEdges = $derived.by(() =>
    edges.map((edge) => ({
      ...edge,
      type: "lineage" as const,
    })),
  );
</script>

<div class="mini-flow">
  <SvelteFlow
    nodes={normalizedNodes}
    edges={normalizedEdges}
    {nodeTypes}
    {edgeTypes}
    defaultEdgeOptions={{
      style: "stroke: var(--studio-flow-pattern); stroke-width: 1.6px;",
    }}
    fitView
    fitViewOptions={{ padding: 0.25 }}
    nodesDraggable
    nodesConnectable={false}
    elementsSelectable
    onnodeclick={handleNodeClick}
    onpaneclick={handlePaneClick}
    zoomOnScroll
    zoomOnPinch
    minZoom={0.3}
    maxZoom={2}
    panOnScroll={false}
    panOnDrag
  >
    <Background bgColor="var(--studio-flow-bg)" patternColor="var(--studio-flow-pattern)" />
  </SvelteFlow>
  {#if activeNode}
    <div
      class="node-popup"
      role="dialog"
      tabindex="-1"
      onclick={(event) => event.stopPropagation()}
      onkeydown={(event) => event.stopPropagation()}
    >
      <div class="popup-head">
        <div class="popup-title">{activeNode.data?.label ?? activeNode.id}</div>
        <button class="popup-close" type="button" onclick={() => (activeNodeId = null)}> ✕ </button>
      </div>
      <div class="popup-list">
        {#each activeDescriptorIndexes as descriptorIndex (descriptorIndex)}
          {#if runDescriptors[descriptorIndex]}
            <div class="popup-row">
              <div class="popup-meta">
                <span class="popup-label">{runDescriptors[descriptorIndex].dimension}</span>
                {#if typeof runDescriptors[descriptorIndex].seed === "number"}
                  <span class="popup-seed">
                    seed {runDescriptors[descriptorIndex].seed}
                  </span>
                {/if}
              </div>
              <div class="popup-inputs">
                <Input
                  label="Start"
                  type="number"
                  min="-999"
                  max="999"
                  step="1"
                  inputmode="numeric"
                  value={runInstances[descriptorIndex]?.startPoint ?? ""}
                  placeholder={typeof runDescriptors[descriptorIndex].seed === "number"
                    ? `${runDescriptors[descriptorIndex].seed}`
                    : ""}
                  oninput={(event) =>
                    onRunInstanceChange?.(
                      descriptorIndex,
                      "startPoint",
                      (event.currentTarget as HTMLInputElement | null)?.value ?? "",
                    )}
                />
                <Input
                  label="Shift"
                  type="number"
                  min="-64"
                  max="64"
                  step="1"
                  inputmode="numeric"
                  value={runInstances[descriptorIndex]?.transformShift ?? ""}
                  oninput={(event) =>
                    onRunInstanceChange?.(
                      descriptorIndex,
                      "transformShift",
                      (event.currentTarget as HTMLInputElement | null)?.value ?? "",
                    )}
                />
              </div>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .mini-flow {
    @apply relative h-[260px] w-full rounded-2xl border;
    background: var(--studio-flow-bg);
    border-color: var(--border-subtle);
  }

  .mini-flow :global(.svelte-flow) {
    @apply rounded-2xl;
    --xy-background-color: var(--studio-flow-bg);
    --xy-background-pattern-color: var(--studio-flow-pattern);
    --xy-background-pattern-dots-color-default: var(--studio-flow-pattern);
    --xy-background-pattern-lines-color-default: var(--studio-flow-pattern);
    --xy-background-pattern-cross-color-default: var(--studio-flow-pattern);
  }

  .mini-flow :global(.svelte-flow__node-default) {
    @apply rounded-xl border px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em];
    background: var(--studio-node-bg);
    border-color: var(--studio-node-border);
    color: var(--text-secondary);
  }

  .mini-flow :global(.svelte-flow__edge-path) {
    stroke: var(--studio-flow-pattern);
    stroke-width: 1.5px;
  }

  .mini-flow :global(.svelte-flow__edge-text) {
    fill: var(--text-primary) !important;
  }

  .mini-flow :global(.svelte-flow__edge-textbg) {
    fill: transparent !important;
    stroke: transparent !important;
  }

  .mini-flow :global(.svelte-flow__edge-label) {
    color: var(--text-primary) !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    text-shadow: none;
  }

  .mini-flow :global(.svelte-flow__edge-label-renderer .svelte-flow__edge-label) {
    color: var(--text-primary) !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    text-shadow: none;
  }

  .mini-flow :global(.svelte-flow__edge) {
    pointer-events: none;
  }

  .node-popup {
    @apply absolute right-3 top-3 z-10 max-h-[240px] w-[280px] overflow-y-auto border p-3 text-xs shadow-xl;
    background: var(--surface-floating-hover);
    border-color: var(--border-subtle);
    color: var(--text-muted);
  }

  .popup-head {
    @apply mb-3 flex items-start justify-between gap-2 border-b pb-2;
    border-bottom-color: var(--border-subtle);
  }

  .popup-title {
    @apply text-[0.7rem] font-semibold uppercase tracking-[0.22em];
    color: var(--text-primary);
  }

  .popup-close {
    color: var(--text-muted);
  }

  .popup-close:hover {
    color: var(--text-primary);
  }

  .popup-list {
    @apply space-y-4;
  }

  .popup-row {
    @apply space-y-2 rounded-lg border p-2;
    background: var(--surface-panel-soft);
    border-color: var(--border-subtle);
  }

  .popup-meta {
    @apply flex flex-wrap items-center justify-between gap-2;
  }

  .popup-label {
    @apply text-[0.6rem] uppercase tracking-[0.2em];
    color: var(--text-muted);
  }

  .popup-seed {
    @apply text-[0.55rem] uppercase tracking-[0.2em];
    color: var(--text-faint);
  }

  .popup-inputs {
    @apply grid gap-2;
  }
</style>
