<script lang="ts">
  import { Handle, Position, type Node, type NodeProps } from "@xyflow/svelte";

  type ConditionNodeData = {
    label: string;
    fromNetwork?: boolean;
  };

  type ConditionNode = Node<ConditionNodeData, "condition">;

  const { data, selected }: NodeProps<ConditionNode> = $props();
  const selectedClass = $derived(selected ? "is-selected" : "");
  const readOnly = $derived(Boolean(data.fromNetwork));
</script>

<div class="condition-node {selectedClass}">
  <div class="condition-title">{data.label}</div>
  {#if readOnly}
    <div class="condition-readonly">on-chain · read-only</div>
  {/if}
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

  .condition-readonly {
    @apply mt-1 inline-flex w-fit rounded border border-cyan-300/30 bg-cyan-400/10 px-2 py-0.5 text-[0.5rem] uppercase tracking-[0.2em] text-cyan-100/85;
  }
</style>
