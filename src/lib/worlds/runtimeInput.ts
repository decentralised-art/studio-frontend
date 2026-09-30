import {
  WORLD_PROTOCOL_VERSION,
  type WorldAcceptedConnectorSet,
  type WorldDescriptor,
  type WorldRuntimeConnectorBinding,
  type WorldRuntimeInput,
  type WorldRuntimeSurface,
} from "./types";

export type ConnectorBindingValues = Record<string, string>;

export type BackendWorldRuntimeInputOptions = {
  world: WorldDescriptor;
  surface: WorldRuntimeSurface;
  label?: string;
  connectorName?: string;
  connectorAddress?: string;
  connectorFormatHash?: string;
  connectorSetIndex?: number;
  connectorBindingValues?: ConnectorBindingValues;
  executeOutput?: WorldRuntimeInput["executeOutput"];
  executionProvenance?: WorldRuntimeInput["executionProvenance"];
  executionMode?: WorldRuntimeInput["executionMode"];
  particlesCount?: number;
  selectedConnectorContextNames?: string[];
  selectedConnectorContextPathPrefixes?: string[];
};

const bindingKey = (slot: string, optional: boolean): string =>
  `${optional ? "optional" : "required"}:${slot}`;

const normalizeConnectorName = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const uniqueConnectorNames = (names: readonly string[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];
  names.forEach((name) => {
    const normalized = normalizeConnectorName(name);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    unique.push(normalized);
  });
  return unique;
};

export const connectorBindingValueKey = (slot: string, optional = false): string =>
  bindingKey(slot.trim(), optional);

export const initializeConnectorSetBindingValues = (
  connectorSet: WorldAcceptedConnectorSet | null | undefined,
  options: { primaryConnectorName?: string; existing?: ConnectorBindingValues } = {},
): ConnectorBindingValues => {
  if (!connectorSet) return {};
  const existing = options.existing ?? {};
  const primaryConnectorName = normalizeConnectorName(options.primaryConnectorName);
  const values: ConnectorBindingValues = {};

  connectorSet.connectors.forEach((slot, index) => {
    const normalizedSlot = normalizeConnectorName(slot);
    if (!normalizedSlot) return;
    const key = connectorBindingValueKey(normalizedSlot);
    values[key] =
      normalizeConnectorName(existing[key]) ||
      (index === 0 && primaryConnectorName) ||
      normalizedSlot;
  });

  connectorSet.optionalConnectors.forEach((slot) => {
    const normalizedSlot = normalizeConnectorName(slot);
    if (!normalizedSlot) return;
    const key = connectorBindingValueKey(normalizedSlot, true);
    values[key] = normalizeConnectorName(existing[key]);
  });

  return values;
};

export const buildConnectorSetBindings = (
  connectorSet: WorldAcceptedConnectorSet | null | undefined,
  values: ConnectorBindingValues = {},
): WorldRuntimeConnectorBinding[] => {
  if (!connectorSet) return [];
  const bindings: WorldRuntimeConnectorBinding[] = [];

  connectorSet.connectors.forEach((slot) => {
    const normalizedSlot = normalizeConnectorName(slot);
    const connectorName = normalizeConnectorName(
      values[connectorBindingValueKey(normalizedSlot)] || normalizedSlot,
    );
    if (normalizedSlot && connectorName) {
      bindings.push({ slot: normalizedSlot, connectorName });
    }
  });

  connectorSet.optionalConnectors.forEach((slot) => {
    const normalizedSlot = normalizeConnectorName(slot);
    const connectorName = normalizeConnectorName(
      values[connectorBindingValueKey(normalizedSlot, true)],
    );
    if (normalizedSlot && connectorName) {
      bindings.push({ slot: normalizedSlot, connectorName, optional: true });
    }
  });

  return bindings;
};

export const buildBackendWorldRuntimeInput = (
  options: BackendWorldRuntimeInputOptions,
): WorldRuntimeInput => {
  const connectorName = normalizeConnectorName(options.connectorName);
  const connectorSet =
    options.connectorSetIndex === undefined
      ? undefined
      : options.world.acceptedConnectorSets?.[options.connectorSetIndex];
  const connectorBindings = buildConnectorSetBindings(connectorSet, options.connectorBindingValues);
  const connectorNames = uniqueConnectorNames([
    connectorName,
    ...connectorBindings.map((binding) => binding.connectorName),
  ]);

  return {
    protocolVersion: WORLD_PROTOCOL_VERSION,
    worldId: options.world.id,
    surface: options.surface,
    label:
      options.label ??
      (connectorName ? `${options.world.name}: ${connectorName}` : options.world.name),
    ...(connectorName ? { connectorName } : {}),
    ...(connectorNames.length ? { connectorNames } : {}),
    ...(options.connectorAddress ? { connectorAddress: options.connectorAddress } : {}),
    ...(options.connectorFormatHash ? { connectorFormatHash: options.connectorFormatHash } : {}),
    ...(connectorBindings.length ? { connectorBindings } : {}),
    ...(connectorSet
      ? {
          connectorSet: {
            index: options.connectorSetIndex ?? 0,
            connectors: [...connectorSet.connectors],
            optionalConnectors: [...connectorSet.optionalConnectors],
          },
        }
      : {}),
    ...(options.particlesCount !== undefined ? { particlesCount: options.particlesCount } : {}),
    ...(options.executionProvenance ? { executionProvenance: options.executionProvenance } : {}),
    ...(options.executionMode ? { executionMode: options.executionMode } : {}),
    ...(options.executeOutput !== undefined ? { executeOutput: options.executeOutput } : {}),
    ...(options.selectedConnectorContextNames?.length
      ? { selectedConnectorContextNames: [...options.selectedConnectorContextNames] }
      : {}),
    ...(options.selectedConnectorContextPathPrefixes?.length
      ? { selectedConnectorContextPathPrefixes: [...options.selectedConnectorContextPathPrefixes] }
      : {}),
  };
};
