<script lang="ts">
  import { getContext } from "svelte";

  import { Handle, Position, useSvelteFlow } from "@xyflow/svelte";

  import type { FeatureNodePropsType } from "./flowEditorTypes";

  import Input from "$lib/components/ui/Input.svelte";
  import { buildChainApiUrl } from "$lib/url/url";

  let { id, data, isConnectable, selected }: FeatureNodePropsType = $props();

  const { updateNodeData } = useSvelteFlow();

  const { loadFeatureGraphFromServer } = getContext<{
    loadFeatureGraphFromServer: (rootNodeId: string, featureName: string) => Promise<void>;
  }>("flow-graph-loader");

  // create style for selected node
  let selectedStyle = $derived(() => (selected ? "border-green-400" : "border-white/20"));

  //
  let existsOnServerStyle = $derived(() => (data.exists_on_server ? "bg-gray-800" : "bg-black"));

  async function checkFeatureExists(featureName: string) {
    const trimmed = featureName.trim();

    if (!trimmed) {
      updateNodeData(id, { exists_on_server: null });
      return;
    }

    try {
      const res = await fetch(buildChainApiUrl(`/feature/${encodeURIComponent(trimmed)}`), {
        method: "HEAD",
        cache: "no-store",
      });

      if (!res.ok) {
        // 404 etc → mark as not existing, no throw
        updateNodeData(id, { exists_on_server: false });
        return;
      }

      // exists
      updateNodeData(id, { exists_on_server: true });

      // load full graph from parent
      await loadFeatureGraphFromServer(id, trimmed);
    } catch (err) {
      console.error("Error checking feature:", err);
      updateNodeData(id, { exists_on_server: false });
    }
  }
</script>

<div
  class="relative rounded-lg border
         px-3 py-2 text-white text-sm shadow-md {selectedStyle()} {existsOnServerStyle()}"
>
  <!-- Top handle (target) -->
  <Handle type="target" position={Position.Top} {isConnectable} class="translate-y-[-50%]" />

  <!-- Node content -->
  <div class="text-white/90 font-medium">Feature</div>

  <!-- Editable name -->
  <Input
    label="Name"
    placeholder="Feature name"
    value={data.name}
    oninput={(event) => {
      const target = event.target as HTMLInputElement | null;
      const newName = target?.value ?? "";
      // this updates node.data for this node only
      updateNodeData(id, { name: newName });
    }}
    onblur={(event) => {
      const target = event.target as HTMLInputElement | null;
      const currentName = target?.value ?? "";
      // after editing is complete -> check API
      checkFeatureExists(currentName);
    }}
  />

  <!-- Bottom handle (source) -->
  <Handle type="source" position={Position.Bottom} {isConnectable} class="translate-y-[50%]" />
  {#if data.exists_on_server === true}
    <div class="text-white/50 text-sm">exists on server</div>
  {/if}
</div>
