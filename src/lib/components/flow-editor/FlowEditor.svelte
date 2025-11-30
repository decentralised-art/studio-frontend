<script lang="ts">
  import {
    SvelteFlow,
    Background,
    type Connection,
    type OnConnect,
    type IsValidConnection,
  } from "@xyflow/svelte";

  import "@xyflow/svelte/dist/style.css";

  import FlowEditorPanel from "./EditorPanel.svelte";
  import FlowEditorResultPanel from "./ResultPanel.svelte";

  // Svelte components (runtime)
  import FeatureNode from "./FeatureNode.svelte";
  import DimensionEdge from "./DimensionEdge.svelte";

  // Types
  import type {
    FeatureNodeType,
    DimensionEdgeType,
    FlowNode,
    FlowEdge,
  } from "./flowEditorTypes";

  import { addingConnectionCreatesCycle } from "./graphUtils";

  // map to components
  const nodeTypes = {
    feature: FeatureNode,
  };

  const edgeTypes = {
    dimension: DimensionEdge,
  };

  let nodes = $state.raw<FlowNode[]>([]);
  let edges = $state.raw<FlowEdge[]>([]);

  function addNode(kind: "feature") {
    if (kind === "feature") {
      const newNode: FeatureNodeType = {
        id: crypto.randomUUID(),
        type: "feature", // must match nodeTypes key
        position: {
          x: 120 + Math.round(Math.random() * 10),
          y: 80 + Math.round(Math.random() * 10),
        },
        data: { name: "" },
      };

      nodes = [...nodes, newNode];
    }
  }

  // Reject connections that would create a cycle
  const isValidConnection: IsValidConnection = (edgeOrConn) => {
    // Normalize input → always return a Connection-like object
    const connection =
      "source" in edgeOrConn && "target" in edgeOrConn
        ? ({
            source: edgeOrConn.source,
            target: edgeOrConn.target,
            sourceHandle: edgeOrConn.sourceHandle,
            targetHandle: edgeOrConn.targetHandle,
          } as Connection)
        : null;

    // If we couldn't normalize, allow by default
    if (!connection) return true;

    // Reject if it creates a cycle
    return !addingConnectionCreatesCycle(nodes, edges, connection);
  };

  const handleConnect: OnConnect = (connection: Connection) => {
    const edge: DimensionEdgeType = {
      id: crypto.randomUUID(),
      type: "dimension",
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      data: {
        defs: [],
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
      bind:nodes
      bind:edges
      {nodeTypes}
      {edgeTypes}
      onconnect={handleConnect}
      {isValidConnection}
      fitView
    >
      <Background bgColor="black" />
    </SvelteFlow>
  </div>
  <FlowEditorResultPanel {nodes} {edges} />
</div>
