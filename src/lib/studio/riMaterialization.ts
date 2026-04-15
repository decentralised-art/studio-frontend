import type { StudioRunningInstanceRef } from "./domain/connectorModel";

export type RiMaterializationCandidate = {
  fromNetwork: boolean;
  riLocked: boolean;
  riPosition?: number | null;
  riStart?: number | null;
  riShift?: number | null;
  lockToggleDisabled: boolean;
};

export type RiMaterializationResult = {
  staticRi: Record<string, StudioRunningInstanceRef>;
  materializedPositions: number[];
  materializedSnapshot: Record<string, StudioRunningInstanceRef>;
  changed: boolean;
};

const toNonNegativeInt = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const next = Number(value);
  if (!Number.isFinite(next)) return null;
  const truncated = Math.trunc(next);
  return truncated < 0 ? 0 : truncated;
};

const toPositionKey = (value: number | string | null | undefined): string | null => {
  const asInt = toNonNegativeInt(value);
  if (asInt === null) return null;
  return String(asInt);
};

const cloneStaticRi = (
  input: Record<string, StudioRunningInstanceRef> | null | undefined,
): Record<string, StudioRunningInstanceRef> => {
  if (!input) return {};
  const out: Record<string, StudioRunningInstanceRef> = {};
  Object.entries(input).forEach(([rawKey, rawValue]) => {
    const key = toPositionKey(rawKey);
    if (!key || !rawValue) return;
    out[key] = {
      startPoint: toNonNegativeInt(rawValue.startPoint) ?? 0,
      transformationShift: toNonNegativeInt(rawValue.transformationShift) ?? 0,
    };
  });
  return out;
};

const normalizeTrackedPositions = (input: number[] | null | undefined): number[] => {
  if (!Array.isArray(input)) return [];
  const normalized = input
    .map((value) => toNonNegativeInt(value))
    .filter((value): value is number => Number.isInteger(value))
    .sort((a, b) => a - b);
  return Array.from(new Set(normalized));
};

const equalStaticRiMaps = (
  left: Record<string, StudioRunningInstanceRef>,
  right: Record<string, StudioRunningInstanceRef>,
): boolean => {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;

  for (let i = 0; i < leftKeys.length; i += 1) {
    const leftKey = leftKeys[i];
    const rightKey = rightKeys[i];
    if (leftKey !== rightKey) return false;
    const leftEntry = left[leftKey];
    const rightEntry = right[rightKey];
    if (
      (toNonNegativeInt(leftEntry?.startPoint) ?? 0) !==
        (toNonNegativeInt(rightEntry?.startPoint) ?? 0) ||
      (toNonNegativeInt(leftEntry?.transformationShift) ?? 0) !==
        (toNonNegativeInt(rightEntry?.transformationShift) ?? 0)
    ) {
      return false;
    }
  }

  return true;
};

/**
 * Merge deploy-time materialized static RI entries into root static_ri.
 *
 * Only referenced on-chain connectors that were user-lockable and currently locked
 * are materialized here. Immutable locks (view-only/self-static) are excluded.
 */
export const materializeReferencedRiIntoRootStatic = (
  rootStaticRiInput: Record<string, StudioRunningInstanceRef> | null | undefined,
  previousMaterializedPositionsInput: number[] | null | undefined,
  previousMaterializedSnapshotInput: Record<string, StudioRunningInstanceRef> | null | undefined,
  candidates: RiMaterializationCandidate[],
): RiMaterializationResult => {
  const initialRootStatic = cloneStaticRi(rootStaticRiInput);
  const previousMaterializedSnapshot = cloneStaticRi(previousMaterializedSnapshotInput);
  const previousMaterializedPositions = normalizeTrackedPositions(
    previousMaterializedPositionsInput,
  );
  const nextMaterializedByPosition = new Map<string, StudioRunningInstanceRef>();

  candidates.forEach((candidate) => {
    if (!candidate.fromNetwork || !candidate.riLocked || candidate.lockToggleDisabled) return;
    const positionKey = toPositionKey(candidate.riPosition ?? null);
    if (!positionKey) return;
    nextMaterializedByPosition.set(positionKey, {
      startPoint: toNonNegativeInt(candidate.riStart) ?? 0,
      transformationShift: toNonNegativeInt(candidate.riShift) ?? 0,
    });
  });

  const nextMaterializedPositions = Array.from(nextMaterializedByPosition.keys())
    .map((key) => Number(key))
    .filter((value) => Number.isInteger(value) && value >= 0)
    .sort((a, b) => a - b);
  const nextMaterializedSnapshot = Object.fromEntries(nextMaterializedByPosition);

  const nextRootStatic = cloneStaticRi(rootStaticRiInput);

  previousMaterializedPositions.forEach((position) => {
    const key = String(position);
    if (!(key in nextRootStatic)) return;
    const previousMaterializedValue = previousMaterializedSnapshot[key];
    if (previousMaterializedValue) {
      const stillMatchesMaterialized =
        (toNonNegativeInt(nextRootStatic[key]?.startPoint) ?? 0) ===
          (toNonNegativeInt(previousMaterializedValue.startPoint) ?? 0) &&
        (toNonNegativeInt(nextRootStatic[key]?.transformationShift) ?? 0) ===
          (toNonNegativeInt(previousMaterializedValue.transformationShift) ?? 0);
      if (!stillMatchesMaterialized) return;
    }
    delete nextRootStatic[key];
  });

  nextMaterializedByPosition.forEach((value, key) => {
    const existing = nextRootStatic[key];
    if (
      existing &&
      (toNonNegativeInt(existing.startPoint) ?? 0) === value.startPoint &&
      (toNonNegativeInt(existing.transformationShift) ?? 0) === value.transformationShift
    ) {
      return;
    }
    nextRootStatic[key] = value;
  });

  const trackedPositionsChanged =
    previousMaterializedPositions.length !== nextMaterializedPositions.length ||
    previousMaterializedPositions.some(
      (value, index) => value !== nextMaterializedPositions[index],
    );
  const staticChanged = !equalStaticRiMaps(initialRootStatic, nextRootStatic);
  const snapshotChanged = !equalStaticRiMaps(
    previousMaterializedSnapshot,
    nextMaterializedSnapshot,
  );

  return {
    staticRi: nextRootStatic,
    materializedPositions: nextMaterializedPositions,
    materializedSnapshot: nextMaterializedSnapshot,
    changed: staticChanged || trackedPositionsChanged || snapshotChanged,
  };
};
