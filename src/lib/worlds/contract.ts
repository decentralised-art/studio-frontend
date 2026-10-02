import type {
  WorldAcceptedConnectorSet,
  WorldBackendValueLimits,
  WorldDescriptor,
  WorldNumericValueLimit,
  WorldPermission,
  WorldRuntimeKind,
  WorldRuntimeSurface,
  WorldStatus,
  WorldValueLimits,
} from "./types";

export const WORLD_RUNTIME_KINDS = ["iframe"] as const satisfies readonly WorldRuntimeKind[];

export const WORLD_RUNTIME_SURFACES = [
  "world-page",
  "studio-plugin",
] as const satisfies readonly WorldRuntimeSurface[];

export const WORLD_PERMISSION_VALUES = [
  "decentralised.art.connectors.read",
  "decentralised.art.transformations.read",
  "decentralised.art.conditions.read",
  "decentralised.art.social.read",
  "decentralised.art.execute",
  "dcn.connectors.read",
  "dcn.transformations.read",
  "dcn.conditions.read",
  "dcn.social.read",
  "dcn.execute",
  "browser.audio",
  "browser.downloads",
] as const satisfies readonly WorldPermission[];

export const WORLD_STATUS_VALUES = ["active", "deleted"] as const satisfies readonly WorldStatus[];

const WORLD_RUNTIME_KIND_SET = new Set<string>(WORLD_RUNTIME_KINDS);
const WORLD_RUNTIME_SURFACE_SET = new Set<string>(WORLD_RUNTIME_SURFACES);
const WORLD_PERMISSION_SET = new Set<string>(WORLD_PERMISSION_VALUES);
const WORLD_STATUS_SET = new Set<string>(WORLD_STATUS_VALUES);

export class WorldContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorldContractError";
  }
}

export type BackendWorldDescriptor = {
  id: string;
  slug: string;
  name: string;
  version: string;
  entryUrn: string;
  runtime: WorldRuntimeKind;
  surfaces: WorldRuntimeSurface[];
  permissions: WorldPermission[];
  description: string;
  shortDescription?: string;
  heroLabel?: string;
  accentColor?: string;
  acceptedFormatHashes: string[];
  acceptedConnectorSets: WorldAcceptedConnectorSet[];
  valueLimits?: WorldBackendValueLimits;
  preview?: string;
  previewUrn?: string;
  ownerId: string;
  bundleHash: string;
  manifestHash: string;
  entryPath: string;
  status: WorldStatus;
  createdAt: string;
  updatedAt: string;
};

export type BackendWorldDescriptorPreview = {
  slug: string;
  name: string;
  version: string;
  runtime: WorldRuntimeKind;
  surfaces: WorldRuntimeSurface[];
  permissions: WorldPermission[];
  description: string;
  preview?: string;
  acceptedFormatHashes: string[];
  acceptedConnectorSets: WorldAcceptedConnectorSet[];
};

export type BackendWorldValidateResponse = {
  descriptor: BackendWorldDescriptorPreview;
  bundleHash: string;
  manifestHash: string;
  warnings: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const asRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new WorldContractError(`${label} must be an object.`);
  }
  return value;
};

const requiredString = (record: Record<string, unknown>, key: string, label: string): string => {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new WorldContractError(`${label}.${key} must be a non-empty string.`);
  }
  return value.trim();
};

const optionalString = (
  record: Record<string, unknown>,
  key: string,
  label: string,
): string | undefined => {
  const value = record[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new WorldContractError(`${label}.${key} must be a string when present.`);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const stringArray = (
  record: Record<string, unknown>,
  key: string,
  label: string,
  options: { required?: boolean; allowEmptyItems?: boolean } = {},
): string[] => {
  const value = record[key];
  if (value === undefined || value === null) {
    if (options.required) {
      throw new WorldContractError(`${label}.${key} must be an array.`);
    }
    return [];
  }
  if (!Array.isArray(value)) {
    throw new WorldContractError(`${label}.${key} must be an array.`);
  }
  return value.map((item, index) => {
    if (typeof item !== "string") {
      throw new WorldContractError(`${label}.${key}[${index}] must be a string.`);
    }
    const trimmed = item.trim();
    if (!options.allowEmptyItems && trimmed.length === 0) {
      throw new WorldContractError(`${label}.${key}[${index}] must be a non-empty string.`);
    }
    return trimmed;
  });
};

const oneOf = <T extends string>(
  value: string,
  set: ReadonlySet<string>,
  label: string,
  allowed: readonly T[],
): T => {
  if (!set.has(value)) {
    throw new WorldContractError(`${label} must be one of: ${allowed.join(", ")}.`);
  }
  return value as T;
};

const normalizeRuntime = (value: string, label: string): WorldRuntimeKind =>
  oneOf(value, WORLD_RUNTIME_KIND_SET, label, WORLD_RUNTIME_KINDS);

const normalizeSurface = (value: string, label: string): WorldRuntimeSurface =>
  oneOf(value, WORLD_RUNTIME_SURFACE_SET, label, WORLD_RUNTIME_SURFACES);

const normalizePermission = (value: string, label: string): WorldPermission =>
  oneOf(value, WORLD_PERMISSION_SET, label, WORLD_PERMISSION_VALUES);

const normalizeStatus = (value: string, label: string): WorldStatus =>
  oneOf(value, WORLD_STATUS_SET, label, WORLD_STATUS_VALUES);

const normalizeSurfaces = (
  record: Record<string, unknown>,
  label: string,
): WorldRuntimeSurface[] => {
  const surfaces = stringArray(record, "surfaces", label, { required: true }).map(
    (surface, index) => normalizeSurface(surface, `${label}.surfaces[${index}]`),
  );
  if (surfaces.length === 0) {
    throw new WorldContractError(`${label}.surfaces must not be empty.`);
  }
  return surfaces;
};

const normalizePermissions = (record: Record<string, unknown>, label: string): WorldPermission[] =>
  stringArray(record, "permissions", label).map((permission, index) =>
    normalizePermission(permission, `${label}.permissions[${index}]`),
  );

const normalizeAcceptedConnectorSet = (
  value: unknown,
  label: string,
): WorldAcceptedConnectorSet => {
  const record = asRecord(value, label);
  const connectors = stringArray(record, "connectors", label, { required: true });
  if (connectors.length === 0) {
    throw new WorldContractError(`${label}.connectors must not be empty.`);
  }
  return {
    connectors,
    optionalConnectors: stringArray(record, "optionalConnectors", label),
  };
};

const normalizeAcceptedConnectorSets = (
  record: Record<string, unknown>,
  label: string,
): WorldAcceptedConnectorSet[] => {
  const value = record.acceptedConnectorSets;
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new WorldContractError(`${label}.acceptedConnectorSets must be an array.`);
  }
  return value.map((set, index) =>
    normalizeAcceptedConnectorSet(set, `${label}.acceptedConnectorSets[${index}]`),
  );
};

const normalizeNumericLimit = (value: unknown, label: string): WorldNumericValueLimit => {
  const record = asRecord(value, label);
  const min = record.min;
  const max = record.max;
  if (typeof min !== "number" || !Number.isFinite(min)) {
    throw new WorldContractError(`${label}.min must be a finite number.`);
  }
  if (typeof max !== "number" || !Number.isFinite(max)) {
    throw new WorldContractError(`${label}.max must be a finite number.`);
  }
  if (min > max) {
    throw new WorldContractError(`${label}.min must be less than or equal to max.`);
  }
  return { min, max };
};

export const normalizeBackendWorldValueLimits = (
  value: unknown,
  label = "world.valueLimits",
): WorldBackendValueLimits | undefined => {
  if (value === undefined || value === null) return undefined;
  const record = asRecord(value, label);
  const particlesCount =
    record.particlesCount === undefined
      ? undefined
      : normalizeNumericLimit(record.particlesCount, `${label}.particlesCount`);
  const connectorValuesRecord =
    record.connectorValues === undefined
      ? undefined
      : asRecord(record.connectorValues, `${label}.connectorValues`);
  const connectorValues =
    connectorValuesRecord === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(connectorValuesRecord).map(([connector, limit]) => [
            connector.trim(),
            normalizeNumericLimit(limit, `${label}.connectorValues.${connector}`),
          ]),
        );

  if (particlesCount === undefined && connectorValues === undefined) return undefined;
  return {
    ...(particlesCount !== undefined ? { particlesCount } : {}),
    ...(connectorValues !== undefined ? { connectorValues } : {}),
  };
};

export const normalizeBackendWorldDescriptor = (value: unknown): BackendWorldDescriptor => {
  const record = asRecord(value, "world");
  const acceptedFormatHashes = stringArray(record, "acceptedFormatHashes", "world");
  const acceptedConnectorSets = normalizeAcceptedConnectorSets(record, "world");
  const id = requiredString(record, "id", "world");
  const preview = optionalString(record, "preview", "world");
  // Deployed services can return the bundled path without a resolved preview URN.
  const previewUrn =
    optionalString(record, "previewUrn", "world") ??
    (preview ? `/world-assets/${encodeURIComponent(id)}/${preview}` : undefined);

  return {
    id,
    slug: requiredString(record, "slug", "world"),
    name: requiredString(record, "name", "world"),
    version: requiredString(record, "version", "world"),
    entryUrn: requiredString(record, "entryUrn", "world"),
    runtime: normalizeRuntime(requiredString(record, "runtime", "world"), "world.runtime"),
    surfaces: normalizeSurfaces(record, "world"),
    permissions: normalizePermissions(record, "world"),
    description: requiredString(record, "description", "world"),
    shortDescription: optionalString(record, "shortDescription", "world"),
    heroLabel: optionalString(record, "heroLabel", "world"),
    accentColor: optionalString(record, "accentColor", "world"),
    acceptedFormatHashes,
    acceptedConnectorSets,
    valueLimits: normalizeBackendWorldValueLimits(record.valueLimits),
    preview,
    previewUrn,
    ownerId: requiredString(record, "ownerId", "world"),
    bundleHash: requiredString(record, "bundleHash", "world"),
    manifestHash: requiredString(record, "manifestHash", "world"),
    entryPath: requiredString(record, "entryPath", "world"),
    status: normalizeStatus(requiredString(record, "status", "world"), "world.status"),
    createdAt: requiredString(record, "createdAt", "world"),
    updatedAt: requiredString(record, "updatedAt", "world"),
  };
};

export const normalizeBackendWorldDescriptorList = (value: unknown): BackendWorldDescriptor[] => {
  if (!Array.isArray(value)) {
    throw new WorldContractError("world list must be an array.");
  }
  return value.map(normalizeBackendWorldDescriptor);
};

export const normalizeBackendWorldDescriptorPreview = (
  value: unknown,
): BackendWorldDescriptorPreview => {
  const record = asRecord(value, "world descriptor preview");
  const acceptedFormatHashes = stringArray(
    record,
    "acceptedFormatHashes",
    "world descriptor preview",
  );
  const acceptedConnectorSets = normalizeAcceptedConnectorSets(record, "world descriptor preview");

  return {
    slug: requiredString(record, "slug", "world descriptor preview"),
    name: requiredString(record, "name", "world descriptor preview"),
    version: requiredString(record, "version", "world descriptor preview"),
    runtime: normalizeRuntime(
      requiredString(record, "runtime", "world descriptor preview"),
      "world descriptor preview.runtime",
    ),
    surfaces: normalizeSurfaces(record, "world descriptor preview"),
    permissions: normalizePermissions(record, "world descriptor preview"),
    description: requiredString(record, "description", "world descriptor preview"),
    preview: optionalString(record, "preview", "world descriptor preview"),
    acceptedFormatHashes,
    acceptedConnectorSets,
  };
};

export const normalizeBackendWorldValidateResponse = (
  value: unknown,
): BackendWorldValidateResponse => {
  const record = asRecord(value, "world validate response");
  return {
    descriptor: normalizeBackendWorldDescriptorPreview(record.descriptor),
    bundleHash: requiredString(record, "bundleHash", "world validate response"),
    manifestHash: requiredString(record, "manifestHash", "world validate response"),
    warnings: stringArray(record, "warnings", "world validate response"),
  };
};

const backendValueLimitsToLegacy = (
  valueLimits: WorldBackendValueLimits | undefined,
): WorldValueLimits | undefined => {
  if (!valueLimits) return undefined;
  // The current first-party descriptor calls these scalarValues; backend keys may be connector paths.
  return {
    ...(valueLimits.particlesCount !== undefined
      ? { particlesCount: valueLimits.particlesCount }
      : {}),
    ...(valueLimits.connectorValues !== undefined
      ? { scalarValues: valueLimits.connectorValues }
      : {}),
  };
};

export const backendWorldToFrontendDescriptor = (
  world: BackendWorldDescriptor,
): WorldDescriptor => ({
  id: world.id,
  source: "backend",
  slug: world.slug,
  name: world.name,
  version: world.version,
  entry: world.entryUrn,
  entryUrn: world.entryUrn,
  runtime: world.runtime,
  permissions: world.permissions,
  acceptedPluginIds: [],
  acceptedFormatHashes: world.acceptedFormatHashes,
  acceptedConnectorSets: world.acceptedConnectorSets,
  surfaces: world.surfaces,
  description: world.description,
  shortDescription: world.shortDescription,
  heroLabel: world.heroLabel,
  accentColor: world.accentColor,
  valueLimits: backendValueLimitsToLegacy(world.valueLimits),
  backend: {
    ownerId: world.ownerId,
    bundleHash: world.bundleHash,
    manifestHash: world.manifestHash,
    entryPath: world.entryPath,
    entryUrn: world.entryUrn,
    status: world.status,
    createdAt: world.createdAt,
    updatedAt: world.updatedAt,
    preview: world.preview,
    previewUrn: world.previewUrn,
    valueLimits: world.valueLimits,
  },
});
