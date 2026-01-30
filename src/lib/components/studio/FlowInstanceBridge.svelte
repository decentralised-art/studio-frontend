<script lang="ts">
  import { onMount } from "svelte";

  import { useSvelteFlow } from "@xyflow/svelte";

  let {
    onReady,
  }: {
    onReady?: (fn: (client: { x: number; y: number }) => { x: number; y: number }) => void;
  } = $props();

  const { screenToFlowPosition } = useSvelteFlow();

  onMount(() => {
    onReady?.(screenToFlowPosition);
  });
</script>
