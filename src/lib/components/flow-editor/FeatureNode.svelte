<script lang="ts">
  import { Handle, Position, useSvelteFlow } from "@xyflow/svelte";

  import type { FeatureNodePropsType } from "./flowEditorTypes";

  import Input from "$lib/components/ui/Input.svelte";

  let { id, data, isConnectable, selected }: FeatureNodePropsType = $props();

  const { updateNodeData } = useSvelteFlow();

  // create style for selected node
  let selectedStyle = $derived(() =>
    selected ? "border-green-400" : "border-white/20"
  );

  //
  let existsOnServerStyle = $derived(() =>
    data.exists_on_server ? "bg-gray-800" : "bg-black"
  );

  async function checkFeatureExists(featureName: string) {
    // empty name – skip
    if (!featureName.trim()) {
      updateNodeData(id, { exists_on_server: null });
      return;
    }

    try {
      const res = await fetch(
        `https://api.decentralised.art/feature/${encodeURIComponent(featureName)}`,
        { method: "HEAD", cache: "no-store" }
      );

      // assume: 200 = exists, 404 = not found
      updateNodeData(id, { exists_on_server: res.ok });
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
  <Handle
    type="target"
    position={Position.Top}
    {isConnectable}
    class="translate-y-[-50%]"
  />

  <!-- Node content -->
  <div class="text-white/90 font-medium">Feature</div>

  <!-- Editable name -->
  <Input
    label="Name"
    placeholder="Feature name"
    className="w-full"
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

  {#if data.exists_on_server === false}
    <!-- Bottom handle (source) -->
    <Handle
      type="source"
      position={Position.Bottom}
      {isConnectable}
      class="translate-y-[50%]"
    />
  {:else}
    <div class="text-white/50 text-sm">exists on server</div>
  {/if}
</div>
