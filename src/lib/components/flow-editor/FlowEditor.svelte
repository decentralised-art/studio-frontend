<script lang="ts">
  import { setContext } from "svelte";

  import {
    SvelteFlow,
    Background,
    type Connection,
    type OnConnect,
    type IsValidConnection,
    getBezierPath,
    type OnSelectionChange,
  } from "@xyflow/svelte";

  import "@xyflow/svelte/dist/style.css";

  import FlowEditorPanel from "./EditorPanel.svelte";
  import FlowEditorResultPanel from "./ResultPanel.svelte";

  // Svelte components (runtime)
  import FeatureNode from "./FeatureNode.svelte";
  import DimensionEdge from "./DimensionEdge.svelte";

  // Types
  import type { FeatureNodeType, DimensionEdgeType, FlowNode, FlowEdge } from "./flowEditorTypes";

  import { addingConnectionCreatesCycle } from "./graphUtils";
  import type { ApiFeature } from "$lib/dcn/dcnApi";
  import { SvelteSet } from "svelte/reactivity";

  // map to components
  const nodeTypes = {
    feature: FeatureNode,
  };

  const edgeTypes = {
    dimension: DimensionEdge,
  };

  let nodes = $state.raw<FlowNode[]>([]);
  let edges = $state.raw<FlowEdge[]>([]);

  // track selected node id (or undefined)
  let selectedNodeId = $state<string | undefined>(undefined);

  // --- Helper: find node by data.name ---
  function findNodeIdByFeatureName(name: string): string | undefined {
    return nodes.find((n) => n.type === "feature" && n.data?.name === name)?.id;
  }

  function addNode(
    kind: "feature",
    newNode: FeatureNodeType = {
      id: crypto.randomUUID(),
      type: "feature", // must match nodeTypes key
      position: {
        x: 120 + Math.round(Math.random() * 10),
        y: 80 + Math.round(Math.random() * 10),
      },
      data: { name: "", exists_on_server: false },
    },
  ) {
    if (kind === "feature") {
      nodes = [...nodes, newNode];
    }

    return newNode.id;
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
        pathFn: getBezierPath,
      },
    };

    edges = [...edges, edge];
  };

  // react to selection changes from SvelteFlow
  const handleSelectionChange: OnSelectionChange<FlowNode, FlowEdge> = ({
    nodes: selectedNodes,
  }) => {
    selectedNodeId = selectedNodes[0]?.id ?? null;
  };

  function reset() {
    // restore to initial state by reassigning new arrays
    nodes = [];
    edges = [];
  }

  // --- Helper: add / update feature node in graph ---
  function ensureFeatureNode(
    apiFeature: ApiFeature,
    opts: { depth: number; index: number; reuseNodeId?: string } = {
      depth: 0,
      index: 0,
    },
  ): string {
    const { depth, index, reuseNodeId } = opts;
    const xSpacing = 260;
    const ySpacing = 300;

    let nodeId = reuseNodeId ?? findNodeIdByFeatureName(apiFeature.name);

    if (nodeId) {
      // update existing node
      nodes = nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                name: apiFeature.name,
                exists_on_server: true,
              },
            }
          : n,
      );
      return nodeId;
    }

    // create new node
    return addNode("feature", {
      id: crypto.randomUUID(),
      type: "feature",
      position: {
        x: 80 + index * xSpacing,
        y: 80 + depth * ySpacing,
      },
      data: {
        name: apiFeature.name,
        exists_on_server: true,
      },
    });
  }

  // --- Helper: add a dimension edge ---
  function addDimensionEdge(sourceId: string, targetId: string) {
    // avoid duplicates
    const already = edges.some(
      (e) => e.type === "dimension" && e.source === sourceId && e.target === targetId,
    );
    if (already) return;

    const edge: DimensionEdgeType = {
      id: crypto.randomUUID(),
      type: "dimension",
      source: sourceId,
      target: targetId,
      data: {
        defs: [],
        pathFn: getBezierPath,
      },
    };

    edges = [...edges, edge];
  }

  // --- recursively load feature graph from API ---
  async function loadFeatureGraphFromServer(rootNodeId: string, rootFeatureName: string) {
    const visited = new SvelteSet<string>();

    async function dfs(
      featureName: string,
      depth: number,
      parentNodeId: string | null,
      siblingIndex: number,
    ): Promise<string | null> {
      if (!featureName) return null;

      // already seen → just connect edge if needed
      if (visited.has(featureName)) {
        const existingId = findNodeIdByFeatureName(featureName);
        if (existingId && parentNodeId) {
          addDimensionEdge(parentNodeId, existingId);
        }
        return existingId ?? null;
      }

      visited.add(featureName);

      const res = await fetch(
        `https://api.decentralised.art/feature/${encodeURIComponent(featureName)}`,
        { method: "GET", cache: "no-store" },
      );

      if (!res.ok) {
        console.warn("Failed to GET feature", featureName, res.status);
        return null;
      }

      const apiFeature: ApiFeature = await res.json();

      // determine if this is the root node
      const isRoot = parentNodeId === null;

      // if root → reuse existing root node id
      const nodeId = ensureFeatureNode(apiFeature, {
        depth,
        index: siblingIndex,
        reuseNodeId: isRoot ? rootNodeId : undefined,
      });

      if (parentNodeId && nodeId !== parentNodeId) {
        // edge: child (dimension feature) → parent feature
        addDimensionEdge(parentNodeId, nodeId);
      }

      const dimensions = apiFeature.dimensions ?? [];
      let i = 0;
      for (const dim of dimensions) {
        if (!dim.feature_name) continue;
        await dfs(dim.feature_name, depth + 1, nodeId, i++);
      }

      return nodeId;
    }

    await dfs(rootFeatureName, 0, null, 0);
  }

  // Provide context for nodes
  const FLOW_CONTEXT_KEY = "flow-graph-loader";

  setContext(FLOW_CONTEXT_KEY, {
    loadFeatureGraphFromServer,
  });
</script>

<div class="editor">
  <div class="left">
    <FlowEditorPanel {addNode} {reset} />
  </div>
  <div class="flow">
    <SvelteFlow
      bind:nodes
      bind:edges
      {nodeTypes}
      {edgeTypes}
      onconnect={handleConnect}
      onselectionchange={handleSelectionChange}
      {isValidConnection}
      fitView
    >
      <Background bgColor="black" />
    </SvelteFlow>
  </div>
  <div class="right">
    {#if selectedNodeId !== undefined && selectedNodeId !== null}
      <FlowEditorResultPanel {nodes} {edges} {selectedNodeId} />
    {/if}
  </div>
</div>

<style>
  .editor {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: row;
    overflow: hidden;
  }

  .flow {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* THIS is the important part: make SvelteFlow root stretch */
  .flow :global(.svelte-flow) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
</style>
