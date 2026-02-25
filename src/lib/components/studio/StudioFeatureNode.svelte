<script lang="ts">
  import { Handle, Position, type NodeProps, useUpdateNodeInternals } from "@xyflow/svelte";

  type FeatureNodeData = {
    label: string;
    dimensions?: number;
  };

  const { id, data, selected }: NodeProps<FeatureNodeData> = $props();
  const updateNodeInternals = useUpdateNodeInternals();

  const dimensionCount = $derived(Math.max(1, Math.round(data.dimensions ?? 1)));
  const selectedClass = $derived(selected ? "is-selected" : "");

  const handleLeft = (index: number) => ((index + 1) / (dimensionCount + 1)) * 100;

  $effect(() => {
    if (dimensionCount >= 0) {
      updateNodeInternals(id);
    }
  });
</script>

<div class="feature-node {selectedClass}">
  <Handle type="target" position={Position.Top} id="condition" />
  <div class="feature-title">{data.label}</div>
  <div class="feature-meta">{dimensionCount} dimensions</div>
  {#each Array(dimensionCount) as _, index (index)}
    <Handle
      type="source"
      position={Position.Bottom}
      id={`dim-${index}`}
      style={`left: ${handleLeft(index)}%;`}
    />
  {/each}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .feature-node {
    @apply min-w-[150px] rounded-md border border-white/15 bg-black/80 px-3 py-2 text-white/80 shadow-lg;
  }

  .feature-node.is-selected {
    @apply border-emerald-400/60 text-emerald-100;
    box-shadow:
      0 0 0 1px rgba(52, 211, 153, 0.3),
      0 12px 24px rgba(0, 0, 0, 0.4);
  }

  .feature-title {
    @apply text-[0.7rem] font-semibold uppercase tracking-[0.2em];
  }

  .feature-meta {
    @apply mt-1 text-[0.6rem] uppercase tracking-[0.2em] text-white/50;
  }
</style>
