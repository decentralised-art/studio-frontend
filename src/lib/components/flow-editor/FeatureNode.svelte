<script lang="ts">
  import { Handle, Position, useSvelteFlow } from "@xyflow/svelte";

  import type { FeatureNodePropsType } from "./flowEditorTypes";

  import Input from "$lib/components/ui/Input.svelte";

  let { id, data, isConnectable, selected }: FeatureNodePropsType = $props();

  const { updateNodeData } = useSvelteFlow();

  // create style for selected node
  let selectedStyle = $derived(() => selected ? "border-green-400" : "border-white/20" );
</script>

<div
  class="relative rounded-lg border bg-black
         px-3 py-2 text-white text-sm shadow-md {selectedStyle()}"
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
  />

  <!-- Bottom handle (source) -->
  <Handle
    type="source"
    position={Position.Bottom}
    {isConnectable}
    class="translate-y-[50%]"
  />
</div>
