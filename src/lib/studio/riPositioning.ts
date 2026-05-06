import type { StudioConnectorDef } from "$lib/studio/domain/connectorModel";
import { normalizeBindingsMap } from "$lib/studio/domain/slotProjection";

type RiBindingDescriptor = {
  targetName: string;
  kind: "static" | "forwarded";
  fromSlot: number;
  forwarded: Map<number, RiBindingDescriptor>;
};

export type RiConnectorNodePosition = {
  key: string;
  connectorName: string;
  depth: number;
  position: number;
  subtreeSize: number;
  relation: "root" | "composite" | "binding";
  parentKey: string | null;
  parentDimensionIndex: number | null;
  parentSlot: number | null;
  bindingKind: "static" | "forwarded" | null;
};

export type RiDimensionPosition = {
  key: string;
  nodeKey: string;
  connectorName: string;
  depth: number;
  dimensionIndex: number;
  position: number;
};

export type RiPositioningResult = {
  rootConnectorName: string;
  totalPositions: number;
  nodes: RiConnectorNodePosition[];
  dimensions: RiDimensionPosition[];
  nodePositionByKey: Record<string, number>;
  dimensionPositionByKey: Record<string, number>;
  dimensionsByConnector: Record<string, RiDimensionPosition[]>;
};

const cloneIncomingBindingMap = (bindings: Map<number, RiBindingDescriptor> | null) => {
  const cloned = new Map<number, RiBindingDescriptor>();
  if (!(bindings instanceof Map)) return cloned;
  for (const [slotId, binding] of bindings.entries()) {
    if (!Number.isInteger(slotId) || slotId < 0) continue;
    const targetName = String(binding.targetName ?? "").trim();
    if (!targetName) continue;
    const fromSlot = Number.isInteger(binding.fromSlot) ? binding.fromSlot : slotId;
    cloned.set(slotId, {
      targetName,
      kind: binding.kind === "static" ? "static" : "forwarded",
      fromSlot,
      forwarded: cloneIncomingBindingMap(binding.forwarded),
    });
  }
  return cloned;
};

const cloneIncomingBindingDescriptor = (
  binding: RiBindingDescriptor | null | undefined,
  fallbackSlot = 0,
): RiBindingDescriptor | null => {
  if (!binding) return null;
  const targetName = String(binding.targetName ?? "").trim();
  if (!targetName) return null;
  return {
    targetName,
    kind: binding.kind === "static" ? "static" : "forwarded",
    fromSlot: Number.isInteger(binding.fromSlot) ? binding.fromSlot : fallbackSlot,
    forwarded: cloneIncomingBindingMap(binding.forwarded),
  };
};

const getSortedIncomingBindingEntries = (bindings: Map<number, RiBindingDescriptor>) =>
  Array.from(bindings.entries())
    .filter(([slotId, binding]) => Number.isInteger(slotId) && slotId >= 0 && Boolean(binding))
    .sort((lhs, rhs) => lhs[0] - rhs[0]);

const computeConnectorOpenSlots = (
  connectorName: string,
  connectors: Record<string, StudioConnectorDef>,
  cache = new Map<string, number>(),
  visiting = new Set<string>(),
): number => {
  if (cache.has(connectorName)) return cache.get(connectorName) ?? 0;
  if (visiting.has(connectorName)) {
    throw new Error(`RI positioning cycle detected at connector '${connectorName}'.`);
  }

  const connector = connectors[connectorName];
  if (!connector) {
    throw new Error(`RI positioning is missing connector '${connectorName}'.`);
  }

  visiting.add(connectorName);
  try {
    let openSlots = 0;
    connector.dimensions.forEach((dimension, dimIndex) => {
      if (!dimension.composite) {
        openSlots += 1;
        return;
      }

      const childOpenSlots = computeConnectorOpenSlots(
        dimension.composite,
        connectors,
        cache,
        visiting,
      );
      openSlots += childOpenSlots;

      const staticTargetsByChildSlot = new Map<number, string>();
      normalizeBindingsMap(dimension.bindings ?? {}).forEach((entry) => {
        if (entry.slotId >= childOpenSlots) {
          throw new Error(
            `Connector '${connectorName}' dimension ${dimIndex + 1} binding slot ${entry.slotId} is out of range; child '${dimension.composite}' exposes ${childOpenSlots} slot(s).`,
          );
        }
        if (staticTargetsByChildSlot.has(entry.slotId)) return;
        staticTargetsByChildSlot.set(entry.slotId, entry.targetConnector);
      });

      for (const targetName of staticTargetsByChildSlot.values()) {
        openSlots += computeConnectorOpenSlots(targetName, connectors, cache, visiting);
      }
      openSlots -= staticTargetsByChildSlot.size;
    });

    cache.set(connectorName, openSlots);
    return openSlots;
  } finally {
    visiting.delete(connectorName);
  }
};

type ExpandInput = {
  connectorName: string;
  incomingBindings: Map<number, RiBindingDescriptor>;
  depth: number;
  relation: "root" | "composite" | "binding";
  parentKey: string | null;
  parentDimensionIndex: number | null;
  parentSlot: number | null;
  bindingKind: "static" | "forwarded" | null;
  keyBase: string;
};

export const computeRiPositioning = (
  connectors: Record<string, StudioConnectorDef>,
  rootConnectorName: string,
): RiPositioningResult => {
  const rootName = rootConnectorName.trim();
  if (!rootName) {
    throw new Error("RI positioning requires a non-empty root connector name.");
  }
  if (!connectors[rootName]) {
    throw new Error(`RI positioning root connector '${rootName}' was not found.`);
  }

  let sequence = 0;
  let currentPosition = 0;
  const nodes: RiConnectorNodePosition[] = [];
  const dimensions: RiDimensionPosition[] = [];
  const openSlotCache = new Map<string, number>();

  const makeNodeKey = (base: string) => `${base}@${sequence++}`;

  const expandConnector = (input: ExpandInput, visiting = new Set<string>()): string => {
    const connectorName = input.connectorName.trim();
    if (!connectorName) {
      throw new Error("RI positioning encountered an empty connector reference.");
    }
    if (visiting.has(connectorName)) {
      const cyclePath = [...visiting, connectorName].join(" -> ");
      throw new Error(`RI positioning cycle detected: ${cyclePath}`);
    }

    const connector = connectors[connectorName];
    if (!connector) {
      throw new Error(`RI positioning is missing connector '${connectorName}'.`);
    }

    const nodeKey = makeNodeKey(input.keyBase);
    const nodePosition = currentPosition;
    currentPosition += 1;
    const node: RiConnectorNodePosition = {
      key: nodeKey,
      connectorName,
      depth: input.depth,
      position: nodePosition,
      subtreeSize: 1,
      relation: input.relation,
      parentKey: input.parentKey,
      parentDimensionIndex: input.parentDimensionIndex,
      parentSlot: input.parentSlot,
      bindingKind: input.bindingKind,
    };
    nodes.push(node);

    const nextVisiting = new Set(visiting);
    nextVisiting.add(connectorName);
    let openSlotId = 0;

    for (let dimIndex = 0; dimIndex < connector.dimensions.length; dimIndex += 1) {
      const dimension = connector.dimensions[dimIndex];
      const dimensionPosition = currentPosition;
      dimensions.push({
        key: `${nodeKey}/d${dimIndex + 1}`,
        nodeKey,
        connectorName,
        depth: input.depth,
        dimensionIndex: dimIndex,
        position: dimensionPosition,
      });

      if (!dimension.composite) {
        const replacement = input.incomingBindings.get(openSlotId) ?? null;
        if (replacement) {
          expandConnector(
            {
              connectorName: replacement.targetName,
              incomingBindings: cloneIncomingBindingMap(replacement.forwarded),
              depth: input.depth + 1,
              relation: "binding",
              parentKey: nodeKey,
              parentDimensionIndex: dimIndex,
              parentSlot: openSlotId,
              bindingKind: replacement.kind,
              keyBase: `${nodeKey}/slot-${openSlotId}:${replacement.kind}:${replacement.targetName}`,
            },
            nextVisiting,
          );
        } else {
          // Backend DFS RI indexing allocates a position for every terminal scalar slot.
          currentPosition += 1;
        }
        openSlotId += 1;
        continue;
      }

      const childOpenSlots = computeConnectorOpenSlots(
        dimension.composite,
        connectors,
        openSlotCache,
        new Set(nextVisiting),
      );
      const staticTargetsByChildSlot = new Map<number, string>();
      normalizeBindingsMap(dimension.bindings ?? {}).forEach((entry) => {
        if (entry.slotId >= childOpenSlots) {
          throw new Error(
            `Connector '${connectorName}' dimension ${dimIndex + 1} binding slot ${entry.slotId} is out of range; child '${dimension.composite}' exposes ${childOpenSlots} slot(s).`,
          );
        }
        if (staticTargetsByChildSlot.has(entry.slotId)) return;
        staticTargetsByChildSlot.set(entry.slotId, entry.targetConnector);
      });

      const slotProjectedStarts = new Array(childOpenSlots).fill(0);
      const slotProjectedWidths = new Array(childOpenSlots).fill(0);
      const slotStaticTargets = new Array<string>(childOpenSlots).fill("");
      const slotSelectedBindings = new Array<RiBindingDescriptor | null>(childOpenSlots).fill(null);
      const slotForwardedInternalBindings = Array.from(
        { length: childOpenSlots },
        () => new Map<number, RiBindingDescriptor>(),
      );
      let childOpenSlotsInParent = 0;

      for (let childSlotId = 0; childSlotId < childOpenSlots; childSlotId += 1) {
        slotProjectedStarts[childSlotId] = childOpenSlotsInParent;
        const staticTarget = staticTargetsByChildSlot.get(childSlotId);
        if (staticTarget) {
          const staticTargetOpenSlots = computeConnectorOpenSlots(
            staticTarget,
            connectors,
            openSlotCache,
            new Set(nextVisiting),
          );
          slotStaticTargets[childSlotId] = staticTarget;
          slotSelectedBindings[childSlotId] = {
            targetName: staticTarget,
            kind: "static",
            fromSlot: childSlotId,
            forwarded: new Map<number, RiBindingDescriptor>(),
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
            const propagatedBinding = cloneIncomingBindingDescriptor(parentBinding, parentSlotId);
            if (propagatedBinding) slotSelectedBindings[childSlotId] = propagatedBinding;
            break;
          }

          const offset = localSlotId - rangeStart;
          const forwardedInternal = cloneIncomingBindingDescriptor(parentBinding, parentSlotId);
          if (forwardedInternal) {
            slotForwardedInternalBindings[childSlotId].set(offset, forwardedInternal);
          }
          break;
        }
      }

      const childBindings = new Map<number, RiBindingDescriptor>();
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

      expandConnector(
        {
          connectorName: dimension.composite,
          incomingBindings: childBindings,
          depth: input.depth + 1,
          relation: "composite",
          parentKey: nodeKey,
          parentDimensionIndex: dimIndex,
          parentSlot: null,
          bindingKind: null,
          keyBase: `${nodeKey}/d${dimIndex + 1}:composite:${dimension.composite}`,
        },
        nextVisiting,
      );
      openSlotId += childOpenSlotsInParent;
    }

    node.subtreeSize = Math.max(1, currentPosition - nodePosition);
    return nodeKey;
  };

  expandConnector({
    connectorName: rootName,
    incomingBindings: new Map<number, RiBindingDescriptor>(),
    depth: 0,
    relation: "root",
    parentKey: null,
    parentDimensionIndex: null,
    parentSlot: null,
    bindingKind: null,
    keyBase: `root:${rootName}`,
  });

  const nodePositionByKey: Record<string, number> = {};
  nodes.forEach((node) => {
    nodePositionByKey[node.key] = node.position;
  });

  const dimensionPositionByKey: Record<string, number> = {};
  dimensions.forEach((dimension) => {
    dimensionPositionByKey[dimension.key] = dimension.position;
  });

  const dimensionsByConnector: Record<string, RiDimensionPosition[]> = {};
  dimensions.forEach((dimension) => {
    if (!dimensionsByConnector[dimension.connectorName]) {
      dimensionsByConnector[dimension.connectorName] = [];
    }
    dimensionsByConnector[dimension.connectorName].push(dimension);
  });

  return {
    rootConnectorName: rootName,
    totalPositions: currentPosition,
    nodes,
    dimensions,
    nodePositionByKey,
    dimensionPositionByKey,
    dimensionsByConnector,
  };
};
