<script lang="ts">
  import { Handle, Position, type Node, type NodeProps } from "@xyflow/svelte";

  type TransformationNodeData = {
    label: string;
  };

  type TransformationNode = Node<TransformationNodeData, "transformation">;

  const { data, selected }: NodeProps<TransformationNode> = $props();
  const selectedClass = $derived(selected ? "is-selected" : "");
</script>

<div class="transformation-node {selectedClass}">
  <div class="transformation-title">{data.label}</div>
  <Handle type="target" position={Position.Top} id="in" />
  <Handle type="source" position={Position.Bottom} id="out" />
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .transformation-node {
    @apply min-w-[140px] rounded-md border border-white/10 bg-black/80 px-3 py-2 text-white/75 shadow-lg;
  }

  .transformation-node.is-selected {
    @apply border-emerald-400/60 text-emerald-100;
    box-shadow:
      0 0 0 1px rgba(52, 211, 153, 0.3),
      0 12px 24px rgba(0, 0, 0, 0.4);
  }

  .transformation-title {
    @apply text-[0.65rem] uppercase tracking-[0.2em];
  }
</style>
