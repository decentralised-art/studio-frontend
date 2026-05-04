<script lang="ts">
  import { onMount } from "svelte";

  import { useStore, useSvelteFlow } from "@xyflow/svelte";

  let {
    onReady,
  }: {
    onReady?: (payload: {
      screenToFlowPosition: (client: { x: number; y: number }) => { x: number; y: number };
      getZoom: () => number;
      setCenter: (
        x: number,
        y: number,
        options?: { zoom?: number; duration?: number },
      ) => Promise<boolean>;
      fitView: (options?: {
        padding?: number;
        duration?: number;
        minZoom?: number;
        maxZoom?: number;
        nodes?: { id: string }[];
      }) => Promise<boolean>;
      clearSelection: () => void;
    }) => void;
  } = $props();

  const { screenToFlowPosition, getZoom, setCenter, fitView } = useSvelteFlow();
  const store = useStore();

  const clearSelection = () => {
    store.unselectNodesAndEdges();
    store.selectionRectMode = null;
    store.selectionRect = null;
  };

  onMount(() => {
    onReady?.({ screenToFlowPosition, getZoom, setCenter, fitView, clearSelection });
  });
</script>
