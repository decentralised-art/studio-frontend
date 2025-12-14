<script lang="ts">
  import FlowEditor from "$lib/components/flow-editor/FlowEditor.svelte";
</script>

<div class="shell">
  <div class="panel">
    <div class="canvas">
      <FlowEditor />
    </div>
  </div>
</div>

<style>
  .shell {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 12px;
  }

  .panel {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    gap: 12px;
  }

  .canvas {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
</style>
