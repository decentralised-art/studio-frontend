<script lang="ts">
  let {
    message,
    onCancel,
    cancellable = true,
  }: { message: string; onCancel: () => void; cancellable?: boolean } = $props();
</script>

<div class="graph-loading" role="status" aria-live="polite">
  <div class="loading-card">
    <p>{message}</p>
    <div class="graph-scaffold" aria-hidden="true">
      <i></i><span></span><i></i><span></span><i></i>
    </div>
    {#if cancellable}<button type="button" onclick={onCancel}>Cancel</button>{/if}
  </div>
</div>

<style>
  .graph-loading {
    position: absolute;
    inset: 0;
    z-index: 15;
    display: grid;
    place-items: center;
    background: var(--studio-flow-bg, #101116);
  }
  .loading-card {
    width: min(330px, calc(100% - 40px));
    color: var(--color-text, #ccc);
    font-size: 12px;
  }
  p {
    margin: 0 0 22px;
  }
  .graph-scaffold {
    display: flex;
    align-items: center;
    margin-bottom: 24px;
    opacity: 0.45;
    animation: loading 1.8s ease-in-out infinite;
    will-change: opacity;
  }
  i {
    width: 62px;
    height: 40px;
    border: 1px solid currentColor;
    border-radius: 3px;
  }
  span {
    flex: 1;
    height: 1px;
    background: currentColor;
  }
  button {
    border: 1px solid currentColor;
    border-radius: 3px;
    background: transparent;
    color: inherit;
    padding: 5px 10px;
    font: inherit;
    cursor: pointer;
  }
  @keyframes loading {
    50% {
      opacity: 0.15;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .graph-scaffold {
      animation: none;
    }
  }
</style>
