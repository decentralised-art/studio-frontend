import { isOwnedLocalEntity, isPublishedChainAddress } from "./studioEntityOrigin";

export type StudioWorkspaceNode = {
  id: string;
  data: {
    kind?: string;
    label?: string;
    networkId?: string;
    particleId?: string;
    tabRoot?: boolean;
    fromNetwork?: boolean;
    parentFeatureId?: string;
  };
};

export type StudioWorkspaceEdge = { source: string; target: string };

const isConnector = (node: StudioWorkspaceNode): boolean =>
  node.data.kind === "connector" || node.data.kind === "feature";

export const getStudioWorkspaceConnectorName = (node: StudioWorkspaceNode): string =>
  node.data.networkId?.trim() || node.data.particleId?.trim() || node.data.label?.trim() || "";

export type StudioWorkspaceRoot<T extends StudioWorkspaceNode> = {
  root: T | null;
  candidates: T[];
  ambiguous: boolean;
};

type StudioWorkspaceGraph = {
  nodes: readonly StudioWorkspaceNode[];
  edges: readonly StudioWorkspaceEdge[];
};

const workspaceRelations = (input: StudioWorkspaceGraph) => {
  const byId = new Map(input.nodes.map((node) => [node.id, node]));
  const connectorIds = new Set(input.nodes.filter(isConnector).map((node) => node.id));
  const parents = new Map<string, Set<string>>();
  const dimensionOwners = new Map<string, Set<string>>();
  const attachedConditions = new Map<string, Set<string>>();
  const addOwner = (dimensionId: string, ownerId: string) => {
    if (!connectorIds.has(ownerId)) return;
    const owners = dimensionOwners.get(dimensionId) ?? new Set<string>();
    owners.add(ownerId);
    dimensionOwners.set(dimensionId, owners);
  };
  input.nodes.forEach((node) => {
    if (node.data.kind === "dimension" && node.data.parentFeatureId)
      addOwner(node.id, node.data.parentFeatureId);
  });
  input.edges.forEach((edge) => {
    if (connectorIds.has(edge.source) && byId.get(edge.target)?.data.kind === "dimension")
      addOwner(edge.target, edge.source);
  });
  const addParent = (childId: string, parentId: string) => {
    const owners = parents.get(childId) ?? new Set<string>();
    owners.add(parentId);
    parents.set(childId, owners);
  };
  input.edges.forEach((edge) => {
    const target = byId.get(edge.target);
    if (!target || (!connectorIds.has(edge.target) && target.data.kind !== "particle")) return;
    if (connectorIds.has(edge.source)) addParent(edge.target, edge.source);
    else if (byId.get(edge.source)?.data.kind === "dimension")
      dimensionOwners.get(edge.source)?.forEach((parentId) => addParent(edge.target, parentId));
    else if (connectorIds.has(edge.target) && byId.get(edge.source)?.data.kind === "condition") {
      const conditions = attachedConditions.get(edge.target) ?? new Set<string>();
      conditions.add(edge.source);
      attachedConditions.set(edge.target, conditions);
    }
  });
  return { byId, connectorIds, parents, dimensionOwners, attachedConditions };
};

export const resolveStudioWorkspaceRoot = <T extends StudioWorkspaceNode>(input: {
  nodes: readonly T[];
  edges: readonly StudioWorkspaceEdge[];
  requestedRootId?: string | null;
  requestedRootName?: string | null;
}): StudioWorkspaceRoot<T> => {
  const { byId, parents } = workspaceRelations(input);
  const connectors = input.nodes.filter(isConnector);
  const candidates = connectors.filter((node) => !parents.get(node.id)?.size);
  const candidateIds = new Set(candidates.map((node) => node.id));
  const result = (root: T | null): StudioWorkspaceRoot<T> => ({
    root,
    candidates,
    ambiguous: root === null && connectors.length > 0,
  });
  const requestedId = input.requestedRootId?.trim();
  const requestedName = input.requestedRootName?.trim();
  const requestedById = candidates.find((node) => node.id === requestedId);
  if (requestedById) return result(requestedById);
  const requestedByName = requestedName
    ? candidates.filter((node) => getStudioWorkspaceConnectorName(node) === requestedName)
    : [];
  if (requestedByName.length === 1) return result(requestedByName[0]);

  const attachedRootIds = new Set<string>();
  const collectOuterRoots = (nodeId: string) => {
    const pending = [nodeId];
    const visited = new Set<string>();
    while (pending.length) {
      const currentId = pending.pop()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      if (candidateIds.has(currentId)) attachedRootIds.add(currentId);
      else parents.get(currentId)?.forEach((parentId) => pending.push(parentId));
    }
  };
  input.edges.forEach((edge) => {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (source?.data.kind === "plugin" && target && isConnector(target))
      collectOuterRoots(target.id);
    if (target?.data.kind === "plugin" && source && isConnector(source))
      collectOuterRoots(source.id);
  });
  if (attachedRootIds.size === 1) {
    const attached = candidates.find((node) => attachedRootIds.has(node.id));
    if (attached) return result(attached);
  }
  const markedRoots = candidates.filter((node) => node.data.tabRoot);
  if (markedRoots.length === 1) return result(markedRoots[0]);
  return result(candidates.length === 1 ? candidates[0] : null);
};

export const collectStudioWorkspaceRootGraph = <
  TNode extends StudioWorkspaceNode,
  TEdge extends StudioWorkspaceEdge,
>(input: {
  nodes: readonly TNode[];
  edges: readonly TEdge[];
  requestedRootId?: string | null;
  requestedRootName?: string | null;
}): StudioWorkspaceRoot<TNode> & { nodes: TNode[]; edges: TEdge[] } => {
  const selection = resolveStudioWorkspaceRoot(input);
  const relations = workspaceRelations(input);
  const included = new Set<string>();
  const pending = selection.root ? [selection.root.id] : [];
  while (pending.length) {
    const nodeId = pending.pop()!;
    if (included.has(nodeId)) continue;
    included.add(nodeId);
    const current = relations.byId.get(nodeId);
    if (!current || !isConnector(current)) continue;
    relations.dimensionOwners.forEach((owners, dimensionId) => {
      if (owners.has(nodeId)) included.add(dimensionId);
    });
    relations.attachedConditions.get(nodeId)?.forEach((conditionId) => included.add(conditionId));
    relations.parents.forEach((parents, childId) => {
      if (parents.has(nodeId)) pending.push(childId);
    });
  }
  return {
    ...selection,
    nodes: input.nodes.filter((node) => included.has(node.id)),
    edges: input.edges.filter((edge) => included.has(edge.source) && included.has(edge.target)),
  };
};

const enclosingConnectors = (
  node: StudioWorkspaceNode,
  relations: ReturnType<typeof workspaceRelations>,
): Set<string> => {
  if (isConnector(node) || node.data.kind === "particle")
    return relations.parents.get(node.id) ?? new Set<string>();
  if (node.data.kind === "dimension")
    return relations.dimensionOwners.get(node.id) ?? new Set<string>();
  const owners = new Set<string>();
  if (node.data.kind === "condition") {
    relations.attachedConditions.forEach((conditions, connectorId) => {
      if (conditions.has(node.id)) owners.add(connectorId);
    });
  }
  return owners;
};

const canRemoveNode = (
  node: StudioWorkspaceNode,
  relations: ReturnType<typeof workspaceRelations>,
): boolean => {
  if (node.data.kind === "plugin") return true;
  const pending = [...enclosingConnectors(node, relations)];
  const visited = new Set<string>();
  while (pending.length) {
    const parentId = pending.pop()!;
    if (visited.has(parentId)) continue;
    visited.add(parentId);
    if (relations.byId.get(parentId)?.data.fromNetwork) return false;
    relations.parents.get(parentId)?.forEach((ancestorId) => pending.push(ancestorId));
  }
  return true;
};

export const canRemoveStudioWorkspaceNode = (
  input: StudioWorkspaceGraph & { node: StudioWorkspaceNode },
): boolean => canRemoveNode(input.node, workspaceRelations(input));

export const collectStudioWorkspaceRemovalIds = (
  input: StudioWorkspaceGraph & { nodeIds: readonly string[] },
): Set<string> => {
  const relations = workspaceRelations(input);
  const removalIds = new Set<string>();
  const expandSavedInstance = (nodeId: string) => {
    if (removalIds.has(nodeId)) return;
    const current = relations.byId.get(nodeId);
    if (!current) return;
    removalIds.add(nodeId);
    if (!isConnector(current)) return;
    relations.dimensionOwners.forEach((owners, dimensionId) => {
      if (owners.has(nodeId)) removalIds.add(dimensionId);
    });
    relations.attachedConditions.get(nodeId)?.forEach((conditionId) => removalIds.add(conditionId));
    relations.parents.forEach((parents, childId) => {
      if (parents.has(nodeId)) expandSavedInstance(childId);
    });
  };
  input.nodeIds.forEach((nodeId) => {
    const current = relations.byId.get(nodeId);
    if (!current || !canRemoveNode(current, relations)) return;
    if (isConnector(current) && current.data.fromNetwork) {
      expandSavedInstance(nodeId);
      return;
    }
    removalIds.add(nodeId);
    if (isConnector(current)) {
      relations.dimensionOwners.forEach((owners, dimensionId) => {
        if (owners.has(nodeId)) removalIds.add(dimensionId);
      });
      relations.attachedConditions
        .get(nodeId)
        ?.forEach((conditionId) => removalIds.add(conditionId));
    }
  });
  return removalIds;
};

export type StudioWorkspaceState =
  | "empty"
  | "browser-draft"
  | "saved-owned-draft"
  | "published"
  | "unavailable";

export type StudioWorkspaceCapabilities = {
  state: StudioWorkspaceState;
  canCreate: boolean;
  canSimulate: boolean;
  canPublish: boolean;
  canExecute: boolean;
};

export const resolveStudioWorkspaceCapabilities = (input: {
  root: StudioWorkspaceNode | null;
  connector?: { chainAddress?: unknown; ownerAddress?: unknown } | null;
  currentOwner?: string;
}): StudioWorkspaceCapabilities => {
  let state: StudioWorkspaceState = "empty";
  if (input.root) {
    if (!input.root.data.fromNetwork) state = "browser-draft";
    else if (isPublishedChainAddress(input.connector?.chainAddress)) state = "published";
    else if (
      isOwnedLocalEntity(
        { address: input.connector?.chainAddress, owner: input.connector?.ownerAddress },
        input.currentOwner ?? "",
      )
    )
      state = "saved-owned-draft";
    else state = "unavailable";
  }
  return {
    state,
    canCreate: state === "browser-draft",
    canSimulate: state === "saved-owned-draft" || state === "published",
    canPublish: state === "saved-owned-draft",
    canExecute: state === "published",
  };
};
