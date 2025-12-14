<script lang="ts">
  import WorkspaceWindow from "$lib/components/workspace-window/WorkspaceWindow.svelte";
</script>

<div class="page">
  <WorkspaceWindow />
</div>

<style>
  .page {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
</style>
