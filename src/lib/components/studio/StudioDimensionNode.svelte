<script lang="ts">
  import { Handle, Position, type Node, type NodeProps, useSvelteFlow } from "@xyflow/svelte";

  type DimensionNodeData = {
    label?: string;
    dimensionIndex?: number;
    transformations?: TransformationInstance[];
    riStart?: number;
    riShift?: number;
    riLocked?: boolean;
    fromNetwork?: boolean;
  };

  type TransformationInstance = {
    id: string;
    name: string;
    args: number[];
    status: "draft" | "network";
  };

  type DimensionNode = Node<DimensionNodeData, "dimension">;

  const { id, data, selected }: NodeProps<DimensionNode> = $props();
  const { updateNodeData } = useSvelteFlow<DimensionNode>();

  const title = $derived(
    typeof data.dimensionIndex === "number" ? `#${data.dimensionIndex + 1}` : "#",
  );
  const selectedClass = $derived(selected ? "is-selected" : "");
  const transformations = $derived(data.transformations ?? []);
  const riLocked = $derived(data.riLocked ?? false);
  const riStart = $derived(data.riStart ?? 0);
  const riShift = $derived(data.riShift ?? 0);
  const readOnly = $derived(data.fromNetwork ?? false);

  const updateTransformations = (
    targetId: string,
    updater: (current: TransformationInstance[]) => TransformationInstance[],
  ) => {
    if (readOnly) return;
    updateNodeData(targetId, (node) => {
      const current = node.data.transformations ?? [];
      return { transformations: updater([...current]) };
    });
  };

  const createInstance = (
    name: string,
    args: number[],
    status: TransformationInstance["status"],
  ) => ({
    id: `tx-${crypto.randomUUID()}`,
    name,
    args,
    status,
  });

  const insertTransformation = (transformation: TransformationInstance, insertIndex?: number) => {
    updateTransformations(id, (current) => {
      const next = [...current];
      if (insertIndex === undefined || insertIndex < 0 || insertIndex > next.length) {
        next.push(transformation);
      } else {
        next.splice(insertIndex, 0, transformation);
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

  const updateRunningInstance = (
    patch: Partial<Pick<DimensionNodeData, "riStart" | "riShift" | "riLocked">>,
  ) => {
    if (readOnly && riLocked) return;
    updateNodeData(id, () => ({ ...patch }));
  };

  const parseNumberInput = (value: string) => {
    const next = Number(value);
    if (!Number.isFinite(next)) return 0;
    return Math.max(0, Math.trunc(next));
  };

  const parseArgsInput = (value: string) =>
    value
      .split(",")
      .map((segment) => Number(segment.trim()))
      .filter((num) => Number.isFinite(num))
      .map((num) => Math.trunc(num));

  const updateTransformationArgs = (index: number, rawArgs: string) => {
    updateTransformations(id, (current) => {
      if (index < 0 || index >= current.length) return current;
      const next = [...current];
      next[index] = {
        ...next[index],
        args: parseArgsInput(rawArgs),
      };
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
          transformation: TransformationInstance;
        };
        return {
          transformation: payload.transformation,
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
          return {
            transformation: createInstance(item.name, [], "network"),
          };
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
          return {
            transformation: createInstance(payload.label, [], "draft"),
          };
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
    if (readOnly) return;
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

    insertTransformation(payload.transformation, insertIndex);
  };

  const handleDragOver = (event: DragEvent) => {
    if (readOnly) return;
    if (!hasTransformationPayload(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  };

  const handlePillDragStart = (event: DragEvent, index: number) => {
    if (readOnly) return;
    const transformation = transformations[index];
    if (!transformation || !event.dataTransfer) return;
    event.dataTransfer.setData(
      "application/x-hypermusic-dimension-transform",
      JSON.stringify({ sourceDimensionId: id, index, transformation }),
    );
    event.dataTransfer.setData("text/plain", transformation.name);
    event.dataTransfer.effectAllowed = "move";
  };
</script>

<div class="dimension-node {selectedClass}">
  <div class="dimension-title">{title}</div>
  <div class="dimension-ri">
    <span class="dimension-ri-label">RI</span>
    <input
      class="dimension-ri-input"
      type="number"
      inputmode="numeric"
      min="0"
      step="1"
      placeholder="start"
      value={riStart}
      disabled={readOnly && riLocked}
      onwheel={(event) => {
        event.preventDefault();
        (event.currentTarget as HTMLInputElement).blur();
      }}
      onkeydown={(event) => {
        if (["-", "+", "e", "E", "."].includes(event.key)) {
          event.preventDefault();
        }
      }}
      oninput={(event) => {
        const target = event.target as HTMLInputElement | null;
        updateRunningInstance({ riStart: parseNumberInput(target?.value ?? "0") });
      }}
    />
    <input
      class="dimension-ri-input"
      type="number"
      inputmode="numeric"
      min="0"
      step="1"
      placeholder="shift"
      value={riShift}
      disabled={readOnly && riLocked}
      onwheel={(event) => {
        event.preventDefault();
        (event.currentTarget as HTMLInputElement).blur();
      }}
      onkeydown={(event) => {
        if (["-", "+", "e", "E", "."].includes(event.key)) {
          event.preventDefault();
        }
      }}
      oninput={(event) => {
        const target = event.target as HTMLInputElement | null;
        updateRunningInstance({ riShift: parseNumberInput(target?.value ?? "0") });
      }}
    />
    <button
      type="button"
      class={`dimension-ri-toggle ${riLocked ? "is-locked" : ""}`}
      disabled={readOnly}
      onclick={() => updateRunningInstance({ riLocked: !riLocked })}
    >
      {riLocked ? "fixed" : "open"}
    </button>
  </div>
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
      {#each transformations as transformation, index (transformation.id)}
        <span
          class={`dimension-pill ${readOnly ? "is-locked" : ""}`}
          role="listitem"
          draggable={!readOnly}
          ondragstart={(event) => handlePillDragStart(event, index)}
          ondragover={handleDragOver}
          ondrop={(event) => {
            event.stopPropagation();
            handleDrop(event, index);
          }}
        >
          {transformation.name}
          {#if transformation.args.length}
            <span class="dimension-args">({transformation.args.join(", ")})</span>
          {/if}
          {#if !readOnly}
            <input
              class="dimension-args-input"
              value={transformation.args.join(", ")}
              placeholder="args: 0, 1"
              onpointerdown={(event) => event.stopPropagation()}
              oninput={(event) => {
                const target = event.target as HTMLInputElement | null;
                updateTransformationArgs(index, target?.value ?? "");
              }}
            />
          {/if}
          <button
            type="button"
            class="pill-remove"
            aria-label={`Remove ${transformation.name}`}
            disabled={readOnly}
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

  .dimension-ri {
    @apply mt-2 flex items-center gap-1 text-[0.5rem] uppercase tracking-[0.2em] text-white/50;
  }

  .dimension-ri-label {
    @apply text-white/30;
  }

  .dimension-ri-input {
    @apply w-12 rounded-sm border border-white/10 bg-black/60 px-1 py-[0.1rem]
      text-[0.55rem] text-white/70 outline-none;
  }

  .dimension-ri-input:disabled {
    @apply border-white/5 text-white/30;
  }

  .dimension-ri-toggle {
    @apply rounded-sm border border-white/10 px-2 py-[0.1rem] text-[0.5rem] text-white/50;
  }

  .dimension-ri-toggle.is-locked {
    @apply border-emerald-400/40 text-emerald-200;
  }

  .dimension-ri-toggle:disabled {
    @apply border-white/5 text-white/30 cursor-not-allowed;
  }

  .dimension-chain {
    @apply mt-2 flex flex-wrap items-center gap-1 text-[0.55rem] uppercase tracking-[0.18em];
  }

  .dimension-pill {
    @apply inline-flex items-center gap-1 rounded-md border border-white/10
      bg-white/5 px-2 py-[0.1rem] text-white/70;
  }

  .dimension-pill.is-locked {
    @apply opacity-60;
  }

  .dimension-args {
    @apply text-white/50;
  }

  .dimension-args-input {
    @apply ml-1 w-16 rounded-sm border border-white/15 bg-black/70 px-1 py-[0.05rem] text-[0.5rem] normal-case tracking-normal text-white/80 outline-none;
  }

  .pill-remove:disabled {
    @apply opacity-40 cursor-not-allowed;
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
