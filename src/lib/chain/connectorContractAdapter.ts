import type {
  ChainConnectorPayload,
  ChainTransformationArg,
  RawChainConnectorResponse,
} from "$lib/chain/registryApi";
import { normalizeFormatHash } from "$lib/chain/registryApi";
import type {
  StudioConnectorDef,
  StudioTransformationRef,
} from "$lib/studio/domain/connectorModel";
import {
  normalizeBindingsMap,
  parseCanonicalSlotKey,
  toCanonicalSlotKey,
} from "$lib/studio/domain/slotProjection";

const INT32_MIN = -0x8000_0000;
const INT32_MAX = 0x7fff_ffff;
const UINT32_MAX = 0xffff_ffff;

const normalizeName = (value: unknown, label: string): string => {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} cannot be empty.`);
  }
  return trimmed;
};

const normalizeOptionalName = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeOptionalFormatHash = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return normalizeFormatHash(trimmed);
  } catch {
    return undefined;
  }
};

const toInt32 = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }
  if (value < INT32_MIN || value > INT32_MAX) {
    throw new Error(`${label} must fit int32 range.`);
  }
  return value;
};

const toUInt32 = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }
  if (value < 0 || value > UINT32_MAX) {
    throw new Error(`${label} must fit uint32 range.`);
  }
  return value;
};

const normalizeInt32Array = (value: unknown, label: string): number[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  return value.map((item, index) => toInt32(item, `${label}[${index}]`));
};

const normalizeTransformation = (tx: unknown, index: number): StudioTransformationRef => {
  if (!tx || typeof tx !== "object") {
    throw new Error(`dimensions[].transformations[${index}] must be an object.`);
  }
  const rec = tx as Record<string, unknown>;
  const name = normalizeName(rec.name, `dimensions[].transformations[${index}].name`);
  const args = rec.args
    ? normalizeInt32Array(rec.args, `dimensions[].transformations[${index}].args`)
    : [];
  return { name, args };
};

const normalizeBindings = (bindings: unknown): Record<string, string> => {
  if (!bindings) return {};
  if (typeof bindings !== "object" || Array.isArray(bindings)) {
    throw new Error("dimensions[].bindings must be an object map.");
  }

  const normalizedEntries = normalizeBindingsMap(bindings as Record<string, string>);
  const sorted = [...normalizedEntries].sort((a, b) => a.slotId - b.slotId);

  const out: Record<string, string> = {};
  sorted.forEach((entry) => {
    out[entry.slotKey] = entry.targetConnector;
  });
  return out;
};

const extractLegacyCompatibleConditionName = (payload: RawChainConnectorResponse) =>
  payload.condition_name ?? payload.conditionName;

const extractLegacyCompatibleConditionArgs = (payload: RawChainConnectorResponse) =>
  payload.condition_args ?? payload.conditionArgs;

const extractLegacyCompatibleStaticRi = (payload: RawChainConnectorResponse) =>
  payload.static_ri ?? payload.staticRi;

const normalizeStaticRi = (
  value: unknown,
  label: string,
): StudioConnectorDef["staticRi"] | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object map.`);
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([rawKey, rawEntry]) => {
      const slotId = parseCanonicalSlotKey(rawKey);
      if (slotId === null) {
        throw new Error(`${label} has invalid key '${rawKey}'.`);
      }
      const slotKey = toCanonicalSlotKey(slotId);
      if (!slotKey) {
        throw new Error(`${label} has invalid key '${rawKey}'.`);
      }

      if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
        throw new Error(`${label}['${slotKey}'] must be an object.`);
      }

      const rec = rawEntry as Record<string, unknown>;
      // Legacy frontend fixtures may still use camelCase RI field names.
      const startPointRaw = rec.start_point ?? rec.startPoint;
      const transformationShiftRaw =
        rec.transformation_shift ?? rec.transformationShift ?? rec.transformShift;
      const startPoint =
        startPointRaw === undefined
          ? 0
          : toUInt32(startPointRaw, `${label}['${slotKey}'].start_point`);
      const transformationShift =
        transformationShiftRaw === undefined
          ? 0
          : toUInt32(transformationShiftRaw, `${label}['${slotKey}'].transformation_shift`);

      return {
        slotId,
        slotKey,
        entry: {
          startPoint,
          transformationShift,
        },
      };
    })
    .sort((a, b) => a.slotId - b.slotId);

  if (entries.length === 0) return undefined;

  const out: Record<string, { startPoint: number; transformationShift: number }> = {};
  entries.forEach(({ slotKey, entry }) => {
    out[slotKey] = entry;
  });
  return out;
};

export function fromProtocolConnectorPayload(
  payload: RawChainConnectorResponse,
): StudioConnectorDef {
  const name = normalizeName(payload.name, "connector.name");
  const dimensionsRaw = payload.dimensions;
  if (!Array.isArray(dimensionsRaw) || dimensionsRaw.length === 0) {
    throw new Error(`Connector ${name} must include at least one dimension.`);
  }

  const dimensions = dimensionsRaw.map((dimension, dimIndex) => {
    if (!dimension || typeof dimension !== "object") {
      throw new Error(`dimensions[${dimIndex}] must be an object.`);
    }

    const transformations = Array.isArray(dimension.transformations)
      ? dimension.transformations.map((tx, txIndex) => normalizeTransformation(tx, txIndex))
      : [];

    const composite = normalizeOptionalName(dimension.composite);
    const bindings = normalizeBindings(dimension.bindings);

    if (!composite && Object.keys(bindings).length > 0) {
      throw new Error(
        `Connector ${name} dimension ${dimIndex} has bindings but no composite target.`,
      );
    }

    return {
      transformations,
      composite,
      bindings,
    };
  });

  const rawConditionName = extractLegacyCompatibleConditionName(payload);
  const conditionName = normalizeOptionalName(rawConditionName);
  const rawConditionArgs = extractLegacyCompatibleConditionArgs(payload);

  let conditionArgs: number[] | undefined;
  if (rawConditionArgs !== undefined) {
    conditionArgs = normalizeInt32Array(rawConditionArgs, "condition_args");
  }

  if (!conditionName && conditionArgs && conditionArgs.length > 0) {
    throw new Error(`Connector ${name} has condition args without a condition name.`);
  }

  const formatHash = normalizeOptionalFormatHash(payload.format_hash);
  const ownerAddress = typeof payload.owner === "string" ? payload.owner.trim().toLowerCase() : "";
  const chainAddress =
    typeof payload.address === "string" ? payload.address.trim().toLowerCase() : "";
  const staticRi = normalizeStaticRi(extractLegacyCompatibleStaticRi(payload), "static_ri");

  return {
    name,
    dimensions,
    conditionName,
    conditionArgs,
    ...(staticRi ? { staticRi } : {}),
    ...(formatHash ? { formatHash } : {}),
    ...(ownerAddress ? { ownerAddress } : {}),
    ...(chainAddress ? { chainAddress } : {}),
  };
}

const normalizePayloadTxArgs = (args: number[], label: string): ChainTransformationArg[] => {
  return args.map((value, index) => toInt32(value, `${label}[${index}]`));
};

export function toProtocolConnectorPayload(connector: StudioConnectorDef): ChainConnectorPayload {
  const name = normalizeName(connector.name, "connector.name");

  if (!Array.isArray(connector.dimensions) || connector.dimensions.length === 0) {
    throw new Error(`Connector ${name} must include at least one dimension.`);
  }

  const dimensions = connector.dimensions.map((dimension, dimIndex) => {
    const transformations = (dimension.transformations ?? []).map((tx, txIndex) => {
      const txName = normalizeName(
        tx.name,
        `dimensions[${dimIndex}].transformations[${txIndex}].name`,
      );
      const txArgs = normalizePayloadTxArgs(
        tx.args ?? [],
        `dimensions[${dimIndex}].transformations[${txIndex}].args`,
      );
      return { name: txName, args: txArgs };
    });

    const composite = normalizeOptionalName(dimension.composite);
    const bindings = normalizeBindings(dimension.bindings ?? {});

    if (!composite && Object.keys(bindings).length > 0) {
      throw new Error(
        `Connector ${name} dimension ${dimIndex} has bindings but no composite target.`,
      );
    }

    const sortedBindingEntries = Object.entries(bindings)
      .map(([key, target]) => {
        const slotId = parseCanonicalSlotKey(key);
        if (slotId === null) {
          throw new Error(`Invalid canonical slot key: ${key}`);
        }
        const slotKey = toCanonicalSlotKey(slotId);
        if (!slotKey) {
          throw new Error(`Invalid slot key: ${key}`);
        }
        return {
          slotId,
          slotKey,
          target: normalizeName(target, `dimensions[${dimIndex}].bindings`),
        };
      })
      .sort((a, b) => a.slotId - b.slotId);

    const bindingsOut: Record<string, string> = {};
    sortedBindingEntries.forEach(({ slotKey, target }) => {
      bindingsOut[slotKey] = target;
    });

    return {
      transformations,
      ...(composite ? { composite } : {}),
      ...(Object.keys(bindingsOut).length > 0 ? { bindings: bindingsOut } : {}),
    };
  });

  const conditionName = normalizeOptionalName(connector.conditionName);
  const conditionArgs = connector.conditionArgs
    ? normalizeInt32Array(connector.conditionArgs, "condition_args")
    : undefined;

  if (!conditionName && conditionArgs && conditionArgs.length > 0) {
    throw new Error(`Connector ${name} has condition args without a condition name.`);
  }

  const staticRi = normalizeStaticRi(connector.staticRi, "connector.staticRi");
  const staticRiEntries = staticRi
    ? Object.entries(staticRi)
        .map(([rawKey, value]) => {
          const slotId = parseCanonicalSlotKey(rawKey);
          if (slotId === null) {
            throw new Error(`connector.staticRi has invalid key '${rawKey}'.`);
          }
          const slotKey = toCanonicalSlotKey(slotId);
          if (!slotKey) {
            throw new Error(`connector.staticRi has invalid key '${rawKey}'.`);
          }
          return {
            slotId,
            slotKey,
            value: {
              start_point: toUInt32(
                value.startPoint,
                `connector.staticRi['${slotKey}'].startPoint`,
              ),
              transformation_shift: toUInt32(
                value.transformationShift,
                `connector.staticRi['${slotKey}'].transformationShift`,
              ),
            },
          };
        })
        .sort((a, b) => a.slotId - b.slotId)
    : [];
  const staticRiOut: Record<string, { start_point: number; transformation_shift: number }> = {};
  staticRiEntries.forEach(({ slotKey, value }) => {
    staticRiOut[slotKey] = value;
  });

  return {
    name,
    dimensions,
    condition_name: conditionName ?? "",
    condition_args: conditionName ? (conditionArgs ?? []) : [],
    ...(Object.keys(staticRiOut).length > 0 ? { static_ri: staticRiOut } : {}),
  };
}
