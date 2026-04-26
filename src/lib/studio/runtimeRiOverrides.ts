import { toInt } from "./connectorGraph";

export type RuntimeRiOverrideData = {
  kind?: unknown;
  riStart?: unknown;
  riShift?: unknown;
  riLocked?: unknown;
};

export type RuntimeRiOverrideNode<TData extends RuntimeRiOverrideData = RuntimeRiOverrideData> = {
  data: TData;
} & Record<string, unknown>;

const supportsRuntimeRiOverrides = (kind: unknown) =>
  kind === "connector" || kind === "feature" || kind === "dimension";

export const mergeRuntimeRiOverridesIntoProjectedNode = <TNode extends RuntimeRiOverrideNode>(
  projectedNode: TNode,
  overlayNode: RuntimeRiOverrideNode,
): TNode => {
  if (!supportsRuntimeRiOverrides(projectedNode.data.kind)) return projectedNode;

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
