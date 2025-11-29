<script lang="ts">
  import {
    SvelteFlow,
    Background,
    type Connection,
    type OnConnect,
  } from "@xyflow/svelte";
  import "@xyflow/svelte/dist/style.css";

  import FlowEditorPanel from "./FlowEditorPanel.svelte";

  // Svelte components (runtime)
  import FeatureNode from "./FlowEditorFeatureNode.svelte";
  import TransformationNode from "./FlowEditorTransformationNode.svelte";
  import DimensionEdge from "./FlowEditorDimensionEdge.svelte";

  // Types
  import type {
    FeatureNodeType,
    TransformationNodeType,
    DimensionEdgeType,
    FlowNode,
    FlowEdge,
  } from "./FlowEditorTypes";

  // map to components
  const nodeTypes = {
    feature: FeatureNode,
    transformation: TransformationNode,
  };

  const edgeTypes = {
    dimension: DimensionEdge,
  };

  let nodes = $state<FlowNode[]>([]);
  let edges = $state<FlowEdge[]>([]);

  function addNode(kind: "feature" | "transformation") {
    if (kind === "feature") {
      const newNode: FeatureNodeType = {
        id: crypto.randomUUID(),
        type: "feature", // must match nodeTypes key
        position: { x: 120, y: 80 },
        data: { label: "Feature" },
      };

      nodes = [...nodes, newNode];
    }

    if (kind === "transformation") {
      const newNode: TransformationNodeType = {
        id: crypto.randomUUID(),
        type: "transformation", // must match nodeTypes key
        position: { x: 120, y: 80 },
        data: { label: "Transformation" },
      };

      nodes = [...nodes, newNode];
    }
  }

  const handleConnect: OnConnect = (connection: Connection) => {
    const edge: DimensionEdgeType = {
      id: crypto.randomUUID(),
      type: "dimension",
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      data: {
        label: "Dim",
        dimension: 42,
      },
    };

    edges = [...edges, edge];
  };

  function reset() {
    // restore to initial state by reassigning new arrays
    nodes = [];
    edges = [];
  }
</script>

<div class="flex w-full h-[85vh]">
  <FlowEditorPanel {addNode} {reset} />
  <div class="flex-1 h-full">
    <SvelteFlow
      {nodes}
      {edges}
      {nodeTypes}
      {edgeTypes}
      onconnect={handleConnect}
      fitView
    >
      <Background bgColor="black" />
    </SvelteFlow>
  </div>
</div>
