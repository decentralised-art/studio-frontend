<script lang="ts">
  import {
    Handle,
    Position,
    type Node,
    type NodeProps,
    useUpdateNodeInternals,
  } from "@xyflow/svelte";

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
    contextHighlightRole?: "selected" | "member" | null;
    tabRoot?: boolean;
    hideOutlets?: boolean;
    staticRi?: Record<string, { startPoint: number; transformationShift: number }>;
    showRiControls?: boolean;
    riStart?: number;
    riShift?: number;
    riLocked?: boolean;
    riPosition?: number;
    riTargetPosition?: number;
    riLockToggleDisabled?: boolean;
  };

  type ConnectorNode = Node<ConnectorNodeData, "connector">;

  const { id, data, selected }: NodeProps<ConnectorNode> = $props();
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
  const contextHighlightRole = $derived(data.contextHighlightRole ?? null);
  const contextHighlightClass = $derived(
    contextHighlightRole ? `is-context-${contextHighlightRole}` : "",
  );
  const tabRoot = $derived(Boolean(data.tabRoot));
  const isRootConnector = $derived(tabRoot || definitionRole === "root");
  const showTopInlet = $derived(!tabRoot);
  const showPluginInlet = $derived(tabRoot);
  const dimensionLabel = $derived(dimensionCount === 1 ? "dimension" : "dimensions");
  const connectorNameForTree = $derived((data.networkId ?? "").trim());
  const canOpenConnectorTree = $derived(!tabRoot && connectorNameForTree.length > 0);
  const showBottomOutlets = $derived(!data.hideOutlets);
  const showRiControls = $derived(data.showRiControls !== false);
  const riLocked = $derived(Boolean(data.riLocked));
  const staticRiClass = $derived(riLocked ? "has-static-ri" : "");
  const riLockToggleDisabled = $derived(Boolean(data.riLockToggleDisabled));
  const riStart = $derived(Number(data.riStart ?? 0));
  const riShift = $derived(Number(data.riShift ?? 0));
  const canEditRi = $derived(!riLocked);
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
  const connectorTitle = $derived.by(() => (data.label ?? "").trim());
  const boundOwnerDisplayName = $derived.by(() => boundOwnerName);

  const handleLeft = (index: number) => ((index + 1) / (dimensionCount + 1)) * 100;
  const touchDeps = (..._deps: unknown[]) => _deps.length;
  const parseNumberInput = (value: string) => {
    const next = Number(value);
    if (!Number.isFinite(next)) return 0;
    return Math.max(0, Math.trunc(next));
  };
  const emitRiPatch = (patch: { riStart?: number; riShift?: number; riLocked?: boolean }) => {
    window.dispatchEvent(
      new CustomEvent("studio-ri-update", {
        detail: { nodeId: id, patch },
      }),
    );
  };

  $effect(() => {
    touchDeps(
      connectorRowsFingerprint,
      showTopInlet,
      showPluginInlet,
      showBottomOutlets,
      isRootConnector,
    );
    if (dimensionCount >= 0) {
      updateNodeInternals(id);
    }
  });
</script>

<div
  class="connector-node {selectedClass} {definitionClass} {contextHighlightClass} {staticRiClass}"
>
  {#if showTopInlet}
    <Handle type="target" position={Position.Top} id="in" />
  {/if}
  {#if showPluginInlet}
    <Handle type="target" position={Position.Top} id="plugin-in" />
  {/if}
  <div class="connector-header">
    <div class="connector-title-row">
      <div class="connector-title">{connectorTitle}</div>
      {#if readOnly}
        <span class="connector-readonly-chip">On-chain (read-only)</span>
      {/if}
      {#if riLocked}
        <span class="connector-static-ri-chip">Static RI</span>
      {/if}
    </div>
    <div class="connector-actions">
      {#if isRootConnector}
        <span class="connector-root-chip">Root</span>
      {/if}
      {#if !tabRoot}
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
        ></button>
      {/if}
    </div>
  </div>
  <div class="connector-meta">{dimensionCount} {dimensionLabel}</div>
  {#if boundKind}
    <div class="connector-bound">
      <span>binding of {boundOwnerDisplayName || "connector"}</span>
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
  {#if showRiControls}
    <div class="connector-ri-grid" aria-label="Running instances controls">
      <div class="connector-ri-row">
        <span class="connector-ri-dim">RI</span>
        <input
          class="connector-ri-input"
          type="number"
          inputmode="numeric"
          min="0"
          step="1"
          placeholder="start"
          value={riStart}
          disabled={!canEditRi}
          onwheel={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLInputElement).blur();
          }}
          onkeydown={(event) => {
            if (["-", "+", "e", "E", "."].includes(event.key)) event.preventDefault();
          }}
          oninput={(event) => {
            const target = event.target as HTMLInputElement | null;
            emitRiPatch({ riStart: parseNumberInput(target?.value ?? "0") });
          }}
        />
        <input
          class="connector-ri-input"
          type="number"
          inputmode="numeric"
          min="0"
          step="1"
          placeholder="shift"
          value={riShift}
          disabled={!canEditRi}
          onwheel={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLInputElement).blur();
          }}
          onkeydown={(event) => {
            if (["-", "+", "e", "E", "."].includes(event.key)) event.preventDefault();
          }}
          oninput={(event) => {
            const target = event.target as HTMLInputElement | null;
            emitRiPatch({ riShift: parseNumberInput(target?.value ?? "0") });
          }}
        />
        <button
          type="button"
          class={`connector-ri-toggle ${riLocked ? "is-locked" : ""}`}
          disabled={riLockToggleDisabled}
          onclick={() => emitRiPatch({ riLocked: !riLocked })}
        >
          {riLocked ? "static" : "open"}
        </button>
      </div>
    </div>
  {/if}
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
  {#if showBottomOutlets}
    {#each Array(dimensionCount) as _, index (index)}
      <Handle
        type="source"
        position={Position.Bottom}
        id={`dim-${index}`}
        style={`left: ${handleLeft(index)}%;`}
      />
    {/each}
  {/if}
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
    @apply border-sky-300/30 bg-sky-500/[0.04] text-white/85;
    box-shadow: 0 10px 22px rgba(0, 0, 0, 0.42);
  }

  .connector-node.is-definition-member {
    @apply border-cyan-300/25 bg-cyan-500/[0.035] text-white/82;
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.4);
  }

  .connector-node.is-definition-member .connector-row,
  .connector-node.is-definition-member .connector-condition-slot {
    @apply border-cyan-300/15 bg-cyan-500/[0.035];
  }

  .connector-node.is-definition-root .connector-row,
  .connector-node.is-definition-root .connector-condition-slot {
    @apply border-sky-300/18 bg-sky-500/[0.04];
  }

  .connector-node.is-context-selected:not(.is-selected) {
    @apply border-emerald-400/45 bg-emerald-500/[0.05] text-emerald-100;
    box-shadow:
      0 0 0 1px rgba(52, 211, 153, 0.2),
      0 12px 24px rgba(0, 0, 0, 0.4);
  }

  .connector-node.is-context-member:not(.is-selected) {
    @apply border-emerald-300/32 bg-emerald-500/[0.04] text-emerald-50/90;
    box-shadow:
      0 0 0 1px rgba(52, 211, 153, 0.12),
      0 10px 20px rgba(0, 0, 0, 0.38);
  }

  .connector-node.is-context-member .connector-row,
  .connector-node.is-context-member .connector-condition-slot {
    @apply border-emerald-300/18 bg-emerald-500/[0.035];
  }

  .connector-node.has-static-ri:not(.is-selected):not(.is-definition-root):not(
      .is-definition-member
    ):not(.is-context-selected):not(.is-context-member) {
    @apply border-violet-300/45 bg-violet-500/[0.06];
  }

  .connector-node.has-static-ri .connector-row,
  .connector-node.has-static-ri .connector-condition-slot {
    @apply border-violet-300/25 bg-violet-500/[0.05];
  }

  .connector-title {
    @apply text-[0.7rem] font-semibold tracking-[0.08em];
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

  .connector-ri-grid {
    @apply mt-2 flex flex-col gap-1;
  }

  .connector-ri-row {
    @apply grid grid-cols-[3.1rem_1fr_1fr_auto] items-center gap-1.5 rounded border border-white/10 bg-white/[0.03] px-2 py-1;
  }

  .connector-ri-dim {
    @apply text-[0.54rem] font-semibold uppercase tracking-[0.2em] text-violet-100/85;
  }

  .connector-ri-input {
    @apply h-6 w-full rounded border border-white/15 bg-black/45 px-1.5 text-[0.56rem] uppercase tracking-[0.12em] text-white/85 outline-none transition;
  }

  .connector-ri-input:focus {
    @apply border-emerald-300/70 bg-black/55;
  }

  .connector-ri-input:disabled {
    @apply cursor-not-allowed border-white/10 text-white/40;
  }

  .connector-ri-toggle {
    @apply h-6 rounded border border-white/15 bg-white/[0.05] px-2 text-[0.5rem] uppercase tracking-[0.12em] text-white/70 transition;
  }

  .connector-ri-toggle.is-locked {
    @apply border-violet-300/45 bg-violet-500/15 text-violet-100;
  }

  .connector-ri-toggle:disabled {
    @apply cursor-not-allowed border-white/10 text-white/35;
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

  .connector-root-chip {
    @apply inline-flex w-fit rounded border border-sky-300/35 bg-sky-400/12 px-2 py-0.5 text-[0.5rem] uppercase tracking-[0.16em] text-sky-100/95;
  }

  .connector-static-ri-chip {
    @apply inline-flex w-fit rounded border border-violet-300/35 bg-violet-400/12 px-2 py-0.5 text-[0.5rem] uppercase tracking-[0.16em] text-violet-100/90;
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
