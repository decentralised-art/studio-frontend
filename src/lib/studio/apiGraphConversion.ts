import type { Edge } from "@xyflow/svelte";

import { toProtocolConnectorPayload } from "$lib/chain/connectorContractAdapter";
import {
  isApiPath,
  isConnectorRequestBody,
  isResolvedTreePreview,
  normalizeDeployRequests,
  parseTransformationPreview,
  toConnectorBodyFromDef,
  type ApiDraftPreview,
  type ApiDraftRequest,
  type ApiResolvedConnectorPreview,
  type ApiResolvedTreePreview,
} from "$lib/studio/apiDraftPreview";
import {
  cloneStaticRiMap,
  parseStaticRiPayload,
  resolveConnectorSelfStaticRi,
  toInt,
} from "$lib/studio/connectorGraph";
import type {
  StudioConnectorDef,
  StudioRunningInstanceRef,
} from "$lib/studio/domain/connectorModel";
import {
  formatTransformationPreviewLabel,
  isConnectorKind,
  normalizeKey,
  slugify,
} from "$lib/studio/studioNaming";
import { buildStudioRuntime, type StudioNodeKind } from "$lib/studio/studioRuntime";

export type ApiGraphTransformationInstance = {
  id: string;
  name: string;
  args: number[];
  status: "draft" | "network";
};

export type ApiGraphConnectorRowPreview = {
  dimension: number;
  transformations: string[];
};

export type ApiGraphInputNodeData = {
  label: string;
  kind: StudioNodeKind;
  particleId?: string;
  sourceId?: string;
  viewId?: string;
  dimensions?: number;
  parentFeatureId?: string;
  dimensionIndex?: number;
  transformations?: ApiGraphTransformationInstance[];
  connectorRows?: ApiGraphConnectorRowPreview[];
  conditionLabel?: string | null;
  networkId?: string;
  fromNetwork?: boolean;
  definitionRole?: "root" | "member" | null;
  tabRoot?: boolean;
  hideOutlets?: boolean;
  riStart?: number;
  riShift?: number;
  riLocked?: boolean;
  riPosition?: number;
  staticRi?: Record<string, StudioRunningInstanceRef>;
};

export type ApiGraphInputNode = {
  id: string;
  position: { x: number; y: number };
  data: ApiGraphInputNodeData;
  selected?: boolean;
  type?: string;
  draggable?: boolean;
  hidden?: boolean;
};

export type ApiGraphNodeKind = "particle" | "connector" | "dimension" | "condition";

export type ApiGraphNodeData = Omit<ApiGraphInputNodeData, "kind"> & {
  kind: ApiGraphNodeKind;
};

export type ApiGraphNode = Omit<ApiGraphInputNode, "data"> & {
  data: ApiGraphNodeData;
};

export type ApiGraphTabContext = {
  label: string;
  particleId?: string;
} | null;

export type ApiGraphParticleLookup = {
  id: string;
  name: string;
};

export type ApiResolvedTreeGraphPreview = ApiResolvedTreePreview & {
  connectors: Array<
    ApiResolvedConnectorPreview & {
      node_id: string;
      definition_role: "root" | "member" | null;
    }
  >;
  links: Array<Record<string, unknown>>;
  terminals: Array<{
    node_id: string;
    id: string;
    label: string;
  }>;
};

export type ApiGraphApplyResult = {
  nodes: ApiGraphNode[];
  edges: Edge[];
  rootConnectorName: string;
  rootConnectorLabel: string;
  conditionCodeByNodeId: Map<string, string>;
  transformationCodeById: Map<string, string>;
};

type IdFactory = () => string;

const defaultIdFactory: IdFactory = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

const parseDimensionHandle = (handle?: string | null) => {
  if (!handle || !handle.startsWith("dim-")) return null;
  const value = Number(handle.replace("dim-", ""));
  return Number.isFinite(value) ? value : null;
};

export const resolveApiGraphNodeName = (node: ApiGraphInputNode): string => {
  if (node.data.networkId) return node.data.networkId;
  if (node.data.particleId) return node.data.particleId;
  const slugged = slugify(node.data.label);
  return slugged || node.data.label;
};

const serializeStaticRiForApi = (
  staticRi: Record<string, StudioRunningInstanceRef> | undefined,
) => {
  const normalized = cloneStaticRiMap(staticRi);
  if (!Object.keys(normalized).length) return {};
  return {
    static_ri: Object.fromEntries(
      Object.entries(normalized).map(([key, value]) => [
        key,
        {
          start_point: toInt(value.startPoint) ?? 0,
          transformation_shift: toInt(value.transformationShift) ?? 0,
        },
      ]),
    ),
  };
};

const serializeParsedStaticRiForApi = (staticRi: Record<string, StudioRunningInstanceRef>) => {
  if (!Object.keys(staticRi).length) return {};
  return {
    static_ri: Object.fromEntries(
      Object.entries(staticRi).map(([key, value]) => [
        key,
        {
          start_point: toInt(value.startPoint) ?? 0,
          transformation_shift: toInt(value.transformationShift) ?? 0,
        },
      ]),
    ),
  };
};

export const buildApiConnectorRequestBodyPreview = ({
  activeTab,
  nodes,
  edges,
  selectedConnectorNode,
  deployedConnectors,
  runtimeOverrides,
}: {
  activeTab: ApiGraphTabContext;
  nodes: ApiGraphInputNode[];
  edges: Edge[];
  selectedConnectorNode?: ApiGraphInputNode | null;
  deployedConnectors: Record<string, StudioConnectorDef>;
  runtimeOverrides?: Parameters<typeof buildStudioRuntime>[2];
}): Record<string, unknown> => {
  if (!activeTab) return {};

  try {
    const connectorNodesInGraph = nodes.filter((node) => isConnectorKind(node.data.kind));
    const hasConnectorGraph = connectorNodesInGraph.length > 0;
    const selectedConnectorName = selectedConnectorNode
      ? resolveApiGraphNodeName(selectedConnectorNode)
      : "";
    const runtime = hasConnectorGraph
      ? buildStudioRuntime(
          { nodes, edges },
          { rootLabel: activeTab.label, rootParticleId: activeTab.particleId },
          runtimeOverrides,
        )
      : null;

    const connectorName =
      selectedConnectorName ||
      runtime?.rootConnector ||
      activeTab.particleId ||
      (connectorNodesInGraph[0] ? resolveApiGraphNodeName(connectorNodesInGraph[0]) : "");
    if (!connectorName) return {};

    const fromGraphNetworkNode =
      Boolean(selectedConnectorNode?.data.fromNetwork) ||
      connectorNodesInGraph.some(
        (node) => resolveApiGraphNodeName(node) === connectorName && Boolean(node.data.fromNetwork),
      );
    const def =
      (fromGraphNetworkNode ? deployedConnectors[connectorName] : undefined) ??
      runtime?.registry.connectors[connectorName] ??
      deployedConnectors[connectorName] ??
      null;
    if (!def) return {};

    return toProtocolConnectorPayload(def);
  } catch {
    return {};
  }
};

export const buildApiResolvedConnectorTreePreview = ({
  nodes,
  edges,
  rootParticleId,
}: {
  nodes: ApiGraphInputNode[];
  edges: Edge[];
  rootParticleId?: string | null;
}): ApiResolvedTreeGraphPreview => {
  const visibleNodes = nodes.filter((node) => !node.hidden);
  const connectorNodes = visibleNodes.filter((node) => isConnectorKind(node.data.kind));
  if (!connectorNodes.length) {
    return {
      root_connector: null,
      connectors: [],
      links: [],
      terminals: [],
    };
  }

  const nodesById = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const rootNode =
    connectorNodes.find(
      (node) =>
        rootParticleId &&
        normalizeKey(resolveApiGraphNodeName(node)) === normalizeKey(rootParticleId),
    ) ??
    connectorNodes.find((node) => node.data.definitionRole === "root") ??
    connectorNodes[0];
  const rootConnectorName = resolveApiGraphNodeName(rootNode);
  const links: Array<Record<string, unknown>> = [];
  const linkKeySet = new Set<string>();

  const pushLink = (link: Record<string, unknown>) => {
    const key = JSON.stringify(link);
    if (linkKeySet.has(key)) return;
    linkKeySet.add(key);
    links.push(link);
  };

  edges.forEach((edge) => {
    if (!edge.source || !edge.target) return;
    const sourceNode = nodesById[edge.source] ?? null;
    const targetNode = nodesById[edge.target] ?? null;
    if (!sourceNode || !targetNode) return;

    if (isConnectorKind(sourceNode.data.kind) && isConnectorKind(targetNode.data.kind)) {
      const sourceConnectorName = resolveApiGraphNodeName(sourceNode);
      const targetConnectorName = resolveApiGraphNodeName(targetNode);
      const label = typeof edge.label === "string" ? edge.label.trim() : "";
      const relationFromData =
        edge.data && typeof edge.data === "object"
          ? `${(edge.data as { relation?: unknown; kind?: unknown }).relation ?? (edge.data as { relation?: unknown; kind?: unknown }).kind ?? ""}`
              .trim()
              .toLowerCase()
          : "";
      const relation =
        relationFromData === "binding" || relationFromData === "composite"
          ? relationFromData
          : label.toLowerCase().startsWith("binding")
            ? "binding"
            : label.toLowerCase().startsWith("composite")
              ? "composite"
              : "connector_link";
      const dimension =
        parseDimensionHandle(edge.sourceHandle ?? null) !== null
          ? (parseDimensionHandle(edge.sourceHandle ?? null) ?? 0) + 1
          : null;
      const bindingSlotFromData =
        edge.data && typeof edge.data === "object"
          ? ((edge.data as { bindingSlot?: unknown; binding_slot?: unknown; slot?: unknown })
              .bindingSlot ??
            (edge.data as { bindingSlot?: unknown; binding_slot?: unknown; slot?: unknown })
              .binding_slot ??
            (edge.data as { bindingSlot?: unknown; binding_slot?: unknown; slot?: unknown }).slot)
          : null;
      const bindingSlotNumber =
        Number.isInteger(bindingSlotFromData) && Number(bindingSlotFromData) >= 0
          ? Number(bindingSlotFromData)
          : null;
      const bindingSlotMatch = label.match(/slot\s+(\d+)/i);
      pushLink({
        owner_connector: sourceConnectorName,
        from_connector: sourceConnectorName,
        to_connector: targetConnectorName,
        relation,
        ...(dimension !== null ? { dimension } : {}),
        ...(bindingSlotNumber !== null
          ? { binding_slot: bindingSlotNumber }
          : bindingSlotMatch
            ? { binding_slot: Number(bindingSlotMatch[1]) }
            : {}),
        ...(label ? { label } : {}),
      });
      return;
    }

    if (
      sourceNode.data.kind === "dimension" &&
      (isConnectorKind(targetNode.data.kind) || targetNode.data.kind === "particle")
    ) {
      const ownerConnector = sourceNode.data.parentFeatureId
        ? (nodesById[sourceNode.data.parentFeatureId] ?? null)
        : null;
      if (!ownerConnector || !isConnectorKind(ownerConnector.data.kind)) return;
      const ownerConnectorName = resolveApiGraphNodeName(ownerConnector);
      const targetName = isConnectorKind(targetNode.data.kind)
        ? resolveApiGraphNodeName(targetNode)
        : (targetNode.data.particleId ?? resolveApiGraphNodeName(targetNode));
      const dimension =
        typeof sourceNode.data.dimensionIndex === "number"
          ? sourceNode.data.dimensionIndex + 1
          : null;
      pushLink({
        owner_connector: ownerConnectorName,
        from_connector: ownerConnectorName,
        to: targetName,
        to_type: isConnectorKind(targetNode.data.kind) ? "connector" : "terminal_particle",
        relation: isConnectorKind(targetNode.data.kind) ? "composite_or_binding" : "terminal",
        ...(dimension !== null ? { dimension } : {}),
      });
    }
  });

  return {
    root_connector: rootConnectorName,
    root_connector_label: rootNode.data.label,
    connectors: connectorNodes.map((node) => ({
      node_id: node.id,
      name: resolveApiGraphNodeName(node),
      label: node.data.label,
      dimensions: Math.max(1, Math.round(node.data.dimensions ?? 1)),
      connector_rows: node.data.connectorRows ?? [],
      condition: node.data.conditionLabel ?? "",
      from_network: Boolean(node.data.fromNetwork),
      definition_role: node.data.definitionRole ?? null,
      ...serializeStaticRiForApi(node.data.staticRi),
    })),
    links,
    terminals: visibleNodes
      .filter((node) => node.data.kind === "particle")
      .map((node) => ({
        node_id: node.id,
        id: node.data.particleId ?? resolveApiGraphNodeName(node),
        label: node.data.label,
      })),
  };
};

export const convertResolvedTreePreviewToDraft = ({
  resolved,
  currentResolved,
  deployedConnectors,
}: {
  resolved: ApiResolvedTreePreview;
  currentResolved: ApiResolvedTreePreview;
  deployedConnectors: Record<string, StudioConnectorDef>;
}): {
  preview: ApiDraftPreview;
  readOnlyByName: Map<string, boolean>;
} => {
  const connectorByName = new Map<string, ApiResolvedConnectorPreview>();
  const readOnlyByName = new Map<string, boolean>();

  (resolved.connectors ?? []).forEach((connector) => {
    const name = `${connector.name ?? ""}`.trim();
    if (!name) return;
    connectorByName.set(name, connector);
    if (connector.from_network) {
      readOnlyByName.set(name, true);
    }
  });

  (currentResolved.connectors ?? []).forEach((connector) => {
    const name = `${connector.name ?? ""}`.trim();
    if (!name || !connector.from_network) return;
    readOnlyByName.set(name, true);
    connectorByName.set(name, connector);
  });

  const readOnlyOwners = new Set(
    Array.from(readOnlyByName.entries())
      .filter(([, flag]) => flag)
      .map(([name]) => name),
  );

  const inputLinks = (resolved.links ?? []).filter((link) =>
    Boolean(link && typeof link === "object"),
  );
  const currentReadOnlyLinks = (currentResolved.links ?? []).filter((link) => {
    const owner = `${link.owner_connector ?? ""}`.trim();
    return owner.length > 0 && readOnlyOwners.has(owner);
  });
  const mutableInputLinks = inputLinks.filter((link) => {
    const owner = `${link.owner_connector ?? ""}`.trim();
    return owner.length === 0 || !readOnlyOwners.has(owner);
  });
  const mergedLinks = [...mutableInputLinks, ...currentReadOnlyLinks];

  const connectorBodyByName = new Map<string, Record<string, unknown>>();
  connectorByName.forEach((connector, name) => {
    const isReadOnly = readOnlyByName.get(name) ?? false;
    if (isReadOnly && deployedConnectors[name]) {
      connectorBodyByName.set(name, toConnectorBodyFromDef(deployedConnectors[name]));
      return;
    }

    const rows = Array.isArray(connector.connector_rows) ? connector.connector_rows : [];
    const inferredDimensionsFromRows = rows.reduce((max, row) => {
      const dim = Number(row?.dimension ?? 0);
      return Number.isFinite(dim) ? Math.max(max, Math.trunc(dim)) : max;
    }, 0);
    const configuredDimensions = Math.max(
      1,
      Math.trunc(Number(connector.dimensions ?? inferredDimensionsFromRows ?? 1)),
    );
    const dimensions = Array.from({ length: configuredDimensions }, () => ({
      transformations: [] as Array<{ name: string; args: number[] }>,
      composite: "",
      bindings: {} as Record<string, string>,
    }));

    rows.forEach((row) => {
      const dim = Number(row?.dimension ?? 0);
      const dimIndex = Number.isFinite(dim) ? Math.trunc(dim) - 1 : -1;
      if (dimIndex < 0 || dimIndex >= dimensions.length) return;
      const dimension = dimensions[dimIndex];
      if (!dimension) return;
      const txLabels = Array.isArray(row?.transformations) ? row.transformations : [];
      const parsed = txLabels
        .map((label) => parseTransformationPreview(`${label ?? ""}`))
        .filter((value): value is { name: string; args: number[] } => Boolean(value));
      dimension.transformations = parsed;
    });

    const staticRi = parseStaticRiPayload(connector.static_ri);

    connectorBodyByName.set(name, {
      name,
      dimensions: dimensions.map((dimension) => ({
        transformations: dimension.transformations.map((tx) => ({
          name: tx.name,
          args: [...tx.args],
        })),
        ...(dimension.composite ? { composite: dimension.composite } : {}),
        ...(Object.keys(dimension.bindings).length ? { bindings: { ...dimension.bindings } } : {}),
      })),
      condition_name: `${connector.condition ?? ""}`.trim(),
      condition_args: [],
      ...serializeParsedStaticRiForApi(staticRi),
    });
  });

  mergedLinks.forEach((link) => {
    const owner = `${link.owner_connector ?? ""}`.trim();
    if (!owner || readOnlyByName.get(owner)) return;
    const body = connectorBodyByName.get(owner);
    if (!body) return;

    const dimensions = Array.isArray(body.dimensions)
      ? (body.dimensions as Array<Record<string, unknown>>)
      : [];
    const dimensionNumber = Number(link.dimension ?? 0);
    const dimensionIndex = Number.isFinite(dimensionNumber) ? Math.trunc(dimensionNumber) - 1 : -1;
    if (dimensionIndex < 0 || dimensionIndex >= dimensions.length) return;
    const dimension = dimensions[dimensionIndex];
    if (!dimension) return;
    const relation = `${link.relation ?? ""}`.trim().toLowerCase();
    const target = `${link.to_connector ?? ""}`.trim();
    if (!target) return;

    if (relation === "composite") {
      dimension.composite = target;
      return;
    }

    if (relation === "binding") {
      const slot = Number(link.binding_slot);
      if (!Number.isInteger(slot) || slot < 0) return;
      const bindings =
        dimension.bindings &&
        typeof dimension.bindings === "object" &&
        !Array.isArray(dimension.bindings)
          ? (dimension.bindings as Record<string, string>)
          : {};
      bindings[String(slot)] = target;
      dimension.bindings = bindings;
    }
  });

  const connectorBodies = Array.from(connectorBodyByName.values());
  const rootConnector = `${resolved.root_connector ?? ""}`.trim();
  const fallbackRoot =
    rootConnector ||
    (connectorBodies.length
      ? `${(connectorBodies[0] as Record<string, unknown>).name ?? ""}`.trim()
      : "");

  return {
    preview: {
      root_connector: fallbackRoot || null,
      deploy_requests: connectorBodies.map((body) => ({
        method: "POST",
        path: "/chain/connector",
        body,
      })),
    },
    readOnlyByName,
  };
};

const normalizeApiPreviewInput = ({
  parsedRaw,
  currentResolved,
  deployedConnectors,
}: {
  parsedRaw: unknown;
  currentResolved: ApiResolvedTreePreview;
  deployedConnectors: Record<string, StudioConnectorDef>;
}): {
  parsed: ApiDraftPreview;
  connectorReadOnlyByName: Map<string, boolean>;
  connectorLabelByName: Map<string, string>;
  requestedRootLabelFromResolved: string;
} => {
  let normalizedRaw = parsedRaw;
  let connectorReadOnlyByName = new Map<string, boolean>();
  let connectorLabelByName = new Map<string, string>();
  let requestedRootLabelFromResolved = "";

  if (isResolvedTreePreview(normalizedRaw)) {
    requestedRootLabelFromResolved =
      typeof normalizedRaw.root_connector_label === "string"
        ? normalizedRaw.root_connector_label.trim()
        : "";
    connectorLabelByName = new Map(
      (normalizedRaw.connectors ?? [])
        .map((connector) => {
          const name = `${connector.name ?? ""}`.trim();
          const label = `${connector.label ?? ""}`.trim();
          return name && label ? ([name, label] as const) : null;
        })
        .filter((entry): entry is readonly [string, string] => Boolean(entry)),
    );
    const converted = convertResolvedTreePreviewToDraft({
      resolved: normalizedRaw,
      currentResolved,
      deployedConnectors,
    });
    normalizedRaw = converted.preview;
    connectorReadOnlyByName = converted.readOnlyByName;
  }

  const parsed: ApiDraftPreview = isConnectorRequestBody(normalizedRaw)
    ? ({
        root_connector: normalizedRaw.name?.trim() ?? "",
        deploy_requests: [
          {
            method: "POST",
            path: "/chain/connector",
            body: normalizedRaw as Record<string, unknown>,
          },
        ],
      } satisfies ApiDraftPreview)
    : Array.isArray(normalizedRaw)
      ? ({ deploy_requests: normalizedRaw as ApiDraftRequest[] } satisfies ApiDraftPreview)
      : ((normalizedRaw as ApiDraftPreview) ?? {});

  return {
    parsed,
    connectorReadOnlyByName,
    connectorLabelByName,
    requestedRootLabelFromResolved,
  };
};

const createTransformationInstance = (
  idFactory: IdFactory,
  name: string,
  args: number[] = [],
  status: ApiGraphTransformationInstance["status"] = "draft",
): ApiGraphTransformationInstance => ({
  id: `tx-${idFactory()}`,
  name,
  args,
  status,
});

const createDimensionNode = (
  idFactory: IdFactory,
  connector: ApiGraphNode,
  dimensionIndex: number,
  totalDimensions: number,
): ApiGraphNode => {
  const spacing = 200;
  const rowY = connector.position.y + 160;
  const startX = connector.position.x - ((Math.max(1, totalDimensions) - 1) * spacing) / 2;
  return {
    id: `dimension-${connector.id}-${dimensionIndex}-${idFactory()}`,
    type: "dimension",
    hidden: true,
    draggable: false,
    position: {
      x: startX + dimensionIndex * spacing,
      y: rowY,
    },
    data: {
      label: `#${dimensionIndex + 1}`,
      kind: "dimension",
      parentFeatureId: connector.id,
      dimensionIndex,
      transformations: [],
      fromNetwork: connector.data.fromNetwork ?? false,
      riStart: 0,
      riShift: 0,
      riLocked: false,
    },
  };
};

const extractNamedSources = (requests: ApiDraftRequest[], expectedPath: string) => {
  const sourceByName = new Map<string, string>();
  requests
    .filter((request) => isApiPath(request.path ?? "", expectedPath))
    .forEach((req) => {
      if (!req?.body || typeof req.body !== "object") return;
      const body = req.body as Record<string, unknown>;
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const src = typeof body.sol_src === "string" ? body.sol_src : "";
      if (!name) return;
      sourceByName.set(name, src);
    });
  return sourceByName;
};

const inferRootConnectorName = (
  connectorBodies: Record<string, unknown>[],
  connectorBodyByName: Map<string, Record<string, unknown>>,
  requestedRootConnector: string,
) => {
  const connectorNames = connectorBodies
    .map((body) => String(body.name ?? "").trim())
    .filter((name) => name.length > 0);
  if (!connectorNames.length) {
    throw new Error("Each connector request body must include a connector name.");
  }

  const referencedConnectorNames = new Set<string>();
  connectorBodies.forEach((body) => {
    const dimensions = Array.isArray(body.dimensions)
      ? (body.dimensions as Array<Record<string, unknown>>)
      : [];
    dimensions.forEach((dimension) => {
      const compositeName =
        typeof dimension.composite === "string" ? dimension.composite.trim() : "";
      if (compositeName) referencedConnectorNames.add(compositeName);
      const bindings =
        dimension.bindings && typeof dimension.bindings === "object"
          ? (dimension.bindings as Record<string, unknown>)
          : {};
      Object.values(bindings).forEach((targetRaw) => {
        const targetName = typeof targetRaw === "string" ? targetRaw.trim() : "";
        if (targetName) referencedConnectorNames.add(targetName);
      });
    });
  });

  const inferredRootConnector =
    connectorNames.find((name) => !referencedConnectorNames.has(name)) ?? connectorNames[0];

  let rootConnectorName = requestedRootConnector || inferredRootConnector;
  let requestedRootLabelFallback = "";
  if (requestedRootConnector && !connectorBodyByName.has(requestedRootConnector)) {
    rootConnectorName = inferredRootConnector;
    requestedRootLabelFallback = requestedRootConnector;
  }
  if (!rootConnectorName) {
    throw new Error("root_connector is required (or inferable from connector dependencies).");
  }
  const rootConnectorBody = connectorBodyByName.get(rootConnectorName);
  if (!rootConnectorBody) {
    throw new Error(`Connector request for "${rootConnectorName}" is required.`);
  }

  return { rootConnectorName, requestedRootLabelFallback, connectorNames };
};

const buildConnectorAdjacency = (
  connectorNames: string[],
  connectorBodies: Record<string, unknown>[],
  connectorBodyByName: Map<string, Record<string, unknown>>,
) => {
  const adjacency = new Map<string, string[]>();
  connectorNames.forEach((name) => adjacency.set(name, []));
  connectorBodies.forEach((body) => {
    const sourceName = String(body.name ?? "").trim();
    if (!sourceName) return;
    const dimensions = Array.isArray(body.dimensions)
      ? (body.dimensions as Array<Record<string, unknown>>)
      : [];
    const children: string[] = [];
    dimensions.forEach((dimension) => {
      const compositeName =
        typeof dimension.composite === "string" ? dimension.composite.trim() : "";
      if (compositeName && connectorBodyByName.has(compositeName)) {
        children.push(compositeName);
      }
      const bindings =
        dimension.bindings && typeof dimension.bindings === "object"
          ? (dimension.bindings as Record<string, unknown>)
          : {};
      Object.values(bindings).forEach((targetRaw) => {
        const targetName = typeof targetRaw === "string" ? targetRaw.trim() : "";
        if (targetName && connectorBodyByName.has(targetName)) {
          children.push(targetName);
        }
      });
    });
    adjacency.set(sourceName, Array.from(new Set(children)));
  });
  return adjacency;
};

const orderConnectorsForLayout = (
  connectorNames: string[],
  rootConnectorName: string,
  adjacency: Map<string, string[]>,
) => {
  const connectorLevel = new Map<string, number>();
  const queue: string[] = [];
  const queued = new Set<string>();
  const orderedConnectorNames: string[] = [];
  const pushConnector = (name: string) => {
    if (!name || queued.has(name)) return;
    queued.add(name);
    queue.push(name);
  };
  pushConnector(rootConnectorName);
  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    orderedConnectorNames.push(current);
    const level = connectorLevel.has(current) ? (connectorLevel.get(current) ?? 0) : 0;
    connectorLevel.set(current, level);
    (adjacency.get(current) ?? []).forEach((childName) => {
      const nextLevel = level + 1;
      if (!connectorLevel.has(childName) || (connectorLevel.get(childName) ?? 0) > nextLevel) {
        connectorLevel.set(childName, nextLevel);
      }
      pushConnector(childName);
    });
  }
  connectorNames.forEach((name) => {
    if (!orderedConnectorNames.includes(name)) orderedConnectorNames.push(name);
    if (!connectorLevel.has(name)) connectorLevel.set(name, 0);
  });
  return { orderedConnectorNames, connectorLevel };
};

export const buildApiGraphFromPreviewJson = ({
  rawJson,
  currentResolved,
  deployedConnectors,
  networkParticles = [],
  idFactory = defaultIdFactory,
}: {
  rawJson: string;
  currentResolved: ApiResolvedTreePreview;
  deployedConnectors: Record<string, StudioConnectorDef>;
  networkParticles?: ApiGraphParticleLookup[];
  idFactory?: IdFactory;
}): ApiGraphApplyResult => {
  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(rawJson) as unknown;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Invalid JSON.");
  }

  const { parsed, connectorReadOnlyByName, connectorLabelByName, requestedRootLabelFromResolved } =
    normalizeApiPreviewInput({
      parsedRaw,
      currentResolved,
      deployedConnectors,
    });

  const deployRequests = normalizeDeployRequests(parsed);
  if (!deployRequests.length) {
    throw new Error(
      "JSON must be a connector body or include deploy_requests (or legacy requests.conditions/transformations/connectors).",
    );
  }

  const connectorReqs = deployRequests.filter((request) =>
    isApiPath(request.path ?? "", "/chain/connector"),
  );
  const connectorBodies = connectorReqs
    .map((request) =>
      request?.body && typeof request.body === "object"
        ? (request.body as Record<string, unknown>)
        : null,
    )
    .filter((body): body is Record<string, unknown> => Boolean(body));
  if (!connectorBodies.length) {
    throw new Error("deploy_requests must include at least one POST /chain/connector body.");
  }

  const connectorBodyByName = new Map<string, Record<string, unknown>>();
  connectorBodies.forEach((body) => {
    const name = String(body.name ?? "").trim();
    if (!name) return;
    connectorBodyByName.set(name, body);
  });

  const requestedRootConnector =
    typeof parsed.root_connector === "string" ? parsed.root_connector.trim() : "";
  const { rootConnectorName, requestedRootLabelFallback, connectorNames } = inferRootConnectorName(
    connectorBodies,
    connectorBodyByName,
    requestedRootConnector,
  );

  const conditionSourceByName = extractNamedSources(deployRequests, "/chain/condition");
  const transformationSourceByName = extractNamedSources(deployRequests, "/chain/transformation");

  const nextNodes: ApiGraphNode[] = [];
  const nextEdges: Edge[] = [];
  const connectorNodeByName = new Map<string, ApiGraphNode>();
  const particleNodeByName = new Map<string, ApiGraphNode>();
  const conditionNodeByName = new Map<string, ApiGraphNode>();
  const conditionCodeByNodeId = new Map<string, string>();
  const transformationCodeById = new Map<string, string>();
  const edgeKeySet = new Set<string>();

  const adjacency = buildConnectorAdjacency(connectorNames, connectorBodies, connectorBodyByName);
  const { orderedConnectorNames, connectorLevel } = orderConnectorsForLayout(
    connectorNames,
    rootConnectorName,
    adjacency,
  );

  const levelCounters = new Map<number, number>();
  orderedConnectorNames.forEach((connectorName) => {
    const connectorBody = connectorBodyByName.get(connectorName);
    if (!connectorBody) return;
    const connectorIsReadOnly = connectorReadOnlyByName.get(connectorName) ?? false;
    const dimensionsRaw = Array.isArray(connectorBody.dimensions)
      ? (connectorBody.dimensions as Array<Record<string, unknown>>)
      : [];
    if (!dimensionsRaw.length) return;
    const level = connectorLevel.get(connectorName) ?? 0;
    const rowIndex = levelCounters.get(level) ?? 0;
    levelCounters.set(level, rowIndex + 1);

    const connectorRowsFromApi: ApiGraphConnectorRowPreview[] = dimensionsRaw.map(
      (dimension, dimIndex) => {
        const txDefs = Array.isArray(dimension.transformations)
          ? (dimension.transformations as Array<Record<string, unknown>>)
          : [];
        const transformations = txDefs
          .map((tx) => {
            const name = typeof tx.name === "string" ? tx.name.trim() : "";
            if (!name) return null;
            const args = Array.isArray(tx.args)
              ? tx.args.map((arg) => Number(arg)).filter((arg) => Number.isFinite(arg))
              : [];
            return formatTransformationPreviewLabel(name, args);
          })
          .filter((value): value is string => Boolean(value));
        return {
          dimension: dimIndex + 1,
          transformations,
        };
      },
    );
    const staticRiFromApi = parseStaticRiPayload(
      (connectorBody as { static_ri?: unknown }).static_ri,
    );
    const selfStaticRiFromApi = resolveConnectorSelfStaticRi(staticRiFromApi);

    const connectorNode: ApiGraphNode = {
      id: `feature-${idFactory()}`,
      type: "connector",
      draggable: false,
      position: { x: 260 + level * 360, y: 80 + rowIndex * 320 },
      data: {
        label:
          (connectorName === rootConnectorName
            ? requestedRootLabelFromResolved || requestedRootLabelFallback
            : "") ||
          connectorLabelByName.get(connectorName) ||
          connectorName,
        kind: "connector",
        dimensions: dimensionsRaw.length,
        connectorRows: connectorRowsFromApi,
        fromNetwork: connectorIsReadOnly,
        tabRoot: connectorName === rootConnectorName,
        hideOutlets: connectorIsReadOnly && (adjacency.get(connectorName)?.length ?? 0) === 0,
        riStart: selfStaticRiFromApi?.startPoint ?? 0,
        riShift: selfStaticRiFromApi?.transformationShift ?? 0,
        riLocked: Boolean(selfStaticRiFromApi),
        riPosition: undefined,
        staticRi: staticRiFromApi,
      },
    };
    connectorNodeByName.set(connectorName, connectorNode);
    nextNodes.push(connectorNode);
  });

  const addEdgeIfMissing = (edge: Omit<Edge, "id">) => {
    const relationPart =
      edge.data && typeof edge.data === "object"
        ? `${(edge.data as { relation?: unknown; kind?: unknown }).relation ?? (edge.data as { relation?: unknown; kind?: unknown }).kind ?? ""}`
        : "";
    const bindingSlotPart =
      edge.data && typeof edge.data === "object"
        ? `${(edge.data as { bindingSlot?: unknown; binding_slot?: unknown; slot?: unknown }).bindingSlot ?? (edge.data as { bindingSlot?: unknown; binding_slot?: unknown; slot?: unknown }).binding_slot ?? (edge.data as { bindingSlot?: unknown; binding_slot?: unknown; slot?: unknown }).slot ?? ""}`
        : "";
    const key = `${edge.source}|${edge.sourceHandle ?? ""}|${edge.target}|${edge.targetHandle ?? ""}|${relationPart}|${bindingSlotPart}|${edge.label ?? ""}`;
    if (edgeKeySet.has(key)) return;
    edgeKeySet.add(key);
    nextEdges.push({
      id: `edge-${idFactory()}`,
      ...edge,
    });
  };

  connectorBodies.forEach((connectorBody) => {
    const connectorName = String(connectorBody.name ?? "").trim();
    const connectorNode = connectorNodeByName.get(connectorName) ?? null;
    if (!connectorNode) return;
    const connectorIsReadOnly = connectorReadOnlyByName.get(connectorName) ?? false;

    const conditionName =
      typeof connectorBody.condition_name === "string" ? connectorBody.condition_name.trim() : "";
    if (conditionName) {
      let conditionNode = conditionNodeByName.get(conditionName) ?? null;
      if (!conditionNode) {
        const isDraftCondition = conditionSourceByName.has(conditionName);
        conditionNode = {
          id: `condition-${idFactory()}`,
          type: "condition",
          draggable: false,
          position: {
            x: connectorNode.position.x,
            y: connectorNode.position.y - 120,
          },
          data: {
            label: conditionName,
            kind: "condition",
            fromNetwork: !isDraftCondition,
            ...(isDraftCondition ? {} : { networkId: conditionName }),
          },
        };
        conditionNodeByName.set(conditionName, conditionNode);
        nextNodes.push(conditionNode);
        if (isDraftCondition) {
          conditionCodeByNodeId.set(
            conditionNode.id,
            conditionSourceByName.get(conditionName) ?? "",
          );
        }
      }
      addEdgeIfMissing({
        source: conditionNode.id,
        sourceHandle: "out",
        target: connectorNode.id,
        targetHandle: "in",
      });
    }

    const dimensionsRaw = Array.isArray(connectorBody.dimensions)
      ? (connectorBody.dimensions as Array<Record<string, unknown>>)
      : [];
    dimensionsRaw.forEach((dimension, dimIndex) => {
      const dimNode = createDimensionNode(idFactory, connectorNode, dimIndex, dimensionsRaw.length);
      const txDefs = Array.isArray(dimension.transformations)
        ? (dimension.transformations as Array<Record<string, unknown>>)
        : [];
      const txInstances = txDefs
        .map((tx) => {
          const name = typeof tx.name === "string" ? tx.name.trim() : "";
          if (!name) return null;
          const args = Array.isArray(tx.args)
            ? tx.args.map((arg) => Number(arg)).filter((arg) => Number.isFinite(arg))
            : [];
          const isDraft = transformationSourceByName.has(name) || !connectorIsReadOnly;
          return createTransformationInstance(idFactory, name, args, isDraft ? "draft" : "network");
        })
        .filter((value): value is ApiGraphTransformationInstance => Boolean(value));

      dimNode.data = {
        ...dimNode.data,
        transformations: txInstances,
      };
      nextNodes.push(dimNode);
      addEdgeIfMissing({
        source: connectorNode.id,
        sourceHandle: `dim-${dimIndex}`,
        target: dimNode.id,
        targetHandle: "in",
      });

      txInstances.forEach((tx) => {
        if (tx.status !== "draft") return;
        const source = transformationSourceByName.get(tx.name);
        if (source) transformationCodeById.set(tx.id, source);
      });

      const bindingEntries =
        dimension.bindings && typeof dimension.bindings === "object"
          ? Object.entries(dimension.bindings as Record<string, unknown>)
              .filter(([slot]) => /^\d+$/.test(slot.trim()))
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([slot, targetRaw]) => ({
                slotId: Number(slot),
                targetName: typeof targetRaw === "string" ? targetRaw.trim() : "",
              }))
              .filter(
                (value) => Number.isInteger(value.slotId) && value.slotId >= 0 && value.targetName,
              )
          : [];
      const compositeName =
        typeof dimension.composite === "string" ? dimension.composite.trim() : "";
      const targets: Array<{
        relation: "composite" | "binding";
        targetName: string;
        slotId?: number;
      }> = [
        ...(compositeName ? [{ relation: "composite" as const, targetName: compositeName }] : []),
        ...bindingEntries.map((binding) => ({
          relation: "binding" as const,
          targetName: binding.targetName,
          slotId: binding.slotId,
        })),
      ];

      targets.forEach((item, targetIndex) => {
        const targetName = item.targetName;
        const targetConnectorNode = connectorNodeByName.get(targetName) ?? null;
        if (targetConnectorNode) {
          addEdgeIfMissing({
            source: connectorNode.id,
            sourceHandle: `dim-${dimIndex}`,
            target: targetConnectorNode.id,
            targetHandle: "in",
            ...(item.relation === "composite"
              ? {
                  label: `composite · D${dimIndex + 1}`,
                  data: { relation: "composite" },
                }
              : {
                  label: `binding · slot ${item.slotId ?? 0}`,
                  data: {
                    relation: "binding",
                    bindingSlot: item.slotId ?? 0,
                    bindingOwnerName: connectorName,
                  },
                  style: "stroke:#c97500;stroke-dasharray:8 5;",
                }),
          });
          return;
        }

        let particleNode = particleNodeByName.get(targetName) ?? null;
        if (!particleNode) {
          const particleMeta = networkParticles.find((item) => item.id === targetName);
          particleNode = {
            id: `particle-${idFactory()}`,
            type: "particle",
            draggable: false,
            position: {
              x: dimNode.position.x + targetIndex * 120,
              y: dimNode.position.y + 180,
            },
            data: {
              label: particleMeta?.name ?? targetName,
              kind: "particle",
              particleId: targetName,
              networkId: targetName,
              fromNetwork: true,
            },
          };
          particleNodeByName.set(targetName, particleNode);
          nextNodes.push(particleNode);
        }

        addEdgeIfMissing({
          source: connectorNode.id,
          sourceHandle: `dim-${dimIndex}`,
          target: particleNode.id,
          targetHandle: "in",
          ...(item.relation === "composite"
            ? {
                label: `composite · D${dimIndex + 1}`,
                data: { relation: "composite" },
              }
            : {
                label: `binding · slot ${item.slotId ?? 0}`,
                data: {
                  relation: "binding",
                  bindingSlot: item.slotId ?? 0,
                  bindingOwnerName: connectorName,
                },
                style: "stroke:#c97500;stroke-dasharray:8 5;",
              }),
        });
      });
    });
  });

  const rootConnectorLabel =
    requestedRootLabelFromResolved ||
    requestedRootLabelFallback ||
    connectorLabelByName.get(rootConnectorName) ||
    rootConnectorName;

  return {
    nodes: nextNodes,
    edges: nextEdges,
    rootConnectorName,
    rootConnectorLabel,
    conditionCodeByNodeId,
    transformationCodeById,
  };
};
