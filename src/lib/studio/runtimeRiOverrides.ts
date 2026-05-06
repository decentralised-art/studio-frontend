import { toInt } from "./connectorGraph";

export type RuntimeRiOverrideData = {
  kind?: unknown;
  networkId?: unknown;
  riPosition?: unknown;
  riTargetPosition?: unknown;
  riStart?: unknown;
  riShift?: unknown;
  riLocked?: unknown;
};

export type RuntimeRiOverrideNode<TData extends RuntimeRiOverrideData = RuntimeRiOverrideData> = {
  data: TData;
} & Record<string, unknown>;

const supportsRuntimeRiOverrides = (kind: unknown) =>
  kind === "connector" || kind === "feature" || kind === "dimension";

const normalizeIdentity = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const normalizePosition = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(typeof value === "string" ? value.trim() : value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
};

const matchesProjectedIdentity = (
  projectedData: RuntimeRiOverrideData,
  overlayData: RuntimeRiOverrideData,
): boolean => {
  const projectedNetworkId = normalizeIdentity(projectedData.networkId);
  if (projectedNetworkId !== null) {
    const overlayNetworkId = normalizeIdentity(overlayData.networkId);
    if (overlayNetworkId !== projectedNetworkId) return false;
  }

  const projectedPosition = normalizePosition(projectedData.riPosition);
  if (projectedPosition !== null) {
    const overlayPosition = normalizePosition(overlayData.riPosition);
    if (overlayPosition !== projectedPosition) return false;
  }

  const projectedTargetPosition = normalizePosition(projectedData.riTargetPosition);
  const overlayTargetPosition = normalizePosition(overlayData.riTargetPosition);
  if (
    projectedTargetPosition !== null &&
    overlayTargetPosition !== null &&
    overlayTargetPosition !== projectedTargetPosition
  ) {
    return false;
  }

  return true;
};

export const mergeRuntimeRiOverridesIntoProjectedNode = <TNode extends RuntimeRiOverrideNode>(
  projectedNode: TNode,
  overlayNode: RuntimeRiOverrideNode,
): TNode => {
  if (!supportsRuntimeRiOverrides(projectedNode.data.kind)) return projectedNode;
  if (!matchesProjectedIdentity(projectedNode.data, overlayNode.data)) return projectedNode;

  const riStart = toInt(overlayNode.data.riStart as number | string | null | undefined);
  const riShift = toInt(overlayNode.data.riShift as number | string | null | undefined);
  const hasRiLocked = typeof overlayNode.data.riLocked === "boolean";

  if (riStart === undefined && riShift === undefined && !hasRiLocked) return projectedNode;

  return {
    ...projectedNode,
    data: {
      ...projectedNode.data,
      ...(riStart !== undefined ? { riStart } : {}),
      ...(riShift !== undefined ? { riShift } : {}),
      ...(hasRiLocked ? { riLocked: overlayNode.data.riLocked } : {}),
    },
  };
};
