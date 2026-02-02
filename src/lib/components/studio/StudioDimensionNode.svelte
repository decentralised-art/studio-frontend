<script lang="ts">
  import { Handle, Position, type NodeProps, useSvelteFlow } from "@xyflow/svelte";

  type DimensionNodeData = {
    label?: string;
    dimensionIndex?: number;
    transformations?: string[];
  };

  const { id, data, selected }: NodeProps<DimensionNodeData> = $props();
  const { updateNodeData } = useSvelteFlow();

  const title = $derived(
    typeof data.dimensionIndex === "number" ? `#${data.dimensionIndex + 1}` : "#",
  );
  const selectedClass = $derived(selected ? "is-selected" : "");
  const transformations = $derived(data.transformations ?? []);

  const updateTransformations = (targetId: string, updater: (current: string[]) => string[]) => {
    updateNodeData(targetId, (node) => {
      const current = node.data.transformations ?? [];
      return { transformations: updater([...current]) };
    });
  };

  const insertTransformation = (label: string, insertIndex?: number) => {
    updateTransformations(id, (current) => {
      const next = [...current];
      if (insertIndex === undefined || insertIndex < 0 || insertIndex > next.length) {
        next.push(label);
      } else {
        next.splice(insertIndex, 0, label);
      }
      return next;
    });
  };

  const moveTransformation = (fromIndex: number, toIndex: number) => {
    updateTransformations(id, (current) => {
      if (fromIndex < 0 || fromIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(fromIndex, 1);
      let target = Math.max(0, Math.min(toIndex, next.length));
      if (fromIndex < target) target -= 1;
      next.splice(target, 0, item);
      return next;
    });
  };

  const removeTransformation = (index: number) => {
    updateTransformations(id, (current) => {
      if (index < 0 || index >= current.length) return current;
      const next = [...current];
      next.splice(index, 1);
      return next;
    });
  };

  const parseTransformationPayload = (event: DragEvent) => {
    const transfer = event.dataTransfer;
    if (!transfer) return null;

    const dimensionPayload = transfer.getData("application/x-hypermusic-dimension-transform");
    if (dimensionPayload) {
      try {
        const payload = JSON.parse(dimensionPayload) as {
          sourceDimensionId: string;
          index: number;
          label: string;
        };
        return {
          label: payload.label,
          sourceDimensionId: payload.sourceDimensionId,
          index: payload.index,
        };
      } catch (error) {
        console.warn("Failed to parse dimension transformation payload", error);
      }
    }

    const libraryPayload = transfer.getData("application/x-hypermusic-library");
    if (libraryPayload) {
      try {
        const item = JSON.parse(libraryPayload) as { kind?: string; name?: string };
        if (item?.kind === "transformation" && item.name) {
          return { label: item.name };
        }
      } catch (error) {
        console.warn("Failed to parse library transformation payload", error);
      }
    }

    const quickPayload = transfer.getData("application/x-hypermusic-quick");
    if (quickPayload) {
      try {
        const payload = JSON.parse(quickPayload) as { kind?: string; label?: string };
        if (payload?.kind === "transformation" && payload.label) {
          return { label: payload.label };
        }
      } catch (error) {
        console.warn("Failed to parse quick transformation payload", error);
      }
    }

    return null;
  };

  const hasTransformationPayload = (event: DragEvent) => {
    const types = Array.from(event.dataTransfer?.types ?? []);
    return (
      types.includes("application/x-hypermusic-dimension-transform") ||
      types.includes("application/x-hypermusic-library") ||
      types.includes("application/x-hypermusic-quick")
    );
  };

  const handleDrop = (event: DragEvent, insertIndex?: number) => {
    event.preventDefault();
    event.stopPropagation();
    const payload = parseTransformationPayload(event);
    if (!payload) return;

    if (payload.sourceDimensionId && payload.sourceDimensionId === id) {
      if (payload.index !== undefined) {
        moveTransformation(payload.index, insertIndex ?? transformations.length);
      }
      return;
    }

    if (payload.sourceDimensionId && payload.index !== undefined) {
      updateTransformations(payload.sourceDimensionId, (current) => {
        if (payload.index < 0 || payload.index >= current.length) return current;
        const next = [...current];
        next.splice(payload.index, 1);
        return next;
      });
    }

    insertTransformation(payload.label, insertIndex);
  };

  const handleDragOver = (event: DragEvent) => {
    if (!hasTransformationPayload(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  };

  const handlePillDragStart = (event: DragEvent, index: number) => {
    const label = transformations[index];
    if (!label || !event.dataTransfer) return;
    event.dataTransfer.setData(
      "application/x-hypermusic-dimension-transform",
      JSON.stringify({ sourceDimensionId: id, index, label }),
    );
    event.dataTransfer.setData("text/plain", label);
    event.dataTransfer.effectAllowed = "move";
  };
</script>

<div class="dimension-node {selectedClass}">
  <div class="dimension-title">{title}</div>
  <div
    class="dimension-chain"
    role="list"
    aria-label="Dimension transformations"
    ondragover={handleDragOver}
    ondrop={(event) => handleDrop(event)}
  >
    {#if transformations.length === 0}
      <span class="dimension-slot">empty</span>
    {:else}
      {#each transformations as transformation, index (index)}
        <span
          class="dimension-pill"
          role="listitem"
          draggable="true"
          ondragstart={(event) => handlePillDragStart(event, index)}
          ondragover={handleDragOver}
          ondrop={(event) => {
            event.stopPropagation();
            handleDrop(event, index);
          }}
        >
          {transformation}
          <button
            type="button"
            class="pill-remove"
            aria-label={`Remove ${transformation}`}
            onclick={(event) => {
              event.stopPropagation();
              removeTransformation(index);
            }}
          >
            ×
          </button>
        </span>
        {#if index < transformations.length - 1}
          <span class="dimension-arrow">→</span>
        {/if}
      {/each}
    {/if}
  </div>
  <Handle type="target" position={Position.Top} id="in" />
  <Handle type="source" position={Position.Bottom} id="out" />
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .dimension-node {
    @apply min-w-[130px] rounded-md border border-white/10 bg-black/70 px-3 py-2 text-white/70 shadow-lg;
  }

  .dimension-node.is-selected {
    @apply border-emerald-400/60 text-emerald-100;
    box-shadow:
      0 0 0 1px rgba(52, 211, 153, 0.3),
      0 12px 24px rgba(0, 0, 0, 0.4);
  }

  .dimension-title {
    @apply text-[0.65rem] uppercase tracking-[0.2em];
  }

  .dimension-chain {
    @apply mt-2 flex flex-wrap items-center gap-1 text-[0.55rem] uppercase tracking-[0.18em];
  }

  .dimension-pill {
    @apply inline-flex items-center gap-1 rounded-md border border-white/10
      bg-white/5 px-2 py-[0.1rem] text-white/70;
  }

  .pill-remove {
    @apply ml-1 inline-flex h-3 w-3 items-center justify-center rounded-full
      border border-white/10 text-[0.45rem] text-white/50 hover:border-white/30 hover:text-white;
  }

  .dimension-arrow {
    @apply text-white/40;
  }

  .dimension-slot {
    @apply rounded-md border border-dashed border-white/15 px-2 py-[0.1rem] text-white/30;
  }
</style>
