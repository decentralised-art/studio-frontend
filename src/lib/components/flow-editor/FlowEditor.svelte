<script lang="ts">
  import {
    SvelteFlow,
    Background,
    type Node,
    type Edge,
  } from "@xyflow/svelte";

  import "@xyflow/svelte/dist/style.css";

  // Import custom feature node
  import FlowEditorNode from "./FlowEditorNode.svelte";

  import FlowEditorPanel from "./FlowEditorPanel.svelte";

  const nodeTypes = {
    selectorNode: FlowEditorNode,
  };

  let nodes = $state<Node[]>([]);
  let edges = $state<Edge[]>([]);

  function addNode(type: string) {
    const newNode: Node = {
      id: crypto.randomUUID(),
      position: { x: 120, y: 80 },
      data: { label: type },
      type: "selectorNode",
    };
    
    // reassign a new array – don't push into the old one
    nodes = [...nodes, newNode];
  }

  function reset() {
    // restore to initial state by reassigning new arrays
    nodes = [];
    edges = [];
  }
</script>

<div class="flex w-full h-[85vh]">
  <FlowEditorPanel {addNode} {reset} />
  <div class="flex-1 h-full">
    <SvelteFlow bind:nodes bind:edges {nodeTypes} fitView>
      <Background />
    </SvelteFlow>
  </div>
</div>
