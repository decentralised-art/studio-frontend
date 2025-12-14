<script lang="ts">
  export let addNode: (kind: "feature") => void;
  export let reset: () => void;
</script>

<aside class="panel">
  <!-- Node creation section -->
  <section class="space-y-2">
    <p class="text-xs text-white/40 uppercase tracking-wide">Create Node</p>

    <button class="btn" on:click={() => addNode("feature")}> + Feature Node </button>
  </section>

  <!-- Canvas controls -->
  <section class="space-y-2">
    <p class="text-xs text-white/40 uppercase tracking-wide">Canvas</p>

    <button class="btn" on:click={reset}> Reset Canvas </button>
  </section>
</aside>

<!-- w-64 border-r border-white/10 bg-black p-4 text-white/80
         flex flex-col gap-6 -->
<style>
  .panel {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    height: 100%;

    gap: 12px;

    padding: 12px;

    border-right: 1px solid rgba(255, 255, 255, 0.12);

    background: rgba(20, 20, 24, 0.85);
  }
</style>
