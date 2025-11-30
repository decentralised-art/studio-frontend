<script lang="ts">
  import { Handle, Position, useSvelteFlow, type NodeProps } from "@xyflow/svelte";

  import type { FeatureNodeType, FeatureData } from "./flowEditorTypes";

  import Input from "$lib/components/ui/Input.svelte";

  let { id, data, isConnectable }: NodeProps<FeatureNodeType> = $props();

  const { updateNodeData } = useSvelteFlow();

  // small helper to read current name safely
  const name = () => (data as FeatureData)?.name ?? "";

</script>

<div
  class="relative rounded-lg border border-white/20 bg-black
         px-3 py-2 text-white text-sm shadow-md"
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
    value={name()}
    oninput={(event) => {
      const target = event.target as HTMLInputElement | null;
      const next = target?.value ?? "";

      // this updates node.data for this node only
      updateNodeData(id, { name: next });
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
