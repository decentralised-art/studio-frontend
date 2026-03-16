<script lang="ts">
  import { Handle, Position, type NodeProps, useUpdateNodeInternals } from "@xyflow/svelte";

  type ConnectorRowPreview = {
    dimension: number;
    transformations: string[];
  };

  type ConnectorNodeData = {
    label: string;
    dimensions?: number;
    connectorRows?: ConnectorRowPreview[];
    conditionLabel?: string | null;
    boundKind?: "static" | "forwarded" | null;
    boundSlotLabel?: string | null;
    boundOwnerName?: string | null;
    selectedDimensionIndex?: number;
    conditionTargetSelected?: boolean;
    fromNetwork?: boolean;
    networkId?: string;
    connectorTreeCollapsible?: boolean;
    connectorTreeCollapsed?: boolean;
    definitionRole?: "root" | "member" | null;
    tabRoot?: boolean;
  };

  const { id, data, selected }: NodeProps<ConnectorNodeData> = $props();
  const updateNodeInternals = useUpdateNodeInternals();

  const dimensionCount = $derived(Math.max(1, Math.round(data.dimensions ?? 1)));
  const selectedClass = $derived(selected ? "is-selected" : "");
  const selectedDimensionIndex = $derived(
    typeof data.selectedDimensionIndex === "number" ? data.selectedDimensionIndex : null,
  );
  const conditionLabel = $derived((data.conditionLabel ?? "").trim());
  const boundKind = $derived(data.boundKind ?? null);
  const boundSlotLabel = $derived((data.boundSlotLabel ?? "").trim());
  const boundOwnerName = $derived((data.boundOwnerName ?? "").trim());
  const conditionTargetSelected = $derived(Boolean(data.conditionTargetSelected));
  const readOnly = $derived(Boolean(data.fromNetwork));
  const definitionRole = $derived(data.definitionRole ?? null);
  const definitionClass = $derived(definitionRole ? `is-definition-${definitionRole}` : "");
  const tabRoot = $derived(Boolean(data.tabRoot));
  const showTopInlet = $derived(!tabRoot);
  const dimensionLabel = $derived(dimensionCount === 1 ? "dimension" : "dimensions");
  const connectorNameForTree = $derived((data.networkId ?? "").trim());
  const canOpenConnectorTree = $derived(connectorNameForTree.length > 0);
  const connectorRows = $derived.by(() => {
    const rows = (data.connectorRows ?? []).slice().sort((a, b) => a.dimension - b.dimension);
    if (rows.length) return rows;
    return Array.from({ length: dimensionCount }, (_, index) => ({
      dimension: index + 1,
      transformations: [],
    }));
  });
  const connectorRowsFingerprint = $derived(
    connectorRows.map((row) => `${row.dimension}:${row.transformations.join(",")}`).join("|"),
  );

  const handleLeft = (index: number) => ((index + 1) / (dimensionCount + 1)) * 100;
  const touchDeps = (..._deps: unknown[]) => _deps.length;

  $effect(() => {
    touchDeps(connectorRowsFingerprint, showTopInlet);
    if (dimensionCount >= 0) {
      updateNodeInternals(id);
    }
  });
</script>

<div class="connector-node {selectedClass} {definitionClass}">
  {#if showTopInlet}
    <Handle type="target" position={Position.Top} id="in" />
  {/if}
  <div class="connector-header">
    <div class="connector-title-row">
      <div class="connector-title">{data.label}</div>
      {#if readOnly}
        <span class="connector-readonly-chip">On-chain (read-only)</span>
      {/if}
    </div>
    <div class="connector-actions">
      <button
        type="button"
        class="connector-open-tree"
        title={canOpenConnectorTree
          ? "Open connector tree as a new tab"
          : "Connector tree unavailable"}
        aria-label="Open connector tree"
        data-open-connector-tree
        data-connector-name={connectorNameForTree}
        disabled={!canOpenConnectorTree}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 8h8v8"></path>
          <path d="M16 8L8 16"></path>
        </svg>
      </button>
    </div>
  </div>
  <div class="connector-meta">{dimensionCount} {dimensionLabel}</div>
  {#if boundKind}
    <div class="connector-bound">
      <span>binding of {boundOwnerName || "connector"}</span>
      {#if boundSlotLabel}
        <small>{boundSlotLabel}</small>
      {/if}
    </div>
  {/if}
  <div
    class={`connector-condition-slot ${conditionTargetSelected ? "is-drop-selected" : ""}`}
    data-connector-drop-target="condition"
    data-connector-id={id}
  >
    <span class="condition-label">Condition</span>
    {#if conditionLabel}
      <span class="condition-value">{conditionLabel}</span>
    {:else}
      <span class="condition-empty">drop condition</span>
    {/if}
  </div>
  <div class="connector-grid">
    {#each connectorRows as row (row.dimension)}
      <div
        class={`connector-row ${selectedDimensionIndex === row.dimension - 1 ? "is-drop-selected" : ""}`}
        data-connector-drop-target="dimension"
        data-connector-id={id}
        data-dimension-index={row.dimension - 1}
      >
        <div class="dimension-label">D{row.dimension}</div>
        <div class="dimension-transformations">
          {#if row.transformations.length}
            {#each row.transformations as transformation, txIndex (`${row.dimension}-${txIndex}-${transformation}`)}
              <span class="tx-chip">{transformation}</span>
            {/each}
          {:else}
            <span class="tx-empty">no transformations</span>
          {/if}
        </div>
      </div>
    {/each}
  </div>
  {#each Array(dimensionCount) as _, index (index)}
    <Handle
      type="source"
      position={Position.Bottom}
      id={`dim-${index}`}
      style={`left: ${handleLeft(index)}%;`}
    />
  {/each}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .connector-node {
    @apply min-w-[240px] rounded-md border border-white/15 bg-black/80 px-3 py-2 text-white/80 shadow-lg;
    transition:
      background-color 160ms ease,
      border-color 160ms ease,
      box-shadow 160ms ease;
  }

  .connector-node.is-selected {
    @apply border-emerald-400/60 text-emerald-100;
    box-shadow:
      0 0 0 1px rgba(52, 211, 153, 0.3),
      0 12px 24px rgba(0, 0, 0, 0.4);
  }

  .connector-node.is-definition-root {
    @apply border-cyan-200/85 bg-cyan-300/[0.14] text-cyan-50;
    box-shadow:
      0 0 0 2px rgba(125, 211, 252, 0.55),
      0 14px 30px rgba(0, 0, 0, 0.48);
  }

  .connector-node.is-definition-member {
    @apply border-cyan-300/65 bg-cyan-500/[0.08] text-cyan-100/95;
    box-shadow:
      0 0 0 1px rgba(125, 211, 252, 0.28),
      0 10px 20px rgba(0, 0, 0, 0.4);
  }

  .connector-node.is-definition-member .connector-row,
  .connector-node.is-definition-member .connector-condition-slot {
    @apply border-cyan-300/30 bg-cyan-500/[0.07];
  }

  .connector-node.is-definition-root .connector-row,
  .connector-node.is-definition-root .connector-condition-slot {
    @apply border-cyan-200/40 bg-cyan-300/[0.12];
  }

  .connector-node.is-selected.is-definition-member {
    box-shadow:
      0 0 0 2px rgba(52, 211, 153, 0.35),
      0 0 0 3px rgba(125, 211, 252, 0.32),
      0 14px 30px rgba(0, 0, 0, 0.46);
  }

  .connector-node.is-selected.is-definition-root {
    box-shadow:
      0 0 0 2px rgba(52, 211, 153, 0.4),
      0 0 0 4px rgba(125, 211, 252, 0.48),
      0 18px 34px rgba(0, 0, 0, 0.5);
  }

  .connector-title {
    @apply text-[0.7rem] font-semibold uppercase tracking-[0.2em];
  }

  .connector-title-row {
    @apply min-w-0 flex flex-wrap items-center gap-2;
  }

  .connector-header {
    @apply flex items-start justify-between gap-2;
  }

  .connector-actions {
    @apply inline-flex items-center gap-1;
  }

  .connector-open-tree {
    @apply inline-flex h-5 w-5 items-center justify-center rounded border border-white/20 bg-transparent text-white/70 transition;
  }

  .connector-open-tree svg {
    @apply h-3 w-3;
  }

  .connector-open-tree:hover:not(:disabled) {
    @apply border-emerald-300/60 text-emerald-100;
  }

  .connector-open-tree:disabled {
    @apply cursor-not-allowed border-white/10 text-white/30;
  }

  .connector-meta {
    @apply mt-1 text-[0.6rem] uppercase tracking-[0.2em] text-white/50;
  }

  .connector-bound {
    @apply mt-1 inline-flex flex-col rounded border border-amber-300/45 bg-amber-200/10 px-2 py-0.5 text-[0.5rem] uppercase tracking-[0.18em] text-amber-100;
  }

  .connector-bound small {
    @apply text-[0.48rem] normal-case tracking-normal text-amber-100/85;
  }

  .connector-grid {
    @apply mt-2 flex flex-col gap-1;
  }

  .connector-condition-slot {
    @apply mt-2 grid grid-cols-[5.2rem_1fr] items-center gap-2 rounded border border-dashed border-white/20 bg-white/[0.03] px-2 py-1;
  }

  .connector-condition-slot.is-drop-selected {
    @apply border-emerald-300/60 bg-emerald-500/10;
  }

  .condition-label {
    @apply text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-emerald-200/80;
  }

  .condition-value {
    @apply text-[0.52rem] uppercase tracking-[0.15em] text-white/90;
  }

  .condition-empty {
    @apply text-[0.52rem] uppercase tracking-[0.15em] text-white/40;
  }

  .connector-row {
    @apply grid grid-cols-[2.2rem_1fr] items-center gap-2 rounded border border-white/10 bg-white/[0.03] px-2 py-1;
  }

  .connector-row.is-drop-selected {
    @apply border-emerald-300/60 bg-emerald-500/10;
  }

  .dimension-label {
    @apply text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-emerald-200/80;
  }

  .connector-readonly-chip {
    @apply inline-flex w-fit rounded border border-cyan-300/30 bg-cyan-400/10 px-2 py-0.5 text-[0.5rem] uppercase tracking-[0.16em] text-cyan-100/85;
  }

  .dimension-transformations {
    @apply flex flex-wrap gap-1;
  }

  .tx-chip {
    @apply rounded border border-white/20 bg-white/[0.06] px-1.5 py-0.5 text-[0.52rem] uppercase tracking-[0.15em] text-white/85;
  }

  .tx-empty {
    @apply text-[0.52rem] uppercase tracking-[0.15em] text-white/35;
  }
</style>
