<script lang="ts">
  export let addNode: (type: string) => void;
  export let reset: () => void;
</script>

<aside
  class="w-64 border-r border-white/10 bg-black backdrop-blur-xl p-4 text-white/80
         flex flex-col gap-6"
>

  <!-- Node creation section -->
  <section class="space-y-2">
    <p class="text-xs text-white/40 uppercase tracking-wide">Create Node</p>

    <button
      class="btn"
      on:click={() => addNode("feature")}
    >
      + Feature Node
    </button>

    <button
      class="btn"
      on:click={() => addNode("transformation")}
    >
      + Transformation Node
    </button>
  </section>

  <!-- Canvas controls -->
  <section class="space-y-2">
    <p class="text-xs text-white/40 uppercase tracking-wide">Canvas</p>

    <button
      class="btn"
      on:click={reset}
    >
      Reset Canvas
    </button>
  </section>
</aside>