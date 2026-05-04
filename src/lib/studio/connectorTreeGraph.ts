import type { Edge } from "@xyflow/svelte";

import { cloneStaticRiMap } from "$lib/studio/connectorGraph";
import type {
  StudioConnectorDef,
  StudioRunningInstanceRef,
} from "$lib/studio/domain/connectorModel";
import { buildExecuteRiPlan } from "$lib/studio/executeRequestPlanner";
import { formatTransformationPreviewLabel } from "$lib/studio/studioNaming";

export type ConnectorTreeNodeKind = "connector" | "dimension" | "condition" | "particle";

export type ConnectorTreeTransformationInstance = {
  id: string;
  name: string;
  args: number[];
  status: "draft" | "network";
};

export type ConnectorTreeRowPreview = {
  dimension: number;
  transformations: string[];
};

export type ConnectorTreeNodeData = {
  label: string;
  kind: ConnectorTreeNodeKind;
  particleId?: string;
  sourceId?: string;
  dimensions?: number;
  parentFeatureId?: string;
  dimensionIndex?: number;
  transformations?: ConnectorTreeTransformationInstance[];
  connectorRows?: ConnectorTreeRowPreview[];
  conditionLabel?: string | null;
  boundKind?: "static" | "forwarded" | null;
  boundSlotLabel?: string | null;
  boundOwnerName?: string | null;
  networkId?: string;
  fromNetwork?: boolean;
  placeholder?: boolean;
  placeholderDetail?: string;
  placeholderState?: "loading" | "warning";
  tabRoot?: boolean;
  hideOutlets?: boolean;
  riStart?: number;
  riShift?: number;
  riLocked?: boolean;
  riPosition?: number;
  staticRi?: Record<string, StudioRunningInstanceRef>;
};

export type ConnectorTreeNode = {
  id: string;
  position: { x: number; y: number };
  data: ConnectorTreeNodeData;
  selected?: boolean;
  type?: string;
  draggable?: boolean;
  hidden?: boolean;
};

export type ConnectorTreeModel = {
  rootConnectorName: string;
  nodes: ConnectorTreeNode[];
  edges: Edge[];
};

export type ConnectorTreeGraphOptions = {
  hideReadOnlyLeafOutlets?: boolean;
  markRootAsTabRoot?: boolean;
  idFactory?: () => string;
  labelForConnector?: (connectorName: string) => string;
};

type ConnectorTreePlaceholderModel = {
  nodes: Array<{ data: { placeholder?: boolean } }>;
};

export const hasConnectorTreePlaceholderNodes = (
  model: ConnectorTreePlaceholderModel | null | undefined,
) => Boolean(model?.nodes.some((node) => Boolean(node.data.placeholder)));

export const isCompleteConnectorTreeModel = (
  model: ConnectorTreePlaceholderModel | null | undefined,
) => Boolean(model && model.nodes.length > 0 && !hasConnectorTreePlaceholderNodes(model));

export const shouldReplaceConnectorTreeModel = (
  current: ConnectorTreePlaceholderModel | null | undefined,
  next: ConnectorTreePlaceholderModel | null | undefined,
) => {
  if (isCompleteConnectorTreeModel(next)) return true;
  return !isCompleteConnectorTreeModel(current);
};

type IncomingBindingDescriptor = {
  targetName: string;
  kind: "static" | "forwarded";
  fromSlot: number;
  ownerConnectorName: string;
  forwarded: Map<number, IncomingBindingDescriptor>;
};

type OpenSlotComputationOptions = {
  tolerant?: boolean;
};

const createId = (idFactory?: () => string): string =>
  idFactory?.() ?? globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

const createTransformationInstance = (
  idFactory: (() => string) | undefined,
  name: string,
  args: number[] = [],
  status: ConnectorTreeTransformationInstance["status"] = "network",
): ConnectorTreeTransformationInstance => ({
  id: `tx-${createId(idFactory)}`,
  name,
  args,
  status,
});

export const getSortedCanonicalBindingEntries = (bindings: Record<string, string> = {}) => {
  const entries = Object.entries(bindings)
    .map(([slotRaw, targetRaw]) => {
      const slot = String(slotRaw).trim();
      if (!/^\d+$/.test(slot)) return null;
      const slotId = Number.parseInt(slot, 10);
      if (!Number.isInteger(slotId) || slotId < 0) return null;
      if (String(slotId) !== slot) return null;
      const targetName = String(targetRaw ?? "").trim();
      if (!targetName) return null;
      return { slotId, targetName };
    })
    .filter((value): value is { slotId: number; targetName: string } => Boolean(value));
  entries.sort((lhs, rhs) => lhs.slotId - rhs.slotId);
  return entries;
};

const cloneIncomingBindingDescriptor = (
  binding: IncomingBindingDescriptor | null | undefined,
  fallbackSlot = 0,
): IncomingBindingDescriptor | null => {
  if (!binding) return null;
  const targetName = String(binding.targetName ?? "").trim();
  if (!targetName) return null;
  const fromSlot = Number.isInteger(binding.fromSlot) ? binding.fromSlot : fallbackSlot;
  const ownerConnectorName = String(binding.ownerConnectorName ?? "").trim();
  return {
    targetName,
    kind: binding.kind === "static" ? "static" : "forwarded",
    fromSlot,
    ownerConnectorName,
    forwarded: cloneIncomingBindingMap(binding.forwarded),
  };
};

const cloneIncomingBindingAsForwarded = (
  binding: IncomingBindingDescriptor | null | undefined,
  fallbackSlot = 0,
): IncomingBindingDescriptor | null => {
  const cloned = cloneIncomingBindingDescriptor(binding, fallbackSlot);
  if (!cloned) return null;
  cloned.kind = "forwarded";
  return cloned;
};

const cloneIncomingBindingMap = (
  bindings: Map<number, IncomingBindingDescriptor> | null | undefined,
) => {
  const cloned = new Map<number, IncomingBindingDescriptor>();
  if (!(bindings instanceof Map)) return cloned;
  for (const [slotId, binding] of bindings.entries()) {
    if (!Number.isInteger(slotId) || slotId < 0) continue;
    const clonedBinding = cloneIncomingBindingDescriptor(binding, slotId);
    if (!clonedBinding) continue;
    cloned.set(slotId, clonedBinding);
  }
  return cloned;
};

const getSortedIncomingBindingEntries = (bindings: Map<number, IncomingBindingDescriptor>) =>
  Array.from(bindings.entries())
    .filter(([slotId, binding]) => Number.isInteger(slotId) && slotId >= 0 && Boolean(binding))
    .sort((lhs, rhs) => lhs[0] - rhs[0]);

export const computeConnectorOpenSlotsInRegistry = (
  connectorRegistry: Record<string, StudioConnectorDef>,
  connectorName: string,
  cache = new Map<string, number>(),
  visiting = new Set<string>(),
  options: OpenSlotComputationOptions = {},
): number => {
  const tolerant = options.tolerant === true;
  if (cache.has(connectorName)) return cache.get(connectorName) ?? 0;
  if (visiting.has(connectorName)) {
    if (tolerant) return 1;
    throw new Error(`Connector cycle detected at '${connectorName}'.`);
  }
  const connector = connectorRegistry[connectorName];
  if (!connector) {
    if (tolerant) return 1;
    throw new Error(`Missing connector '${connectorName}'.`);
  }

  visiting.add(connectorName);
  try {
    let openSlots = 0;
    connector.dimensions.forEach((dimension, dimIndex) => {
      if (!dimension.composite) {
        openSlots += 1;
        return;
      }

      const childOpenSlots = computeConnectorOpenSlotsInRegistry(
        connectorRegistry,
        dimension.composite,
        cache,
        visiting,
        options,
      );
      openSlots += childOpenSlots;

      const staticTargetsByChildSlot = new Map<number, string>();
      getSortedCanonicalBindingEntries(dimension.bindings ?? {}).forEach(
        ({ slotId, targetName }) => {
          if (slotId >= childOpenSlots) {
            if (tolerant) return;
            throw new Error(
              `Connector '${connectorName}' has out-of-range binding slot ${slotId} at dimension ${dimIndex} (child '${dimension.composite}' exports ${childOpenSlots} slots).`,
            );
          }
          if (staticTargetsByChildSlot.has(slotId)) {
            if (tolerant) return;
            throw new Error(
              `Connector '${connectorName}' has duplicate canonical binding slot ${slotId} at dimension ${dimIndex}.`,
            );
          }
          staticTargetsByChildSlot.set(slotId, targetName);
        },
      );

      for (const targetName of staticTargetsByChildSlot.values()) {
        openSlots += computeConnectorOpenSlotsInRegistry(
          connectorRegistry,
          targetName,
          cache,
          visiting,
          options,
        );
      }

      openSlots -= staticTargetsByChildSlot.size;
    });

    cache.set(connectorName, openSlots);
    return openSlots;
  } finally {
    visiting.delete(connectorName);
  }
};

const createDimensionNode = (
  idFactory: (() => string) | undefined,
  connector: ConnectorTreeNode,
  dimensionIndex: number,
  totalDimensions: number,
): ConnectorTreeNode => {
  const spacing = 200;
  const rowY = connector.position.y + 160;
  const startX = connector.position.x - ((Math.max(1, totalDimensions) - 1) * spacing) / 2;
  return {
    id: `dimension-${connector.id}-${dimensionIndex}-${createId(idFactory)}`,
    type: "dimension",
    hidden: true,
    draggable: false,
    position: {
      x: startX + dimensionIndex * spacing,
      y: rowY,
    },
    data: {
      label: `#${dimensionIndex + 1}`,
      kind: "dimension",
      parentFeatureId: connector.id,
      dimensionIndex,
      transformations: [],
      fromNetwork: connector.data.fromNetwork ?? false,
      riStart: 0,
      riShift: 0,
      riLocked: false,
    },
  };
};

const estimateConnectorTreeNodeHeight = (node: ConnectorTreeNode): number => {
  if (node.data.kind === "connector") {
    const dimensions = Math.max(1, Math.round(node.data.dimensions ?? 1));
    return 220 + Math.max(0, dimensions - 1) * 42;
  }
  if (node.data.kind === "condition") return 96;
  return 90;
};

export const buildConnectorTreeGraph = ({
  connectorRegistry,
  rootConnectorName,
  origin,
  options = {},
}: {
  connectorRegistry: Record<string, StudioConnectorDef>;
  rootConnectorName: string;
  origin: { x: number; y: number };
  options?: ConnectorTreeGraphOptions;
}): ConnectorTreeModel => {
  const root = connectorRegistry[rootConnectorName];
  if (!root) return { rootConnectorName, nodes: [], edges: [] };

  const idFactory = options.idFactory;
  const labelForConnector = options.labelForConnector ?? ((connectorName: string) => connectorName);

  const resolvedStaticByPosition = new Map<number, StudioRunningInstanceRef>();
  try {
    const staticPlan = buildExecuteRiPlan(connectorRegistry, rootConnectorName, {});
    Object.values(staticPlan.staticRiByPosition).forEach((entry) => {
      resolvedStaticByPosition.set(entry.position, {
        startPoint: entry.startPoint,
        transformationShift: entry.transformationShift,
      });
    });
  } catch {
    // Keep zero/open defaults when RI projection is unavailable.
  }

  const graphNodes: ConnectorTreeNode[] = [];
  const graphEdges: Edge[] = [];
  const edgeKeySet = new Set<string>();
  const openSlotCache = new Map<string, number>();
  const treeInfo = new Map<string, { depth: number; children: string[] }>();
  const conditionParentById = new Map<string, string>();
  const horizontalSpacing = 380;
  const fallbackVerticalSpacing = 340;
  let leafCursor = 0;
  let riPositionCursor = 0;

  const pushEdge = (
    sourceId: string,
    sourceHandle: string,
    targetId: string,
    targetHandle: string,
    edgeOptions?: {
      label?: string;
      kind?: "composite" | "binding" | "open";
      bindingOwnerName?: string | null;
      bindingSlot?: number | null;
    },
  ) => {
    const key = `${sourceId}|${sourceHandle}|${targetId}|${targetHandle}|${edgeOptions?.kind ?? "plain"}|${edgeOptions?.label ?? ""}|${edgeOptions?.bindingOwnerName ?? ""}|${edgeOptions?.bindingSlot ?? ""}`;
    if (edgeKeySet.has(key)) return;
    edgeKeySet.add(key);
    const isBinding = edgeOptions?.kind === "binding";
    const isOpen = edgeOptions?.kind === "open";
    graphEdges.push({
      id: `edge-${createId(idFactory)}`,
      source: sourceId,
      sourceHandle,
      target: targetId,
      targetHandle,
      ...(edgeOptions?.label ? { label: edgeOptions.label } : {}),
      ...(edgeOptions?.kind === "composite" || edgeOptions?.kind === "binding"
        ? {
            data: {
              relation: edgeOptions.kind,
              ...(isBinding && edgeOptions?.bindingOwnerName
                ? { bindingOwnerName: edgeOptions.bindingOwnerName }
                : {}),
              ...(isBinding && typeof edgeOptions?.bindingSlot === "number"
                ? { bindingSlot: edgeOptions.bindingSlot }
                : {}),
            },
          }
        : {}),
      ...(isBinding
        ? {
            style: "stroke:#c97500;stroke-dasharray:8 5;",
          }
        : isOpen
          ? {
              style: "stroke:#7b8794;stroke-dasharray:4 6;",
            }
          : {}),
    });
  };

  const createOpenSlotPlaceholder = (
    detail: string,
    depth: number,
    kind: "missing" | "cycle" = "missing",
  ) => {
    const id = `placeholder-${kind}-${createId(idFactory)}`;
    graphNodes.push({
      id,
      type: "particle",
      draggable: true,
      position: { x: origin.x, y: origin.y + depth * fallbackVerticalSpacing },
      data: {
        label: kind === "cycle" ? "Connector cycle" : "Loading connector...",
        kind: "particle",
        fromNetwork: true,
        placeholder: true,
        placeholderDetail: kind === "cycle" ? detail : `waiting for chain sync: ${detail}`,
        placeholderState: kind === "cycle" ? "warning" : "loading",
      },
    });
    treeInfo.set(id, { depth, children: [] });
    return id;
  };

  const expandConnector = (
    input: {
      connectorName: string;
      incomingBindings: Map<number, IncomingBindingDescriptor>;
      depth: number;
      boundDescriptor?: {
        kind: "static" | "forwarded";
        slotLabel: string;
        ownerConnectorName?: string | null;
      } | null;
    },
    visiting = new Set<string>(),
  ): string => {
    const connectorName = input.connectorName.trim();
    if (!connectorName) {
      return createOpenSlotPlaceholder("Unnamed connector reference", input.depth);
    }

    if (visiting.has(connectorName)) {
      return createOpenSlotPlaceholder(`Connector cycle at ${connectorName}`, input.depth, "cycle");
    }

    const def = connectorRegistry[connectorName];
    if (!def) {
      return createOpenSlotPlaceholder(connectorName, input.depth, "missing");
    }

    const connectorId = `connector-${connectorName}-${createId(idFactory)}`;
    const connectorRiPosition = riPositionCursor;
    riPositionCursor += 1;
    const connectorStaticRi = cloneStaticRiMap(def.staticRi);
    const connectorSelfStaticRi = resolvedStaticByPosition.get(connectorRiPosition) ?? null;
    const connectorNode: ConnectorTreeNode = {
      id: connectorId,
      type: "connector",
      draggable: true,
      position: { x: origin.x, y: origin.y + input.depth * fallbackVerticalSpacing },
      data: {
        label: labelForConnector(connectorName),
        kind: "connector",
        dimensions: def.dimensions.length,
        connectorRows: def.dimensions.map((dimension, dimIndex) => ({
          dimension: dimIndex + 1,
          transformations: dimension.transformations.map((transformation) =>
            formatTransformationPreviewLabel(transformation.name, transformation.args),
          ),
        })),
        conditionLabel: def.conditionName ? def.conditionName : null,
        boundKind: input.boundDescriptor?.kind ?? null,
        boundSlotLabel: input.boundDescriptor?.slotLabel ?? null,
        boundOwnerName: input.boundDescriptor?.ownerConnectorName ?? null,
        sourceId: `feature-${connectorName}`,
        networkId: connectorName,
        fromNetwork: true,
        tabRoot: options.markRootAsTabRoot === false ? false : input.depth === 0,
        hideOutlets: false,
        riPosition: connectorRiPosition,
        riStart: connectorSelfStaticRi?.startPoint ?? 0,
        riShift: connectorSelfStaticRi?.transformationShift ?? 0,
        riLocked: Boolean(connectorSelfStaticRi),
        staticRi: connectorStaticRi,
      },
    };
    graphNodes.push(connectorNode);
    treeInfo.set(connectorId, { depth: input.depth, children: [] });

    if (def.conditionName) {
      const conditionNodeId = `condition-${connectorName}-${createId(idFactory)}`;
      graphNodes.push({
        id: conditionNodeId,
        type: "condition",
        draggable: true,
        position: { x: origin.x, y: origin.y + input.depth * fallbackVerticalSpacing - 120 },
        data: {
          label: def.conditionName,
          kind: "condition",
          networkId: def.conditionName,
          fromNetwork: true,
        },
      });
      conditionParentById.set(conditionNodeId, connectorId);
      pushEdge(conditionNodeId, "out", connectorId, "in");
    }

    const nextVisiting = new Set(visiting);
    nextVisiting.add(connectorName);
    let openSlotId = 0;

    for (let dimId = 0; dimId < def.dimensions.length; dimId += 1) {
      const dimension = def.dimensions[dimId];
      const dimNode = createDimensionNode(idFactory, connectorNode, dimId, def.dimensions.length);
      dimNode.data = {
        ...dimNode.data,
        transformations: dimension.transformations.map((transformation) =>
          createTransformationInstance(
            idFactory,
            transformation.name,
            transformation.args,
            "network",
          ),
        ),
      };
      graphNodes.push(dimNode);
      pushEdge(connectorId, `dim-${dimId}`, dimNode.id, "in");

      if (!dimension.composite) {
        const replacement = input.incomingBindings.get(openSlotId) ?? null;
        if (replacement) {
          const slotLabel =
            replacement.kind === "forwarded"
              ? `slot ${openSlotId} (from slot ${replacement.fromSlot})`
              : `slot ${openSlotId}`;
          const childId = expandConnector(
            {
              connectorName: replacement.targetName,
              incomingBindings: cloneIncomingBindingMap(replacement.forwarded),
              depth: input.depth + 1,
              boundDescriptor: {
                kind: replacement.kind,
                slotLabel,
                ownerConnectorName: replacement.ownerConnectorName,
              },
            },
            nextVisiting,
          );
          treeInfo.get(connectorId)?.children.push(childId);
          pushEdge(connectorId, `dim-${dimId}`, childId, "in", {
            kind: "binding",
            label: `binding · slot ${openSlotId}`,
            bindingOwnerName: replacement.ownerConnectorName,
            bindingSlot: openSlotId,
          });
        } else {
          // Mirror backend DFS RI indexing: each unbound terminal slot consumes one position.
          riPositionCursor += 1;
        }

        openSlotId += 1;
        continue;
      }

      const childOpenSlots = computeConnectorOpenSlotsInRegistry(
        connectorRegistry,
        dimension.composite,
        openSlotCache,
        new Set(nextVisiting),
        { tolerant: true },
      );
      const staticTargetsByChildSlot = new Map<number, string>();
      getSortedCanonicalBindingEntries(dimension.bindings ?? {}).forEach(
        ({ slotId, targetName }) => {
          if (slotId >= childOpenSlots || staticTargetsByChildSlot.has(slotId)) return;
          staticTargetsByChildSlot.set(slotId, targetName);
        },
      );

      const slotProjectedStarts = new Array(childOpenSlots).fill(0);
      const slotProjectedWidths = new Array(childOpenSlots).fill(0);
      const slotStaticTargets = new Array<string>(childOpenSlots).fill("");
      const slotSelectedBindings = new Array<IncomingBindingDescriptor | null>(childOpenSlots).fill(
        null,
      );
      const slotForwardedInternalBindings = Array.from(
        { length: childOpenSlots },
        () => new Map<number, IncomingBindingDescriptor>(),
      );
      let childOpenSlotsInParent = 0;

      for (let childSlotId = 0; childSlotId < childOpenSlots; childSlotId += 1) {
        slotProjectedStarts[childSlotId] = childOpenSlotsInParent;
        const staticTarget = staticTargetsByChildSlot.get(childSlotId);
        if (staticTarget) {
          const staticTargetOpenSlots = computeConnectorOpenSlotsInRegistry(
            connectorRegistry,
            staticTarget,
            openSlotCache,
            new Set(nextVisiting),
            { tolerant: true },
          );
          slotStaticTargets[childSlotId] = staticTarget;
          slotSelectedBindings[childSlotId] = {
            targetName: staticTarget,
            kind: "static",
            fromSlot: childSlotId,
            ownerConnectorName: connectorName,
            forwarded: new Map<number, IncomingBindingDescriptor>(),
          };
          slotProjectedWidths[childSlotId] = staticTargetOpenSlots;
          childOpenSlotsInParent += staticTargetOpenSlots;
          continue;
        }
        slotProjectedWidths[childSlotId] = 1;
        childOpenSlotsInParent += 1;
      }

      for (const [parentSlotId, parentBinding] of getSortedIncomingBindingEntries(
        input.incomingBindings,
      )) {
        if (parentSlotId < openSlotId) continue;
        const localSlotId = parentSlotId - openSlotId;
        if (localSlotId >= childOpenSlotsInParent) continue;

        for (let childSlotId = 0; childSlotId < childOpenSlots; childSlotId += 1) {
          const rangeStart = slotProjectedStarts[childSlotId];
          const rangeWidth = slotProjectedWidths[childSlotId];
          if (rangeWidth <= 0) continue;
          const rangeEndExclusive = rangeStart + rangeWidth;
          if (localSlotId < rangeStart || localSlotId >= rangeEndExclusive) continue;

          const staticTarget = slotStaticTargets[childSlotId];
          if (!staticTarget) {
            const forwardedBinding = cloneIncomingBindingAsForwarded(parentBinding, parentSlotId);
            if (forwardedBinding) slotSelectedBindings[childSlotId] = forwardedBinding;
            break;
          }

          const offset = localSlotId - rangeStart;
          const forwardedInternal = cloneIncomingBindingAsForwarded(parentBinding, parentSlotId);
          if (forwardedInternal) {
            slotForwardedInternalBindings[childSlotId].set(offset, forwardedInternal);
          }
          break;
        }
      }

      const childBindings = new Map<number, IncomingBindingDescriptor>();
      for (let childSlotId = 0; childSlotId < childOpenSlots; childSlotId += 1) {
        const selectedBinding = slotSelectedBindings[childSlotId];
        if (!selectedBinding) continue;
        const finalized = cloneIncomingBindingDescriptor(selectedBinding, childSlotId);
        if (!finalized) continue;
        if (slotStaticTargets[childSlotId]) {
          finalized.forwarded = cloneIncomingBindingMap(slotForwardedInternalBindings[childSlotId]);
        }
        childBindings.set(childSlotId, finalized);
      }

      const compositeChildId = expandConnector(
        {
          connectorName: dimension.composite,
          incomingBindings: childBindings,
          depth: input.depth + 1,
          boundDescriptor: null,
        },
        nextVisiting,
      );
      treeInfo.get(connectorId)?.children.push(compositeChildId);
      pushEdge(connectorId, `dim-${dimId}`, compositeChildId, "in", {
        kind: "composite",
        label: `composite · D${dimId + 1}`,
      });

      openSlotId += childOpenSlotsInParent;
    }

    return connectorId;
  };

  const rootId = expandConnector({
    connectorName: rootConnectorName,
    incomingBindings: new Map<number, IncomingBindingDescriptor>(),
    depth: 0,
    boundDescriptor: null,
  });

  const xByNodeId = new Map<string, number>();
  const computeTreeX = (nodeId: string): number => {
    const existing = xByNodeId.get(nodeId);
    if (typeof existing === "number") return existing;
    const info = treeInfo.get(nodeId);
    if (!info || info.children.length === 0) {
      const x = origin.x + leafCursor * horizontalSpacing;
      leafCursor += 1;
      xByNodeId.set(nodeId, x);
      return x;
    }
    const childrenX = info.children.map((childId) => computeTreeX(childId));
    const x = childrenX.reduce((sum, item) => sum + item, 0) / childrenX.length;
    xByNodeId.set(nodeId, x);
    return x;
  };

  const rootX = computeTreeX(rootId);
  const xShift = origin.x - rootX;

  const minLevelGap = 390;
  const levelSortedNodeIds = Array.from(treeInfo.entries())
    .map(([nodeId, info]) => ({ nodeId, depth: info.depth }))
    .sort(
      (a, b) =>
        a.depth - b.depth || (xByNodeId.get(a.nodeId) ?? 0) - (xByNodeId.get(b.nodeId) ?? 0),
    );
  let currentDepth: number | null = null;
  let previousX = 0;
  levelSortedNodeIds.forEach(({ nodeId, depth }) => {
    if (currentDepth !== depth) {
      currentDepth = depth;
      previousX = -Infinity;
    }
    const currentX = xByNodeId.get(nodeId) ?? 0;
    const nextX = Number.isFinite(previousX)
      ? Math.max(currentX, previousX + minLevelGap)
      : currentX;
    xByNodeId.set(nodeId, nextX);
    previousX = nextX;
  });

  const connectorPositionById = new Map<string, { x: number; y: number }>();
  const graphNodeById = new Map<string, ConnectorTreeNode>();
  graphNodes.forEach((node) => graphNodeById.set(node.id, node));

  const rowHeightByDepth = new Map<number, number>();
  treeInfo.forEach((info, nodeId) => {
    const node = graphNodeById.get(nodeId);
    if (!node) return;
    rowHeightByDepth.set(
      info.depth,
      Math.max(rowHeightByDepth.get(info.depth) ?? 0, estimateConnectorTreeNodeHeight(node)),
    );
  });

  const rowYByDepth = new Map<number, number>();
  const maxDepth = Math.max(0, ...Array.from(rowHeightByDepth.keys()));
  const rowGap = 140;
  let cursorY = origin.y;
  for (let depth = 0; depth <= maxDepth; depth += 1) {
    rowYByDepth.set(depth, cursorY);
    cursorY += (rowHeightByDepth.get(depth) ?? 190) + rowGap;
  }

  graphNodes.forEach((node) => {
    const info = treeInfo.get(node.id);
    if (info) {
      const x = (xByNodeId.get(node.id) ?? origin.x) + xShift;
      const y = rowYByDepth.get(info.depth) ?? origin.y + info.depth * fallbackVerticalSpacing;
      node.position = { x, y };
      if (node.data.kind === "connector") {
        connectorPositionById.set(node.id, { x, y });
      }
    }
  });

  graphNodes.forEach((node) => {
    if (node.data.kind !== "dimension") return;
    const parentId = node.data.parentFeatureId ?? "";
    const parentPos = connectorPositionById.get(parentId);
    if (!parentPos) return;
    const parent = graphNodes.find((candidate) => candidate.id === parentId);
    const dimensions = Math.max(1, Math.round(parent?.data.dimensions ?? 1));
    const dimIndex = Math.max(0, Math.round(node.data.dimensionIndex ?? 0));
    const spacing = 200;
    const startX = parentPos.x - ((dimensions - 1) * spacing) / 2;
    node.position = {
      x: startX + dimIndex * spacing,
      y: parentPos.y + 160,
    };
  });

  conditionParentById.forEach((parentId, conditionId) => {
    const parentPos = connectorPositionById.get(parentId);
    const conditionNode = graphNodes.find((candidate) => candidate.id === conditionId);
    if (!parentPos || !conditionNode) return;
    conditionNode.position = {
      x: parentPos.x,
      y: parentPos.y - 120,
    };
  });

  graphNodes.forEach((node) => {
    if (node.data.kind !== "connector" || !node.data.fromNetwork) return;
    const info = treeInfo.get(node.id);
    if (!info) return;
    const hasRenderableChild = info.children.some((childId) => graphNodeById.has(childId));
    node.data = {
      ...node.data,
      hideOutlets: options.hideReadOnlyLeafOutlets === false ? false : !hasRenderableChild,
    };
  });

  return { rootConnectorName, nodes: graphNodes, edges: graphEdges };
};
