<script lang="ts">
  import { Handle, Position, type NodeProps } from "@xyflow/svelte";

  type LineageNodeData = {
    label: string;
  };

  const { data, selected }: NodeProps<LineageNodeData> = $props();
</script>

<div class={`lineage-node ${selected ? "is-selected" : ""}`}>
  <Handle type="target" position={Position.Left} class="lineage-handle" />
  <Handle type="source" position={Position.Right} class="lineage-handle" />
  <span class="node-type">Particle</span>
  <span class="label">{data?.label}</span>
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .lineage-node {
    @apply flex flex-col gap-1 rounded-lg border border-white/20 bg-gray-800
      px-3 py-2 text-sm text-white shadow-md
      transition-colors duration-200 cursor-pointer hover:border-emerald-300/60;
  }

  .lineage-node.is-selected {
    @apply border-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.25)];
  }

  :global(.lineage-handle) {
    @apply h-2 w-2 rounded-full border border-white/40 bg-white/70;
  }

  .node-type {
    @apply text-[0.6rem] uppercase tracking-[0.28em] text-white/50;
  }

  .label {
    @apply block max-w-[180px] truncate font-semibold text-white/90;
  }
</style>
