<script lang="ts">
  import { Handle, Position } from "@xyflow/svelte";
  import type { NodeProps } from "@xyflow/svelte";

  import type { TransformationNodeType } from "./FlowEditorTypes";

  let { data, isConnectable }: NodeProps<TransformationNodeType> = $props();
</script>

<div
  class="relative rounded-lg border border-emerald-400/40 bg-black
         px-3 py-2 text-white text-sm shadow-md"
>
  <!-- Only target handle -->
  <Handle
    type="target"
    position={Position.Top}
    {isConnectable}
    class="translate-y-[-50%]"
  />

  <div class="text-emerald-300 font-medium">Transformation</div>

  <div class="text-white/50 text-center">
    {data.label}
  </div>
</div>
