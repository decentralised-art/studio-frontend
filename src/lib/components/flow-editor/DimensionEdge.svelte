<script lang="ts">
  import { BaseEdge, EdgeLabel, getBezierPath, useEdges } from "@xyflow/svelte";

  import type { DimensionEdgePropsType, DimensionData, TransformationDef } from "./flowEditorTypes";

  import TransformationDefComp from "./TransformationDef.svelte";

  let {
    id,
    data,

    sourceX,
    sourceY,
    sourcePosition,

    targetX,
    targetY,
    targetPosition,

    markerStart,
    markerEnd,

    interactionWidth,

    label,
    labelStyle,
  }: DimensionEdgePropsType = $props();

  // global state
  const edges = useEdges();

  // local UI state – collapsed or expanded
  let collapsed = $state(false);

  // local derived state
  let [edgePath, labelX, labelY] = $derived(
    data === undefined
      ? getBezierPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition,
          targetPosition,
        })
      : data.pathFn({
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition,
          targetPosition,
        }),
  );

  // local derived state
  const defs = $derived(data?.defs ?? []);

  function toggleCollapsed() {
    collapsed = !collapsed;
  }

  function addDef() {
    const newDef: TransformationDef = {
      id: crypto.randomUUID(),
      name: "",
      args: [],
    };

    edges.update((es) =>
      es.map((edge) =>
        edge.id === id
          ? {
              ...edge,
              data: {
                ...(edge.data ?? {}),
                defs: [...((edge.data as DimensionData)?.defs ?? []), newDef],
              },
            }
          : edge,
      ),
    );
  }

  function removeDef(defId: string) {
    edges.update((es) =>
      es.map((edge) =>
        edge.id === id
          ? {
              ...edge,
              data: {
                ...(edge.data ?? {}),
                defs: ((edge.data as DimensionData)?.defs ?? []).filter(
                  (d: TransformationDef) => d.id !== defId,
                ),
              },
            }
          : edge,
      ),
    );
  }
</script>

<BaseEdge {id} path={edgePath} {markerStart} {markerEnd} {interactionWidth} {label} {labelStyle} />

<EdgeLabel
  x={labelX}
  y={labelY}
  class="nodrag nopan pointer-events-auto 
  rounded-md bg-black! text-white border border-white/20 text-xs p-2! min-w-[140px] space-y-2 shadow-lg"
>
  <div class="flex items-center gap-2 justify-between">
    <div class="flex items-center gap-1 justify-between">
      <span class="font-semibold">Transformations</span>
      <span class="text-[10px] text-white/60">({defs.length})</span>
    </div>

    <button
      class="w-4 h-4 flex items-center justify-center rounded border border-white/30 text-[10px] leading-none"
      onclick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        toggleCollapsed();
      }}
    >
      {#if collapsed}▸{:else}▾{/if}
    </button>
  </div>

  {#if !collapsed}
    {#if defs.length === 0}
      <p class="text-white/50 text-[10px]">No transformations yet</p>
    {:else}
      <div class="space-y-1 max-h-40 overflow-y-auto">
        {#each defs as def (def.id)}
          <div class="flex items-center justify-between gap-1">
            <TransformationDefComp {def} edgeId={id} />
            <button
              class="px-1 py-0.5 rounded bg-red-500/80 hover:bg-red-500 text-[9px]"
              onclick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                removeDef(def.id);
              }}
            >
              ✕
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <button
      class="px-1.5 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-[10px]"
      onclick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        addDef();
      }}
    >
      +
    </button>
  {/if}
</EdgeLabel>
