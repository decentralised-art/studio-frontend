import type {
  ChainConnectorPayload,
  ChainConnectorResponse,
  ChainTransformationArg,
} from "$lib/chain/registryApi";
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

const toInt32 = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }
  if (value < INT32_MIN || value > INT32_MAX) {
    throw new Error(`${label} must fit int32 range.`);
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

export function fromProtocolConnectorPayload(payload: ChainConnectorResponse): StudioConnectorDef {
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

  const rawConditionName = payload.condition_name ?? payload.conditionName;
  const conditionName = normalizeOptionalName(rawConditionName);
  const rawConditionArgs = payload.condition_args ?? payload.conditionArgs;

  let conditionArgs: number[] | undefined;
  if (rawConditionArgs !== undefined) {
    conditionArgs = normalizeInt32Array(rawConditionArgs, "condition_args");
  }

  if (!conditionName && conditionArgs && conditionArgs.length > 0) {
    throw new Error(`Connector ${name} has condition args without a condition name.`);
  }

  return {
    name,
    dimensions,
    conditionName,
    conditionArgs,
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
  const conditionArgs =
    connector.conditionArgs && connector.conditionArgs.length > 0
      ? normalizeInt32Array(connector.conditionArgs, "condition_args")
      : undefined;

  if (!conditionName && conditionArgs && conditionArgs.length > 0) {
    throw new Error(`Connector ${name} has condition args without a condition name.`);
  }

  return {
    name,
    dimensions,
    ...(conditionName ? { condition_name: conditionName } : {}),
    ...(conditionArgs ? { condition_args: conditionArgs } : {}),
  };
}
