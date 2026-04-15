import type {
  ChainExecutePayload,
  ChainExecuteRunningInstancePayload,
} from "$lib/chain/registryApi";

const UINT32_MAX = 0xffff_ffff;
const DECIMAL_RE = /^(0|[1-9]\d*)$/;

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parseUint32Number = (value: unknown, field: string): number => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`Invalid execute payload: ${field} must be an integer number.`);
  }
  if (value < 0 || value > UINT32_MAX) {
    throw new Error(`Invalid execute payload: ${field} must be within uint32 range.`);
  }
  return value;
};

const parsePositionKey = (rawKey: string): number => {
  if (!DECIMAL_RE.test(rawKey)) {
    throw new Error(
      `Invalid execute payload: dynamic_ri position '${rawKey}' must be a canonical non-negative integer string.`,
    );
  }
  const parsed = Number(rawKey);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > UINT32_MAX) {
    throw new Error(
      `Invalid execute payload: dynamic_ri position '${rawKey}' is outside uint32 range.`,
    );
  }
  return parsed;
};

const normalizeParticlesCount = (rawValue: unknown): string => {
  if (typeof rawValue !== "string") {
    throw new Error("Invalid execute payload: particles_count must be a decimal string.");
  }
  const trimmed = rawValue.trim();
  if (!DECIMAL_RE.test(trimmed)) {
    throw new Error(
      "Invalid execute payload: particles_count must be a canonical non-negative integer string.",
    );
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > UINT32_MAX) {
    throw new Error("Invalid execute payload: particles_count is outside uint32 range.");
  }
  return String(parsed);
};

const normalizeDynamicRiEntry = (
  position: string,
  value: unknown,
): ChainExecuteRunningInstancePayload => {
  if (!isPlainRecord(value)) {
    throw new Error(
      `Invalid execute payload: dynamic_ri['${position}'] must be an object with start_point and transformation_shift.`,
    );
  }
  const entryKeys = Object.keys(value);
  const unknownKeys = entryKeys.filter(
    (key) => key !== "start_point" && key !== "transformation_shift",
  );
  if (unknownKeys.length > 0) {
    throw new Error(
      `Invalid execute payload: dynamic_ri['${position}'] contains unsupported keys: ${unknownKeys.join(", ")}.`,
    );
  }
  if (!entryKeys.includes("start_point") || !entryKeys.includes("transformation_shift")) {
    throw new Error(
      `Invalid execute payload: dynamic_ri['${position}'] must include start_point and transformation_shift.`,
    );
  }

  return {
    start_point: parseUint32Number(value.start_point, `dynamic_ri['${position}'].start_point`),
    transformation_shift: parseUint32Number(
      value.transformation_shift,
      `dynamic_ri['${position}'].transformation_shift`,
    ),
  };
};

export const normalizeChainExecutePayload = (payload: ChainExecutePayload): ChainExecutePayload => {
  if (!isPlainRecord(payload)) {
    throw new Error("Invalid execute payload: payload must be an object.");
  }

  const payloadKeys = Object.keys(payload);
  const unknownTopLevelKeys = payloadKeys.filter(
    (key) => key !== "connector_name" && key !== "particles_count" && key !== "dynamic_ri",
  );
  if (unknownTopLevelKeys.length > 0) {
    throw new Error(
      `Invalid execute payload: unsupported top-level keys: ${unknownTopLevelKeys.join(", ")}.`,
    );
  }

  const connectorName =
    typeof payload.connector_name === "string" ? payload.connector_name.trim() : "";
  if (connectorName.length === 0) {
    throw new Error("Invalid execute payload: connector_name must be a non-empty string.");
  }

  const particlesCount = normalizeParticlesCount(payload.particles_count);
  if (!isPlainRecord(payload.dynamic_ri)) {
    throw new Error("Invalid execute payload: dynamic_ri must be an object.");
  }

  const entries = Object.entries(payload.dynamic_ri).map(([rawKey, rawValue]) => ({
    rawKey,
    position: parsePositionKey(rawKey),
    value: normalizeDynamicRiEntry(rawKey, rawValue),
  }));

  const dynamicRi: Record<string, ChainExecuteRunningInstancePayload> = {};
  entries
    .sort((a, b) => a.position - b.position)
    .forEach((entry) => {
      dynamicRi[String(entry.position)] = entry.value;
    });

  return {
    connector_name: connectorName,
    particles_count: particlesCount,
    dynamic_ri: dynamicRi,
  };
};
