<script lang="ts">
  import type { FlowNode, FlowEdge, TransformationDef } from "./FlowEditorTypes";

  let {
    nodes,
    edges,
    selectedNodeId,
  }: { nodes: FlowNode[]; edges: FlowEdge[]; selectedNodeId?: string } = $props();

  const resultJson = $derived(() => {
    if (selectedNodeId === undefined) return "";

    const selected: FlowNode | undefined = nodes.find((n: FlowNode) => n.id === selectedNodeId);
    if (selected === undefined) return "";

    let dimensions: {
      feature_name: string;
      transformations: { name: string; args: number[] }[];
    }[] = [];

    // find all dimensions
    for (const edge of edges as FlowEdge[]) {
      if (edge.type !== "dimension") continue;
      if (edge.source !== selected.id) continue;

      // find all transformations
      const transforms_defs: { name: string; args: number[] }[] = (
        edge.data ? edge.data.defs : []
      ).map((def: TransformationDef) => ({ name: def.name, args: def.args }));

      // find target node
      const node: FlowNode | undefined = nodes.find((n: FlowNode) => n.id === edge.target);
      if (node === undefined) continue;

      dimensions.push({
        feature_name: node.data.name as string,
        transformations: transforms_defs,
      });
    }

    return JSON.stringify(
      { feature_name: selected.data.name, dimensions: dimensions },
      undefined,
      2,
    );
  });
</script>

<aside class="border border-white/10 bg-black/80 p-3 flex flex-col text-xs text-white h-full">
  <header class="flex items-center justify-between mb-2">
    <div class="space-y-0.5">
      <h2 class="text-sm font-semibold">Flow Result</h2>
      {#if selectedNodeId === undefined}
        <p class="text-[11px] text-red-400">No feature selected.</p>
      {/if}
    </div>

    {#if selectedNodeId !== undefined}
      <button
        class="px-2 py-1 rounded border border-white/20 text-[11px] hover:bg-white/10"
        onclick={() => navigator.clipboard?.writeText(resultJson())}
      >
        Copy JSON
      </button>
    {/if}
  </header>

  <div class="relative flex-1 overflow-auto rounded-lg bg-black/60 p-2">
    {#if selectedNodeId !== undefined}
      <pre class="font-mono text-[11px] leading-relaxed whitespace-pre">
{resultJson()}
      </pre>
    {/if}
  </div>
</aside>
