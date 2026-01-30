<script lang="ts">
  import { BaseEdge, EdgeLabel, getBezierPath } from "@xyflow/svelte";
  import type { EdgeProps } from "@xyflow/svelte";

  type LineageEdgeData = {
    label?: string;
    transformations?: string[];
  };

  type LineageEdgeProps = EdgeProps<LineageEdgeData> & {
    transformations?: string[];
  };

  const {
    id,
    data,
    label: edgeLabel,
    transformations: edgeTransformations,
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    markerStart,
    markerEnd,
    interactionWidth,
  }: LineageEdgeProps = $props();

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
  const transformations = $derived(edgeTransformations ?? data?.transformations ?? []);
</script>

<BaseEdge
  {id}
  path={edgePath}
  {markerStart}
  {markerEnd}
  {interactionWidth}
  style="stroke: rgba(255,255,255,0.55); stroke-width: 1.8px;"
/>

<EdgeLabel x={labelX} y={labelY} class="nodrag nopan pointer-events-auto edge-label">
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

  :global(.edge-label) {
    @apply rounded-lg border border-white/15 bg-black/80 px-3 py-2 text-[0.65rem]
      text-white/80 shadow-lg;
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
