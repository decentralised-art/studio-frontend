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
      getNodeMeasurements: (ids: string[]) => { measured: number; signature: string };
    }) => void;
  } = $props();

  const { screenToFlowPosition, getZoom, setCenter, fitView } = useSvelteFlow();
  const store = useStore();

  const clearSelection = () => {
    store.unselectNodesAndEdges();
    store.selectionRectMode = null;
    store.selectionRect = null;
  };

  const getNodeMeasurements = (ids: string[]) => {
    let measured = 0;
    const sizes = ids.map((id) => {
      const size = store.nodeLookup.get(id)?.measured;
      if (size?.width && size?.height) measured++;
      return `${id}:${size?.width ?? 0}:${size?.height ?? 0}`;
    });
    return { measured, signature: sizes.join("|") };
  };

  onMount(() => {
    onReady?.({
      screenToFlowPosition,
      getZoom,
      setCenter,
      fitView,
      clearSelection,
      getNodeMeasurements,
    });
  });
</script>
