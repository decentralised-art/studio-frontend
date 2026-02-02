<script lang="ts">
  import { Handle, Position, type NodeProps } from "@xyflow/svelte";

  type ParticleNodeData = {
    label: string;
  };

  const { data, selected }: NodeProps<ParticleNodeData> = $props();
  const selectedClass = $derived(selected ? "is-selected" : "");
</script>

<div class="particle-node {selectedClass}">
  <div class="particle-title">{data.label}</div>
  <Handle type="target" position={Position.Top} id="in" />
  <Handle type="source" position={Position.Bottom} id="out" />
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .particle-node {
    @apply min-w-[150px] rounded-md border border-white/15 bg-black/80 px-3 py-2 text-white/80 shadow-lg;
  }

  .particle-node.is-selected {
    @apply border-emerald-400/60 text-emerald-100;
    box-shadow:
      0 0 0 1px rgba(52, 211, 153, 0.3),
      0 12px 24px rgba(0, 0, 0, 0.4);
  }

  .particle-title {
    @apply text-[0.7rem] font-semibold uppercase tracking-[0.2em];
  }
</style>
