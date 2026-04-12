<script lang="ts">
  import { Handle, Position, type NodeProps } from "@xyflow/svelte";

  type ParticleNodeData = {
    label: string;
    placeholder?: boolean;
    placeholderDetail?: string;
    placeholderState?: "loading" | "warning";
  };

  const { data, selected }: NodeProps<ParticleNodeData> = $props();
  const selectedClass = $derived(selected ? "is-selected" : "");
  const isPlaceholder = $derived(Boolean(data.placeholder));
  const placeholderDetail = $derived((data.placeholderDetail ?? "").trim());
  const placeholderState = $derived(data.placeholderState ?? "loading");
  const displayLabel = $derived.by(() =>
    isPlaceholder ? (data.label ?? "").trim() : (data.label ?? "").trim(),
  );
</script>

<div
  class="particle-node {selectedClass} {isPlaceholder
    ? `is-placeholder is-${placeholderState}`
    : ''}"
>
  <div class="particle-title">{displayLabel}</div>
  {#if isPlaceholder && placeholderDetail}
    <div class="particle-detail">{placeholderDetail}</div>
  {/if}
  <Handle type="target" position={Position.Top} id="in" />
  <Handle type="source" position={Position.Bottom} id="out" />
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .particle-node {
    @apply min-w-[150px] rounded-md border border-white/15 bg-black/80 px-3 py-2 text-white/80 shadow-lg;
  }

  .particle-node.is-selected {
    @apply border-emerald-400/60 text-emerald-100;
    box-shadow:
      0 0 0 1px rgba(52, 211, 153, 0.3),
      0 12px 24px rgba(0, 0, 0, 0.4);
  }

  .particle-title {
    @apply text-[0.7rem] font-semibold tracking-[0.08em];
  }

  .particle-node.is-placeholder {
    @apply border-white/30 bg-white/[0.02] text-white/60;
    border-style: dashed;
  }

  .particle-node.is-placeholder.is-loading {
    animation: placeholder-node-pulse 1.35s ease-in-out infinite;
  }

  .particle-node.is-placeholder.is-warning {
    @apply border-amber-300/35 text-amber-100/70;
    animation: none;
  }

  .particle-detail {
    @apply mt-1 text-[0.52rem] uppercase tracking-[0.14em] text-white/45;
  }

  @keyframes placeholder-node-pulse {
    0% {
      background-color: rgba(255, 255, 255, 0.02);
      border-color: rgba(255, 255, 255, 0.24);
    }
    50% {
      background-color: rgba(255, 255, 255, 0.07);
      border-color: rgba(94, 234, 212, 0.42);
    }
    100% {
      background-color: rgba(255, 255, 255, 0.02);
      border-color: rgba(255, 255, 255, 0.24);
    }
  }
</style>
