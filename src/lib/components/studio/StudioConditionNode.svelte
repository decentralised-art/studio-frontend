<script lang="ts">
  import { Handle, Position, type NodeProps } from "@xyflow/svelte";

  type ConditionNodeData = {
    label: string;
  };

  const { data, selected }: NodeProps<ConditionNodeData> = $props();
  const selectedClass = $derived(selected ? "is-selected" : "");
</script>

<div class="condition-node {selectedClass}">
  <div class="condition-title">{data.label}</div>
  <Handle type="source" position={Position.Bottom} id="out" />
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .condition-node {
    @apply min-w-[150px] rounded-md border border-amber-300/20 bg-black/80 px-3 py-2 text-amber-100/80 shadow-lg;
  }

  .condition-node.is-selected {
    @apply border-emerald-400/60 text-emerald-100;
    box-shadow:
      0 0 0 1px rgba(52, 211, 153, 0.3),
      0 12px 24px rgba(0, 0, 0, 0.4);
  }

  .condition-title {
    @apply text-[0.65rem] uppercase tracking-[0.2em];
  }
</style>
