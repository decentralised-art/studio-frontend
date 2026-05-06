import { normalizeChainExecutePayload } from "$lib/chain/executePayloadContract";
import type {
  StudioConnectorDef,
  StudioRunningInstanceRef,
} from "$lib/studio/domain/connectorModel";
import { computeRiPositioning, type RiPositioningResult } from "$lib/studio/riPositioning";

export type ExecuteRiValue = {
  startPoint: number;
  transformationShift: number;
};

export type ExecuteRiStaticResolvedEntry = ExecuteRiValue & {
  position: number;
  localPosition: number;
  connectorName: string;
  nodeKey: string;
  depth: number;
};

export type ExecuteRiBlockedOverride = {
  position: number;
  connectorName: string;
  nodeKey: string;
  attempted: ExecuteRiValue;
  locked: ExecuteRiValue;
  lockedByConnector: string;
};

export type ExecuteRiPlan = {
  positioning: RiPositioningResult;
  dynamicRi: Record<string, { start_point: number; transformation_shift: number }>;
  staticRiByPosition: Record<string, ExecuteRiStaticResolvedEntry>;
  blockedOverrides: ExecuteRiBlockedOverride[];
  warnings: string[];
};

export type ExecuteNodeOverrides = Record<string, Partial<ExecuteRiValue> | undefined>;

export const buildExecutePlanConnectorRegistry = (input: {
  runtimeConnectors: Record<string, StudioConnectorDef>;
  deployedConnectors: Record<string, StudioConnectorDef>;
  rootConnectorName: string;
}): Record<string, StudioConnectorDef> => {
  const rootName = input.rootConnectorName.trim();
  if (!rootName || !input.deployedConnectors[rootName]) return input.runtimeConnectors;

  // /execute always runs the deployed root connector. When that root is already
  // on-chain, RI planning must use the deployed definitions/static_ri map so the
  // frontend does not send dynamic_ri for positions the contract marks static.
  return {
    ...input.runtimeConnectors,
    ...input.deployedConnectors,
  };
};

const UINT32_MAX = 0xffff_ffff;
const clampUint32 = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const integer = Math.trunc(parsed);
  if (integer < 0) return 0;
  if (integer > UINT32_MAX) return UINT32_MAX;
  return integer;
};

const toInt = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return undefined;
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  return Math.max(0, Math.trunc(num));
};

const toCanonicalPositionKey = (value: number | string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  const asNumber = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(asNumber) || asNumber < 0) return null;
  return String(asNumber);
};

const toExecuteRiValue = (
  input: Partial<ExecuteRiValue> | StudioRunningInstanceRef | null | undefined,
  fallback: ExecuteRiValue = { startPoint: 0, transformationShift: 0 },
): ExecuteRiValue => ({
  startPoint: toInt(input?.startPoint) ?? fallback.startPoint,
  transformationShift: toInt(input?.transformationShift) ?? fallback.transformationShift,
});

const resolveStaticRiPositions = (
  connectors: Record<string, StudioConnectorDef>,
  positioning: RiPositioningResult,
): {
  staticByPosition: Map<number, ExecuteRiStaticResolvedEntry>;
  warnings: string[];
} => {
  const warnings: string[] = [];

  const staticByPosition = new Map<number, ExecuteRiStaticResolvedEntry>();
  const sortedNodes = [...positioning.nodes].sort(
    (a, b) => b.depth - a.depth || a.position - b.position,
  );
  sortedNodes.forEach((node) => {
    const connector = connectors[node.connectorName];
    const staticRi = connector?.staticRi;
    if (!staticRi) return;
    const isRootNode = node.relation === "root";
    const nestedDimensionPositionsMax = connector.dimensions.length;
    Object.entries(staticRi).forEach(([rawLocalPosition, rawValue]) => {
      const canonical = toCanonicalPositionKey(rawLocalPosition);
      const localPosition = canonical === null ? Number.NaN : Number(canonical);
      if (!Number.isInteger(localPosition) || localPosition < 0) {
        warnings.push(
          `Invalid static_ri key '${rawLocalPosition}' on connector '${connector.name}' (must be canonical non-negative integer).`,
        );
        return;
      }

      if (isRootNode) {
        if (localPosition >= node.subtreeSize) {
          warnings.push(
            `Ignoring static_ri position ${localPosition} on connector '${connector.name}' at node '${node.key}' (outside connector subtree in current DFS projection, size ${node.subtreeSize}).`,
          );
          return;
        }
      } else {
        // PT only applies nested connector static_ri to:
        // - key 0: child-root fallback (not an addressable DFS position)
        // - keys 1..dimensions.length: immediate local dimension positions
        if (localPosition === 0) {
          return;
        }
        if (localPosition > nestedDimensionPositionsMax) {
          warnings.push(
            `Ignoring nested static_ri position ${localPosition} on connector '${connector.name}' at node '${node.key}' (PT applies nested static_ri only to immediate local dimensions 1..${nestedDimensionPositionsMax}; position 0 remains child-root fallback).`,
          );
          return;
        }
      }

      const position = node.position + localPosition;
      const value = toExecuteRiValue(rawValue);
      const existing = staticByPosition.get(position);
      if (existing && existing.depth > node.depth) {
        warnings.push(
          `Static RI collision at position ${position}: '${connector.name}' was ignored because deeper connector '${existing.connectorName}' already defines it.`,
        );
        return;
      }
      if (existing && existing.depth === node.depth) {
        warnings.push(
          `Static RI collision at position ${position}: '${connector.name}' overrides '${existing.connectorName}' at equal depth.`,
        );
      }
      staticByPosition.set(position, {
        ...value,
        position,
        localPosition,
        connectorName: connector.name,
        nodeKey: node.key,
        depth: node.depth,
      });
    });
  });

  return { staticByPosition, warnings };
};

export const buildExecuteRiPlan = (
  connectors: Record<string, StudioConnectorDef>,
  rootConnectorName: string,
  overridesByPosition: ExecuteNodeOverrides = {},
): ExecuteRiPlan =>
  buildExecuteRiPlanFromPositioning(
    connectors,
    computeRiPositioning(connectors, rootConnectorName),
    overridesByPosition,
  );

export const buildExecuteRiPlanFromPositioning = (
  connectors: Record<string, StudioConnectorDef>,
  positioning: RiPositioningResult,
  overridesByPosition: ExecuteNodeOverrides = {},
): ExecuteRiPlan => {
  const warnings: string[] = [];

  const { staticByPosition, warnings: staticWarnings } = resolveStaticRiPositions(
    connectors,
    positioning,
  );
  warnings.push(...staticWarnings);

  const nodeByPosition = new Map<number, { connectorName: string; nodeKey: string }>();
  positioning.nodes.forEach((nodePos) => {
    nodeByPosition.set(nodePos.position, {
      connectorName: nodePos.connectorName,
      nodeKey: nodePos.key,
    });
  });
  positioning.dimensions.forEach((dimensionPos) => {
    if (nodeByPosition.has(dimensionPos.position)) return;
    nodeByPosition.set(dimensionPos.position, {
      connectorName: dimensionPos.connectorName,
      nodeKey: dimensionPos.nodeKey,
    });
  });

  const candidateByPosition = new Map<
    number,
    {
      value: ExecuteRiValue;
      connectorName: string;
      nodeKey: string;
    }
  >();

  Object.entries(overridesByPosition).forEach(([rawKey, override]) => {
    const key = toCanonicalPositionKey(rawKey);
    if (key === null || !override) return;
    const position = Number(key);
    const node = nodeByPosition.get(position);
    if (!node) {
      warnings.push(`Ignoring RI override for unknown position ${position}.`);
      return;
    }
    candidateByPosition.set(position, {
      value: toExecuteRiValue(override),
      connectorName: node.connectorName,
      nodeKey: node.nodeKey,
    });
  });

  const blockedOverrides: ExecuteRiBlockedOverride[] = [];
  const dynamicRi = Object.fromEntries(
    Array.from(candidateByPosition.entries())
      .sort((a, b) => a[0] - b[0])
      .flatMap(([position, candidate]) => {
        const locked = staticByPosition.get(position);
        if (locked) {
          const hasExplicitMismatch =
            candidate.value.startPoint !== locked.startPoint ||
            candidate.value.transformationShift !== locked.transformationShift;
          if (hasExplicitMismatch) {
            blockedOverrides.push({
              position,
              connectorName: candidate.connectorName,
              nodeKey: candidate.nodeKey,
              attempted: candidate.value,
              locked: {
                startPoint: locked.startPoint,
                transformationShift: locked.transformationShift,
              },
              lockedByConnector: locked.connectorName,
            });
          }
          return [];
        }

        return [
          [
            String(position),
            {
              start_point: candidate.value.startPoint,
              transformation_shift: candidate.value.transformationShift,
            },
          ] as const,
        ];
      }),
  );

  if (blockedOverrides.length > 0) {
    warnings.push(
      `Ignored ${blockedOverrides.length} dynamic RI override(s) because those positions are static_ri-locked.`,
    );
  }

  return {
    positioning,
    dynamicRi,
    staticRiByPosition: Object.fromEntries(
      Array.from(staticByPosition.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([position, entry]) => [String(position), entry]),
    ),
    blockedOverrides,
    warnings,
  };
};

export const formatExecuteRiSummary = (plan: ExecuteRiPlan) =>
  `RI plan · total ${plan.positioning.totalPositions} · dynamic ${Object.keys(plan.dynamicRi).length} · static ${Object.keys(plan.staticRiByPosition).length} · blocked ${plan.blockedOverrides.length}`;

export const buildExecuteRequestBody = (input: {
  connectorName: string;
  particlesCount: number;
  riPlan: ExecuteRiPlan;
}) => {
  const dynamicRi = Object.fromEntries(
    Object.entries(input.riPlan.dynamicRi).map(([position, value]) => [
      position,
      {
        start_point: clampUint32(value.start_point, 0),
        transformation_shift: clampUint32(value.transformation_shift, 0),
      },
    ]),
  );

  return normalizeChainExecutePayload({
    connector_name: input.connectorName,
    particles_count: String(clampUint32(Math.max(1, Math.trunc(input.particlesCount)), 1)),
    dynamic_ri: dynamicRi,
  });
};
