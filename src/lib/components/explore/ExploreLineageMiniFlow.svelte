<script lang="ts">
  import { Background, SvelteFlow } from "@xyflow/svelte";
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
</script>

<div class="mini-flow">
  <SvelteFlow
    {nodes}
    {edges}
    {nodeTypes}
    {edgeTypes}
    defaultEdgeOptions={{
      style: { stroke: "rgba(255,255,255,0.45)", strokeWidth: 1.6 },
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
    <Background bgColor="black" />
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
    @apply relative h-[260px] w-full rounded-2xl border border-white/10 bg-black/40;
  }

  .mini-flow :global(.svelte-flow) {
    @apply rounded-2xl;
  }

  .mini-flow :global(.svelte-flow__node-default) {
    @apply rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[0.65rem]
      font-semibold uppercase tracking-[0.2em] text-white/80;
  }

  .mini-flow :global(.svelte-flow__edge-path) {
    stroke: rgba(255, 255, 255, 0.3);
    stroke-width: 1.5px;
  }

  .mini-flow :global(.svelte-flow__edge) {
    pointer-events: none;
  }

  .node-popup {
    @apply absolute top-3 right-3 z-10 w-[280px] max-h-[240px]
      overflow-y-auto border border-white/15 bg-black/90
      p-3 text-xs text-white/70 shadow-xl;
  }

  .popup-head {
    @apply flex items-start justify-between gap-2 border-b border-white/10 pb-2 mb-3;
  }

  .popup-title {
    @apply text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-white/80;
  }

  .popup-close {
    @apply text-white/50 hover:text-white/80;
  }

  .popup-list {
    @apply space-y-4;
  }

  .popup-row {
    @apply space-y-2 rounded-lg border border-white/10 bg-black/40 p-2;
  }

  .popup-meta {
    @apply flex flex-wrap items-center justify-between gap-2;
  }

  .popup-label {
    @apply text-[0.6rem] uppercase tracking-[0.2em] text-white/60;
  }

  .popup-seed {
    @apply text-[0.55rem] uppercase tracking-[0.2em] text-white/35;
  }

  .popup-inputs {
    @apply grid gap-2;
  }
</style>
