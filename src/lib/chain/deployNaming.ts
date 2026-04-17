const CORE_COLLECTION_RESERVED_NAMES = {
  transformation: new Set([
    "identity",
    "add",
    "subtract",
    "multiply",
    "divide",
    "modulo",
    "power",
    "min",
    "max",
    "clamp",
    "quantize_step",
  ]),
  condition: new Set(["always_true", "equals", "greater_than", "less_than", "between_inclusive"]),
} as const;

export type DeployNameKind = keyof typeof CORE_COLLECTION_RESERVED_NAMES;

const sanitizeNamePart = (value: string) => {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "x";
};

const formatUtcStamp = (date: Date) => {
  const pad2 = (n: number) => `${n}`.padStart(2, "0");
  return [
    date.getUTCFullYear(),
    pad2(date.getUTCMonth() + 1),
    pad2(date.getUTCDate()),
    pad2(date.getUTCHours()),
    pad2(date.getUTCMinutes()),
    pad2(date.getUTCSeconds()),
  ].join("");
};

const randomSuffix = () => {
  const fallback = () => Math.floor(Math.random() * 0xffff);
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const bytes = new Uint16Array(1);
    cryptoObj.getRandomValues(bytes);
    return (bytes[0] ?? 0).toString(16).padStart(4, "0");
  }
  return fallback().toString(16).padStart(4, "0");
};

export const createEphemeralDeployName = (
  kind: DeployNameKind,
  options: {
    scope?: string;
    authorTag?: string;
    date?: Date;
  } = {},
) => {
  const scope = sanitizeNamePart(options.scope ?? "manual");
  const author = sanitizeNamePart(options.authorTag ?? "studio");
  const stamp = formatUtcStamp(options.date ?? new Date());
  const entropy = randomSuffix();
  return `test_${kind}_${scope}_${author}_${stamp}_${entropy}`;
};

export const isReservedCoreCollectionName = (kind: DeployNameKind, name: string) =>
  CORE_COLLECTION_RESERVED_NAMES[kind].has(name.trim().toLowerCase());
