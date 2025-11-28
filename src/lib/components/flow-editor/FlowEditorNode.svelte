<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';

  let { data, isConnectable }: NodeProps = $props();
</script>

<div
  class="relative rounded-lg border border-white/20 bg-black/30 backdrop-blur-sm 
         px-3 py-2 text-white text-sm shadow-md"
>
  <!-- Top handle -->
  <Handle
    type="target"
    position={Position.Top}
    {isConnectable}
    class="translate-y-[-50%]"
  />

  <!-- Node content -->
  <div class="text-white/90 font-medium">
    Custom Node
  </div>

  <!-- Node label -->
  <div class="text-white/50 font-small text-center">
    {data.label}
  </div>
  
  <!-- Bottom handle -->
  <Handle
    type="source"
    position={Position.Bottom}
    {isConnectable}
    class="translate-y-[50%]"
  />
</div>
