<script lang="ts">
  import { BaseEdge, EdgeLabel, getBezierPath } from "@xyflow/svelte";
  import type { Edge as FlowEdge, EdgeProps } from "@xyflow/svelte";

  type LineageEdgeData = {
    label?: string;
    transformations?: string[];
  };

  type LineageEdge = FlowEdge<LineageEdgeData, "lineage">;

  const {
    id,
    data,
    label: edgeLabel,
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    markerStart,
    markerEnd,
    interactionWidth,
  }: EdgeProps<LineageEdge> = $props();

  const [edgePath, labelX, labelY] = $derived(
    getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    }),
  );

  const label = $derived(edgeLabel ?? data?.label ?? "composite");
  const transformations = $derived(data?.transformations ?? []);
</script>

<BaseEdge
  {id}
  path={edgePath}
  {markerStart}
  {markerEnd}
  {interactionWidth}
  style="stroke: rgba(255,255,255,0.55); stroke-width: 1.8px;"
/>

<EdgeLabel
  x={labelX}
  y={labelY}
  class="nodrag nopan pointer-events-auto edge-label lineage-edge-label"
>
  <div class="edge-title">{label}</div>
  {#if transformations.length > 0}
    <ul class="edge-list">
      {#each transformations as transformation, index (index)}
        <li>{transformation}</li>
      {/each}
    </ul>
  {:else}
    <div class="edge-empty">No transforms</div>
  {/if}
</EdgeLabel>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  :global(.svelte-flow__edge-label.lineage-edge-label) {
    @apply px-1 py-0.5 text-[0.65rem] text-white/85;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
  }

  .edge-title {
    @apply text-[0.6rem] uppercase tracking-[0.24em] text-white/60;
  }

  .edge-list {
    @apply mt-1 space-y-1 text-xs text-white/80;
  }

  .edge-empty {
    @apply mt-1 text-[0.65rem] text-white/40;
  }
</style>
