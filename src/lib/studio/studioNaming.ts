export type TransformationPreviewLike = {
  name: string;
  args: number[];
};

export const titleize = (value: string) =>
  value
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

export const normalizeKey = (value: string) => value.toLowerCase().replace(/[\s-_]+/g, "");

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const formatTransformationPreviewLabel = (name: string, args: number[] = []) => {
  const trimmed = name.trim() || "Transformation";
  if (!args.length) return trimmed;
  return `${trimmed} (${args.join(", ")})`;
};

export const formatTransformationPreview = (transformation: TransformationPreviewLike) =>
  formatTransformationPreviewLabel(transformation.name, transformation.args);

export const isConnectorKind = (kind: string | null | undefined): kind is "feature" | "connector" =>
  kind === "feature" || kind === "connector";

export const isValidChainName = (value: string) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);

export const toContractName = (label: string) => {
  const cleaned = label.replace(/[^A-Za-z0-9]+/g, " ").trim();
  const parts = cleaned.length ? cleaned.split(/\s+/) : [];
  let name = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
  if (!name) name = "Transformation";
  if (/^[0-9]/.test(name)) name = `Tx${name}`;
  return name;
};

export const toConditionContractName = (label: string) => {
  const name = toContractName(label);
  return name === "Transformation" ? "Condition" : name;
};

export const parseArgsInput = (value: string) =>
  value
    .split(",")
    .map((segment) => Number(segment.trim()))
    .filter((num) => Number.isFinite(num))
    .map((num) => Math.trunc(num));
