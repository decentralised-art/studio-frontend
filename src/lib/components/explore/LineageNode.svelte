<script lang="ts">
  import { Handle, Position, type Node, type NodeProps } from "@xyflow/svelte";

  type LineageNodeData = {
    label: string;
  };

  type LineageNode = Node<LineageNodeData, "lineage">;

  const { data, selected }: NodeProps<LineageNode> = $props();
</script>

<div class={`lineage-node ${selected ? "is-selected" : ""}`}>
  <Handle type="target" position={Position.Left} class="lineage-handle" />
  <Handle type="source" position={Position.Right} class="lineage-handle" />
  <span class="node-type">Connector</span>
  <span class="label">{data?.label}</span>
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .lineage-node {
    @apply flex cursor-pointer flex-col gap-1 rounded-lg border px-3 py-2 text-sm shadow-md transition-colors duration-200;
    background: var(--studio-node-bg);
    border-color: var(--studio-node-border);
    color: var(--text-primary);
  }

  .lineage-node:hover {
    border-color: color-mix(in srgb, var(--color-accent) 58%, transparent);
  }

  .lineage-node.is-selected {
    border-color: var(--color-accent);
    box-shadow: var(--shadow-glow);
  }

  :global(.lineage-handle) {
    @apply h-2 w-2 rounded-full border;
    background: var(--surface-panel-strong);
    border-color: var(--color-accent);
  }

  .node-type {
    @apply text-[0.6rem] uppercase tracking-[0.28em];
    color: var(--text-muted);
  }

  .label {
    @apply block max-w-[180px] truncate font-semibold;
    color: var(--text-primary);
  }
</style>
