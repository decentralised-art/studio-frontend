<script lang="ts">
  const {
    isVisible = true,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    handleClass = "",
    lineClass = "",
  } = $props<{
    isVisible?: boolean;
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    handleClass?: string;
    lineClass?: string;
  }>();

  const edgePositions = ["top", "right", "bottom", "left"] as const;
  const cornerPositions = ["top left", "top right", "bottom right", "bottom left"] as const;
  const testIdFor = (position: string) => position.replaceAll(" ", "-");
</script>

{#if isVisible}
  <div
    data-testid="mock-node-resizer"
    data-min-width={String(minWidth ?? "")}
    data-min-height={String(minHeight ?? "")}
    data-max-width={String(maxWidth ?? "")}
    data-max-height={String(maxHeight ?? "")}
  >
    {#each edgePositions as position (position)}
      <div
        data-testid={`resize-line-${position}`}
        class={`svelte-flow__resize-control line ${position} ${lineClass}`}
      ></div>
    {/each}

    {#each cornerPositions as position (position)}
      <div
        data-testid={`resize-handle-${testIdFor(position)}`}
        class={`svelte-flow__resize-control handle ${position} ${handleClass}`}
      ></div>
    {/each}
  </div>
{/if}
