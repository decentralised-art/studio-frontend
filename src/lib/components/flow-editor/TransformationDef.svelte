<script lang="ts">
    import type { TransformationDef } from "./flowEditorTypes";
    let { def }: { def: TransformationDef } = $props();
</script>

<div class="flex items-center justify-between gap-2 text-xs">
  <span>{def.name}</span>
  <span>{def.args}</span>
</div>
