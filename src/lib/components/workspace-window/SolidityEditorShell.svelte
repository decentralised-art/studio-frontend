<script lang="ts">
  import SolidityEditor from "$lib/components/solidity-editor/SolidityEditor.svelte";

  type Props = {
    readonly template?: string;
    value?: string;
  };

  let { template, value = $bindable("") }: Props = $props();

  /* =========================
   * Local UI state
   * ========================= */
</script>

<div class="shell">
  <div class="panel">
    <div class="canvas">
      <SolidityEditor readOnly={true} value={template} lintMode="light" />
      <div class="divider"></div>
      <SolidityEditor bind:value lintMode="light" />
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

  .divider {
    width: 1px;
    height: 6px;
    background: rgba(255, 255, 255, 0.12);
  }
</style>
