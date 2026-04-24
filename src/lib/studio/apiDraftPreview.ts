import { toInt } from "./connectorGraph";
import type { StudioConnectorDef } from "./domain/connectorModel";

export type ApiDraftRequest = {
  method?: string;
  path?: string;
  body?: Record<string, unknown>;
};

export type ApiConnectorRequestBody = {
  name?: string;
  dimensions?: Array<Record<string, unknown>>;
  condition_name?: string;
  condition_args?: number[];
  static_ri?: Record<string, { start_point: number; transformation_shift: number }>;
};

export type ApiDraftPreview = {
  ok?: boolean;
  warnings?: string[];
  root_connector?: string | null;
  deploy_requests?: ApiDraftRequest[];
  requests?: {
    conditions?: ApiDraftRequest[];
    transformations?: ApiDraftRequest[];
    connectors?: ApiDraftRequest[];
  };
};

export type ApiResolvedConnectorPreview = {
  name?: string;
  label?: string;
  dimensions?: number;
  connector_rows?: Array<{
    dimension?: number;
    transformations?: string[];
  }>;
  condition?: string;
  from_network?: boolean;
  static_ri?: Record<string, { start_point?: number; transformation_shift?: number }>;
};

export type ApiResolvedLinkPreview = {
  owner_connector?: string;
  relation?: string;
  to_connector?: string;
  dimension?: number;
  binding_slot?: number;
};

export type ApiResolvedTreePreview = {
  root_connector?: string | null;
  root_connector_label?: string | null;
  connectors?: ApiResolvedConnectorPreview[];
  links?: ApiResolvedLinkPreview[];
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export const isConnectorRequestBody = (value: unknown): value is ApiConnectorRequestBody => {
  if (!isObjectRecord(value)) return false;
  return (
    typeof value.name === "string" &&
    Array.isArray(value.dimensions) &&
    value.dimensions.every((dimension) => Boolean(dimension && typeof dimension === "object"))
  );
};

export const isResolvedTreePreview = (value: unknown): value is ApiResolvedTreePreview => {
  if (!isObjectRecord(value)) return false;
  return Array.isArray(value.connectors);
};

export const normalizeApiRequestPath = (path?: string) => {
  const raw = typeof path === "string" ? path.trim() : "";
  if (!raw) return "";
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return new URL(raw).pathname.replace(/\/+$/, "");
    }
  } catch {
    // Fall through to raw path normalization.
  }
  return raw.replace(/\/+$/, "");
};

export const isApiPath = (path: string, expected: string) => {
  const normalized = normalizeApiRequestPath(path);
  return normalized === expected || normalized.endsWith(expected);
};

export const parseTransformationPreview = (
  rawValue: string,
): { name: string; args: number[] } | null => {
  const raw = rawValue.trim();
  if (!raw) return null;
  const match = raw.match(/^\s*([^()]+?)(?:\(([^)]*)\))?\s*$/);
  const name = (match?.[1] ?? raw).trim();
  if (!name) return null;
  const argsRaw = (match?.[2] ?? "").trim();
  const args = argsRaw
    ? argsRaw
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value))
    : [];
  return { name, args };
};

export const toConnectorBodyFromDef = (connector: StudioConnectorDef): Record<string, unknown> => ({
  name: connector.name,
  dimensions: connector.dimensions.map((dimension) => ({
    transformations: dimension.transformations.map((tx) => ({
      name: tx.name,
      args: [...tx.args],
    })),
    ...(dimension.composite ? { composite: dimension.composite } : {}),
    ...(Object.keys(dimension.bindings ?? {}).length
      ? { bindings: { ...dimension.bindings } }
      : {}),
  })),
  condition_name: connector.conditionName ?? "",
  condition_args: connector.conditionName ? [...(connector.conditionArgs ?? [])] : [],
  ...(connector.staticRi && Object.keys(connector.staticRi).length
    ? {
        static_ri: Object.fromEntries(
          Object.entries(connector.staticRi).map(([key, value]) => [
            key,
            {
              start_point: toInt(value.startPoint) ?? 0,
              transformation_shift: toInt(value.transformationShift) ?? 0,
            },
          ]),
        ),
      }
    : {}),
});

export const normalizeDeployRequests = (
  preview: ApiDraftPreview | ApiDraftRequest[],
): ApiDraftRequest[] => {
  if (Array.isArray(preview)) {
    return preview.filter((request): request is ApiDraftRequest =>
      Boolean(request && typeof request === "object"),
    );
  }

  if (Array.isArray(preview.deploy_requests)) {
    return preview.deploy_requests.filter((request): request is ApiDraftRequest =>
      Boolean(request && typeof request === "object"),
    );
  }

  const requests = preview.requests;
  if (!requests || typeof requests !== "object") return [];
  const conditions = Array.isArray(requests.conditions) ? requests.conditions : [];
  const transformations = Array.isArray(requests.transformations) ? requests.transformations : [];
  const connectors = Array.isArray(requests.connectors) ? requests.connectors : [];
  return [...conditions, ...transformations, ...connectors].filter(
    (request): request is ApiDraftRequest => Boolean(request && typeof request === "object"),
  );
};
