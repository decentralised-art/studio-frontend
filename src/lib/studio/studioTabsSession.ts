export const STUDIO_TABS_SESSION_STORAGE_KEY = "dcn_studio_tabs_session_v1";
export const STUDIO_TABS_SESSION_VERSION = 1 as const;

export type StudioTabSessionTab = {
  id: string;
  label: string;
  particleId?: string;
};

export type PersistedStudioGraph<TNode = unknown, TEdge = unknown> = {
  nodes: TNode[];
  edges: TEdge[];
};

export type PersistedStudioTreeModel<TNode = unknown, TEdge = unknown> = PersistedStudioGraph<
  TNode,
  TEdge
> & {
  rootConnectorName: string;
};

export type StudioViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type PersistedStudioTabsSession<
  TTab extends StudioTabSessionTab = StudioTabSessionTab,
  TNode = unknown,
  TEdge = unknown,
> = {
  version: number;
  tabs: TTab[];
  activeTabId: string;
  tabGraphs: Record<string, PersistedStudioGraph<TNode, TEdge>>;
  connectorTreeModels: Record<string, PersistedStudioTreeModel<TNode, TEdge>>;
  tabViewports?: Record<string, StudioViewport>;
};

export type RestoredStudioTabsSession<TNode = unknown, TEdge = unknown> = {
  tabs: StudioTabSessionTab[];
  activeTabId: string;
  tabGraphs: Record<string, PersistedStudioGraph<TNode, TEdge>>;
  connectorTreeModels: Record<string, PersistedStudioTreeModel<TNode, TEdge>>;
  tabViewports: Record<string, StudioViewport>;
};

type ReadableStorage = Pick<Storage, "getItem">;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const deepClone = <T>(value: T): T => {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Fallback below handles Proxy/DataCloneError cases.
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

export const sanitizePersistedTabs = (value: unknown): StudioTabSessionTab[] => {
  if (!Array.isArray(value)) return [];
  const sanitized: StudioTabSessionTab[] = [];
  value.forEach((item) => {
    if (!isRecord(item)) return;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const label = typeof item.label === "string" ? item.label.trim() : "";
    if (!id || !label) return;
    const particleId =
      typeof item.particleId === "string" && item.particleId.trim().length > 0
        ? item.particleId.trim()
        : undefined;
    sanitized.push({ id, label, particleId });
  });
  return sanitized;
};

export const sanitizePersistedGraph = <TNode, TEdge>(
  value: unknown,
): PersistedStudioGraph<TNode, TEdge> | null => {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) return null;
  return {
    nodes: deepClone(value.nodes as TNode[]),
    edges: deepClone(value.edges as TEdge[]),
  };
};

export const sanitizePersistedTreeModel = <TNode, TEdge>(
  value: unknown,
): PersistedStudioTreeModel<TNode, TEdge> | null => {
  if (!isRecord(value)) return null;
  const rootConnectorName =
    typeof value.rootConnectorName === "string" ? value.rootConnectorName.trim() : "";
  if (!rootConnectorName) return null;
  const graph = sanitizePersistedGraph<TNode, TEdge>(value);
  if (!graph) return null;
  return {
    rootConnectorName,
    nodes: graph.nodes,
    edges: graph.edges,
  };
};

export const sanitizePersistedViewport = (value: unknown): StudioViewport | null => {
  if (!isRecord(value)) return null;
  const x = Number(value.x);
  const y = Number(value.y);
  const zoom = Number(value.zoom);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom) || zoom <= 0) {
    return null;
  }
  return { x, y, zoom };
};

export const readStudioTabsSession = (
  storage: ReadableStorage | null | undefined,
  key = STUDIO_TABS_SESSION_STORAGE_KEY,
  version = STUDIO_TABS_SESSION_VERSION,
): PersistedStudioTabsSession | null => {
  const raw = storage?.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedStudioTabsSession;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.version !== version) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const buildStudioTabsSessionPayload = <TTab extends StudioTabSessionTab, TNode, TEdge>({
  tabs,
  activeTabId,
  tabGraphs,
  connectorTreeModels,
  tabViewports,
  version = STUDIO_TABS_SESSION_VERSION,
}: {
  tabs: readonly TTab[];
  activeTabId: string;
  tabGraphs: Iterable<readonly [string, PersistedStudioGraph<TNode, TEdge>]>;
  connectorTreeModels: Iterable<readonly [string, PersistedStudioTreeModel<TNode, TEdge>]>;
  tabViewports?: Iterable<readonly [string, StudioViewport]>;
  version?: number;
}): PersistedStudioTabsSession<StudioTabSessionTab, TNode, TEdge> => {
  const graphSnapshots: Record<string, PersistedStudioGraph<TNode, TEdge>> = {};
  for (const [tabId, graph] of tabGraphs) {
    graphSnapshots[tabId] = deepClone({ nodes: graph.nodes, edges: graph.edges });
  }

  const treeModelSnapshots: Record<string, PersistedStudioTreeModel<TNode, TEdge>> = {};
  for (const [tabId, model] of connectorTreeModels) {
    treeModelSnapshots[tabId] = deepClone({
      rootConnectorName: model.rootConnectorName,
      nodes: model.nodes,
      edges: model.edges,
    });
  }

  const viewportSnapshots: Record<string, StudioViewport> = {};
  for (const [tabId, viewport] of tabViewports ?? []) {
    const sanitized = sanitizePersistedViewport(viewport);
    if (sanitized) viewportSnapshots[tabId] = sanitized;
  }

  return {
    version,
    tabs: tabs.map((tab) => ({
      id: tab.id,
      label: tab.label,
      particleId: tab.particleId?.trim() || undefined,
    })),
    activeTabId,
    tabGraphs: graphSnapshots,
    connectorTreeModels: treeModelSnapshots,
    tabViewports: viewportSnapshots,
  };
};

export const restoreStudioTabsSessionPayload = <TNode, TEdge>(
  persisted: PersistedStudioTabsSession | null,
): RestoredStudioTabsSession<TNode, TEdge> | null => {
  if (!persisted) return null;
  const restoredTabs = sanitizePersistedTabs(persisted.tabs);
  if (!restoredTabs.length) return null;

  const tabIds = new Set(restoredTabs.map((tab) => tab.id));
  const tabGraphs: Record<string, PersistedStudioGraph<TNode, TEdge>> = {};
  const connectorTreeModels: Record<string, PersistedStudioTreeModel<TNode, TEdge>> = {};
  const tabViewports: Record<string, StudioViewport> = {};

  restoredTabs.forEach((tab) => {
    tabGraphs[tab.id] = { nodes: [], edges: [] };
  });

  const persistedGraphs = isRecord(persisted.tabGraphs) ? persisted.tabGraphs : {};
  Object.entries(persistedGraphs).forEach(([tabId, graphRaw]) => {
    if (!tabIds.has(tabId)) return;
    const graph = sanitizePersistedGraph<TNode, TEdge>(graphRaw);
    if (!graph) return;
    tabGraphs[tabId] = graph;
  });

  const persistedTreeModels = isRecord(persisted.connectorTreeModels)
    ? persisted.connectorTreeModels
    : {};
  Object.entries(persistedTreeModels).forEach(([tabId, modelRaw]) => {
    if (!tabIds.has(tabId)) return;
    const model = sanitizePersistedTreeModel<TNode, TEdge>(modelRaw);
    if (!model) return;
    connectorTreeModels[tabId] = model;
  });

  const persistedViewports = isRecord(persisted.tabViewports) ? persisted.tabViewports : {};
  Object.entries(persistedViewports).forEach(([tabId, viewportRaw]) => {
    if (!tabIds.has(tabId)) return;
    const viewport = sanitizePersistedViewport(viewportRaw);
    if (!viewport) return;
    tabViewports[tabId] = viewport;
  });

  // Keep connector tree behavior for particle tabs even if only graph snapshots were persisted.
  restoredTabs.forEach((tab) => {
    if (!tab.particleId || connectorTreeModels[tab.id]) return;
    const graph = tabGraphs[tab.id];
    if (!graph || graph.nodes.length === 0) return;
    connectorTreeModels[tab.id] = {
      rootConnectorName: tab.particleId,
      nodes: deepClone(graph.nodes),
      edges: deepClone(graph.edges),
    };
  });

  return {
    tabs: restoredTabs,
    activeTabId: tabIds.has(persisted.activeTabId) ? persisted.activeTabId : restoredTabs[0].id,
    tabGraphs,
    connectorTreeModels,
    tabViewports,
  };
};
