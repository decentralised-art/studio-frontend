<script lang="ts">
  import type {
    FlowNode,
    FlowEdge,
    TransformationDef,
  } from "./flowEditorTypes";

  // Svelte 5 runes props
  let { nodes, edges } = $props<{
    nodes: FlowNode[];
    edges: FlowEdge[];
  }>();

  // Find ROOT feature:
  // first feature with no incoming edges
  const rootFeature = $derived(() => {
    const features: FlowNode[] = nodes.filter(
      (n: FlowNode) => n.type === "feature"
    );

    if (features.length === 0) return null;

    // build incoming edge count
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const incoming = new Map<string, number>();
    for (const e of edges) {
      if (!e.target) continue;
      incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
    }

    const rootByEdges =
      features.find((f: FlowNode) => !incoming.get(f.id)) ?? null;
    return rootByEdges;
  });

  const resultJson = $derived(() => {
    const feature = rootFeature();
    if (feature === null) return "";

    let dimensions: {
      feature_name: string;
      transformations: { name: string; args: number[] }[];
    }[] = [];
    // find all dimensions

    for (const edge of edges as FlowEdge[]) {
      if (edge.type !== "dimension") continue;
      if (edge.source !== feature.id) continue;

      // find all transformations
      const transforms_defs: { name: string; args: number[] }[] = (
        edge.data ? edge.data.defs : []
      ).map((def: TransformationDef) => ({ name: def.name, args: def.args }));

      // find target node
      const node: FlowNode = nodes.find((n: FlowNode) => n.id === edge.target);
      if (node === undefined) continue;

      dimensions.push({
        feature_name: node.data.name as string,
        transformations: transforms_defs,
      });
    }

    return JSON.stringify({ ...feature.data, dimensions: dimensions }, null, 2);
  });
</script>

<aside
  class="border border-white/10 bg-black/80 p-3 flex flex-col text-xs text-white h-full"
>
  <header class="flex items-center justify-between mb-2">
    <div class="space-y-0.5">
      <h2 class="text-sm font-semibold">Flow Result</h2>
      {#if rootFeature() === null}
        <p class="text-[11px] text-red-400">
          No root feature found (no feature nodes).
        </p>
      {/if}
    </div>

    {#if rootFeature() !== null}
      <button
        class="px-2 py-1 rounded border border-white/20 text-[11px] hover:bg-white/10"
        onclick={() => navigator.clipboard?.writeText(resultJson())}
      >
        Copy JSON
      </button>
    {/if}
  </header>

  <div class="relative flex-1 overflow-auto rounded-lg bg-black/60 p-2">
    {#if rootFeature() !== null}
      <pre class="font-mono text-[11px] leading-relaxed whitespace-pre">
{resultJson()}
      </pre>
    {:else}
      <p class="text-white/60 text-[11px]">
        Add at least one <code>feature</code> node to see results.
      </p>
    {/if}
  </div>
</aside>
