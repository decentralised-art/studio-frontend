<script lang="ts">
  import { Handle, Position } from "@xyflow/svelte";
  import type { NodeProps } from "@xyflow/svelte";

  import type { FeatureNodeType } from "./flowEditorTypes";

  let { data, isConnectable }: NodeProps<FeatureNodeType> = $props();
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

  <!-- Node label -->
  <div class="text-white/50 text-center">
    {data.label}
  </div>

  <!-- Bottom handle (source) -->
  <Handle
    type="source"
    position={Position.Bottom}
    {isConnectable}
    class="translate-y-[50%]"
  />
</div>
