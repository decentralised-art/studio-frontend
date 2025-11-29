<script lang="ts">
  import {
    BaseEdge,
    getBezierPath,
    type EdgeProps,
  } from "@xyflow/svelte";

  import type { DimensionEdgeType } from "./FlowEditorTypes";

  let {
    id,
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
    data,
  }: EdgeProps<DimensionEdgeType> = $props();

  // getBezierPath returns [path, labelX, labelY]
  let [edgePath, labelX, labelY] = $derived(
    getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    })
  );

  const text = $derived(data?.label ?? label ?? "Dim");
</script>

<BaseEdge
  {id}
  path={edgePath}
  {markerStart}
  {markerEnd}
  {interactionWidth}
  {label}
  {labelStyle}
/>

<!-- Custom SVG label group -->
<svg class="overflow-visible absolute pointer-events-none">
  <g transform={`translate(${labelX},${labelY})`}>
    <!-- Label text -->
    <text fill="white" text-anchor="middle" dominant-baseline="middle">
      {text}
    </text>
  </g>
</svg>
