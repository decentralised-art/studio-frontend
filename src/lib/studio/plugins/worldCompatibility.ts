import type { StudioPluginDescriptor } from "$lib/studio/plugins/registry";
import { connectorBindingValueKey, type ConnectorBindingValues } from "$lib/worlds/runtimeInput";
import type { WorldAcceptedConnectorSet } from "$lib/worlds/types";

export type StudioWorldConnectorTarget = {
  id: string;
  name: string;
};

export type StudioWorldConnectorBindingMatch = {
  slot: string;
  connectorName: string;
  optional?: boolean;
  targetId?: string;
};

export type StudioWorldConnectorSetMatch = {
  connectorSetIndex: number;
  connectorSet: WorldAcceptedConnectorSet;
  bindings: StudioWorldConnectorBindingMatch[];
  attachedTargetIds: string[];
  missingRequiredConnectors: string[];
};

export type StudioWorldConnectorSetSelection = {
  connectorSetIndex: number;
  connectorBindingValues: ConnectorBindingValues;
};

export type StudioWorldPluginCompatibility = {
  label: string;
  detail: string;
  kind: "standalone" | "format" | "connector-set" | "partial" | "unavailable";
  match: StudioWorldConnectorSetMatch | null;
};

const normalizeName = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const unique = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const trimmed = value.trim();
    const key = normalizeName(trimmed);
    if (!trimmed || seen.has(key)) return;
    seen.add(key);
    result.push(trimmed);
  });
  return result;
};

const findTargetByName = (
  targets: readonly StudioWorldConnectorTarget[],
  name: string,
): StudioWorldConnectorTarget | undefined => {
  const normalized = normalizeName(name);
  if (!normalized) return undefined;
  return targets.find((target) => normalizeName(target.name) === normalized);
};

const connectorSetScore = (
  connectorSet: WorldAcceptedConnectorSet,
  rootConnectorName: string,
  targets: readonly StudioWorldConnectorTarget[],
): number => {
  const root = normalizeName(rootConnectorName);
  const requiredNames = connectorSet.connectors.map(normalizeName).filter(Boolean);
  const optionalNames = connectorSet.optionalConnectors.map(normalizeName).filter(Boolean);
  const exactRequiredMatches = requiredNames.filter((slot) => findTargetByName(targets, slot));
  const exactOptionalMatches = optionalNames.filter((slot) => findTargetByName(targets, slot));
  const rootRequiredMatch = root && requiredNames.includes(root) ? 100 : 0;
  return rootRequiredMatch + exactRequiredMatches.length * 10 + exactOptionalMatches.length;
};

export const resolveStudioWorldConnectorSetMatch = ({
  connectorSets,
  rootConnectorName,
  availableTargets,
}: {
  connectorSets: readonly WorldAcceptedConnectorSet[] | null | undefined;
  rootConnectorName: string;
  availableTargets: readonly StudioWorldConnectorTarget[];
}): StudioWorldConnectorSetMatch | null => {
  if (!connectorSets?.length) return null;
  const rootTarget = findTargetByName(availableTargets, rootConnectorName);
  if (!rootTarget) return null;

  const scored = connectorSets
    .map((connectorSet, index) => ({
      connectorSet,
      index,
      score: connectorSetScore(connectorSet, rootConnectorName, availableTargets),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = scored[0];
  if (!selected) return null;

  const usedTargetIds = new Set<string>();
  const bindings: StudioWorldConnectorBindingMatch[] = [];

  selected.connectorSet.connectors.forEach((slot, index) => {
    const normalizedSlot = slot.trim();
    if (!normalizedSlot) return;
    const exactTarget = findTargetByName(availableTargets, normalizedSlot);
    const target = exactTarget ?? (index === 0 ? rootTarget : undefined);
    if (target) usedTargetIds.add(target.id);
    bindings.push({
      slot: normalizedSlot,
      connectorName: target?.name ?? normalizedSlot,
      ...(target ? { targetId: target.id } : {}),
    });
  });

  selected.connectorSet.optionalConnectors.forEach((slot) => {
    const normalizedSlot = slot.trim();
    if (!normalizedSlot) return;
    const target = findTargetByName(availableTargets, normalizedSlot);
    if (!target) return;
    usedTargetIds.add(target.id);
    bindings.push({
      slot: normalizedSlot,
      connectorName: target.name,
      optional: true,
      targetId: target.id,
    });
  });

  return {
    connectorSetIndex: selected.index,
    connectorSet: selected.connectorSet,
    bindings,
    attachedTargetIds: [...usedTargetIds],
    missingRequiredConnectors: bindings
      .filter((binding) => !binding.optional && !binding.targetId)
      .map((binding) => binding.slot),
  };
};

export const describeStudioWorldPluginCompatibility = ({
  plugin,
  rootConnectorName,
  rootFormatHash,
  availableTargets,
}: {
  plugin: StudioPluginDescriptor;
  rootConnectorName: string;
  rootFormatHash: string;
  availableTargets: readonly StudioWorldConnectorTarget[];
}): StudioWorldPluginCompatibility => {
  const connectorSetMatch = resolveStudioWorldConnectorSetMatch({
    connectorSets: plugin.acceptedConnectorSets,
    rootConnectorName,
    availableTargets,
  });
  if (connectorSetMatch) {
    const missing = connectorSetMatch.missingRequiredConnectors;
    return {
      label: missing.length ? "Partial connector set" : "Connector set",
      detail: missing.length
        ? `Missing required connector slots: ${missing.join(", ")}`
        : `Matches set ${connectorSetMatch.connectorSetIndex + 1}`,
      kind: missing.length ? "partial" : "connector-set",
      match: connectorSetMatch,
    };
  }

  const normalizedFormat = rootFormatHash.trim().toLowerCase();
  const supportedFormats = plugin.supportedFormatHashes.map((hash) => hash.trim().toLowerCase());
  if (normalizedFormat && supportedFormats.includes(normalizedFormat)) {
    return {
      label: "Format match",
      detail: normalizedFormat,
      kind: "format",
      match: null,
    };
  }

  if (!rootConnectorName.trim()) {
    return {
      label: "Standalone",
      detail: "Choose a root connector to attach.",
      kind: "standalone",
      match: null,
    };
  }

  if (plugin.acceptedConnectorSets?.length) {
    return {
      label: "Connector set",
      detail: "Connect after selecting a root connector node.",
      kind: "unavailable",
      match: null,
    };
  }

  if (plugin.supportedFormatHashes.length) {
    return {
      label: "No format match",
      detail: "Available as standalone world.",
      kind: "unavailable",
      match: null,
    };
  }

  return {
    label: "Manual",
    detail: "Connect to a compatible root connector.",
    kind: "standalone",
    match: null,
  };
};

export const studioWorldConnectorSetSelectionFromMatch = (
  match: StudioWorldConnectorSetMatch | null | undefined,
): StudioWorldConnectorSetSelection | undefined => {
  if (!match) return undefined;
  if (match.missingRequiredConnectors.length > 0) return undefined;

  const connectorBindingValues = Object.fromEntries(
    match.bindings.map((binding) => [
      connectorBindingValueKey(binding.slot, Boolean(binding.optional)),
      binding.connectorName,
    ]),
  );

  return {
    connectorSetIndex: match.connectorSetIndex,
    connectorBindingValues,
  };
};

export const summarizeStudioWorldConnectorSets = (
  connectorSets: readonly WorldAcceptedConnectorSet[] | null | undefined,
): string => {
  if (!connectorSets?.length) return "";
  return connectorSets
    .map((connectorSet, index) => {
      const required = unique(connectorSet.connectors);
      const optional = unique(connectorSet.optionalConnectors);
      return `Set ${index + 1}: ${required.join(", ")}${
        optional.length ? `; optional ${optional.join(", ")}` : ""
      }`;
    })
    .join(" | ");
};
