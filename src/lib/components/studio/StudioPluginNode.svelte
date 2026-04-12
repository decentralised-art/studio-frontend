<script lang="ts">
  import { Handle, Position, type Node, type NodeProps } from "@xyflow/svelte";
  import type { PtOutputFeature } from "$lib/particles/ptMidiAdapter";

  type PluginNodeData = {
    label: string;
    pluginOutput?: PtOutputFeature[];
    pluginTargets?: string[];
  };

  type PluginNode = Node<PluginNodeData, "plugin">;

  const { data, selected }: NodeProps<PluginNode> = $props();
  const selectedClass = $derived(selected ? "is-selected" : "");
  const streams = $derived(data.pluginOutput ?? []);
  const columnCount = $derived(
    streams.reduce((max, stream) => Math.max(max, stream.data.length), 0),
  );
  const columns = $derived(Array.from({ length: columnCount }, (_, index) => index));
</script>

<div class="plugin-node {selectedClass}">
  <div class="plugin-title">{data.label}</div>
  {#if data.pluginTargets?.length}
    <div class="plugin-target">from {data.pluginTargets.join(" + ")}</div>
  {/if}
  {#if streams.length === 0}
    <div class="plugin-empty">No output yet. Run the flow.</div>
  {:else}
    <div
      class="plugin-table-wrap"
      role="region"
      aria-label="Plugin output table"
      onwheel={(event) => event.stopPropagation()}
      ontouchmove={(event) => event.stopPropagation()}
    >
      <table class="plugin-table">
        <thead>
          <tr>
            <th>Stream</th>
            {#each columns as column (column)}
              <th>{column + 1}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each streams as stream, index (index)}
            <tr>
              <td class="stream-path">{stream.feature_path}</td>
              {#each columns as column (column)}
                <td>{stream.data[column] ?? ""}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
  <Handle type="target" position={Position.Top} id="in" />
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .plugin-node {
    @apply min-w-[220px] rounded-md border border-white/10 bg-black/80 px-3 py-2 text-white/75 shadow-lg;
  }

  .plugin-node.is-selected {
    @apply border-emerald-400/60 text-emerald-100;
    box-shadow:
      0 0 0 1px rgba(52, 211, 153, 0.3),
      0 12px 24px rgba(0, 0, 0, 0.4);
  }

  .plugin-title {
    @apply text-[0.65rem] font-semibold uppercase tracking-[0.2em];
  }

  .plugin-target {
    @apply mt-1 text-[0.55rem] uppercase tracking-[0.2em] text-white/50;
  }

  .plugin-empty {
    @apply mt-3 text-[0.55rem] uppercase tracking-[0.2em] text-white/40;
  }

  .plugin-table-wrap {
    @apply mt-3 max-h-44 overflow-auto rounded-md border border-white/10 bg-black/50;
    overscroll-behavior: contain;
  }

  .plugin-table {
    @apply w-full text-[0.55rem] text-white/70;
    border-collapse: collapse;
  }

  .plugin-table th,
  .plugin-table td {
    @apply border-b border-white/5 px-2 py-1 text-left;
  }

  .plugin-table th {
    @apply sticky top-0 bg-black/80 text-white/60;
  }

  .plugin-table .stream-path {
    @apply max-w-[160px] truncate text-white/70;
  }

  .plugin-table tbody tr:last-child td {
    border-bottom: none;
  }
</style>
