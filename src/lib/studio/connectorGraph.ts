import type { Edge } from "@xyflow/svelte";

import type { StudioRunningInstanceRef } from "./domain/connectorModel";

export type ConnectorEdgeRelation = "composite" | "binding" | "unknown";

export const toInt = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return undefined;
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  return Math.max(0, Math.trunc(num));
};

export const toCanonicalPositionKey = (
  value: number | string | null | undefined,
): string | null => {
  if (value === null || value === undefined) return null;
  const asNumber = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(asNumber) || asNumber < 0) return null;
  return String(asNumber);
};

export const parseConnectorEdgeRelation = (edge: Edge): ConnectorEdgeRelation => {
  if (edge.data && typeof edge.data === "object") {
    const relation = (edge.data as { relation?: unknown; kind?: unknown }).relation;
    if (relation === "composite" || relation === "binding") return relation;
    const kind = (edge.data as { relation?: unknown; kind?: unknown }).kind;
    if (kind === "composite" || kind === "binding") return kind;
  }
  const label = typeof edge.label === "string" ? edge.label.trim().toLowerCase() : "";
  if (label.startsWith("composite")) return "composite";
  if (label.startsWith("binding")) return "binding";
  return "unknown";
};

export const parseConnectorEdgeBindingSlot = (edge: Edge): number | null => {
  if (edge.data && typeof edge.data === "object") {
    const slot = (edge.data as { bindingSlot?: unknown; binding_slot?: unknown; slot?: unknown })
      .bindingSlot;
    if (Number.isInteger(slot) && Number(slot) >= 0) return Number(slot);
    const alt = (edge.data as { bindingSlot?: unknown; binding_slot?: unknown; slot?: unknown })
      .binding_slot;
    if (Number.isInteger(alt) && Number(alt) >= 0) return Number(alt);
    const legacy = (
      edge.data as {
        bindingSlot?: unknown;
        binding_slot?: unknown;
        slot?: unknown;
      }
    ).slot;
    if (Number.isInteger(legacy) && Number(legacy) >= 0) return Number(legacy);
  }
  const label = typeof edge.label === "string" ? edge.label : "";
  const match = label.match(/slot\s+(\d+)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

export const cloneStaticRiMap = (
  input: Record<string, StudioRunningInstanceRef> | null | undefined,
): Record<string, StudioRunningInstanceRef> => {
  if (!input || typeof input !== "object") return {};
  const normalizedEntries = Object.entries(input)
    .map(([rawKey, value]) => {
      const key = toCanonicalPositionKey(rawKey);
      if (!key || !value || typeof value !== "object") return null;
      const startPoint = toInt(value.startPoint) ?? 0;
      const transformationShift = toInt(value.transformationShift) ?? 0;
      return [key, { startPoint, transformationShift }] as const;
    })
    .filter((entry): entry is readonly [string, StudioRunningInstanceRef] => Boolean(entry))
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  return Object.fromEntries(normalizedEntries);
};

export const parseStaticRiPayload = (input: unknown): Record<string, StudioRunningInstanceRef> => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, StudioRunningInstanceRef> = {};
  Object.entries(input as Record<string, unknown>).forEach(([rawKey, rawValue]) => {
    const key = toCanonicalPositionKey(rawKey);
    if (!key || !rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) return;
    const value = rawValue as Record<string, unknown>;
    const startPoint = toInt(value.start_point as number | string | null | undefined);
    const transformationShift = toInt(
      value.transformation_shift as number | string | null | undefined,
    );
    const startPointAlt = toInt(value.startPoint as number | string | null | undefined);
    const transformationShiftAlt = toInt(
      value.transformationShift as number | string | null | undefined,
    );
    out[key] = {
      startPoint: startPoint ?? startPointAlt ?? 0,
      transformationShift: transformationShift ?? transformationShiftAlt ?? 0,
    };
  });
  return cloneStaticRiMap(out);
};

export const resolveConnectorSelfStaticRi = (
  staticRiInput: Record<string, StudioRunningInstanceRef> | null | undefined,
  absolutePosition?: number | null,
): StudioRunningInstanceRef | null => {
  const staticRi = cloneStaticRiMap(staticRiInput);
  if (!Object.keys(staticRi).length) return null;

  if (staticRi["0"]) return staticRi["0"];
  const absoluteKey = toCanonicalPositionKey(absolutePosition ?? null);
  if (absoluteKey === "0" && staticRi[absoluteKey]) return staticRi[absoluteKey];
  return null;
};
