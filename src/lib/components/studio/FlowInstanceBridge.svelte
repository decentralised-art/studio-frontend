<script lang="ts">
  import { onMount } from "svelte";

  import { useSvelteFlow } from "@xyflow/svelte";

  let {
    onReady,
  }: {
    onReady?: (payload: {
      screenToFlowPosition: (client: { x: number; y: number }) => { x: number; y: number };
      getZoom: () => number;
      fitView: (options?: { padding?: number; duration?: number }) => void;
    }) => void;
  } = $props();

  const { screenToFlowPosition, getZoom, fitView } = useSvelteFlow();

  onMount(() => {
    onReady?.({ screenToFlowPosition, getZoom, fitView });
  });
</script>
