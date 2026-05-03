<script lang="ts">
  import { onMount } from "svelte";

  import { useStore, useSvelteFlow } from "@xyflow/svelte";

  let {
    onReady,
  }: {
    onReady?: (payload: {
      screenToFlowPosition: (client: { x: number; y: number }) => { x: number; y: number };
      getZoom: () => number;
      fitView: (options?: { padding?: number; duration?: number }) => void;
      clearSelection: () => void;
    }) => void;
  } = $props();

  const { screenToFlowPosition, getZoom, fitView } = useSvelteFlow();
  const store = useStore();

  const clearSelection = () => {
    store.unselectNodesAndEdges();
    store.selectionRectMode = null;
    store.selectionRect = null;
  };

  onMount(() => {
    onReady?.({ screenToFlowPosition, getZoom, fitView, clearSelection });
  });
</script>
