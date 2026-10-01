export type NetworkNodeKind =
  | "creator"
  | "particle"
  | "feature"
  | "transformation"
  | "condition"
  | "plugin";

export type NetworkEdgeKind =
  | "authored_by"
  | "uses_feature"
  | "depends_on"
  | "uses_transformation"
  | "guarded_by"
  | "renders_with";

export type NetworkGraphNode = {
  id: string;
  entityId: string;
  kind: NetworkNodeKind;
  label: string;
  summary: string;
  creatorId?: string;
  x: number;
  y: number;
  size: number;
};

export type NetworkGraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: NetworkEdgeKind;
};

export type NetworkGraphData = {
  nodes: NetworkGraphNode[];
  edges: NetworkGraphEdge[];
  nodeById: Map<string, NetworkGraphNode>;
  edgeById: Map<string, NetworkGraphEdge>;
};

export const networkNodePalette: Record<NetworkNodeKind, { color: string; label: string }> = {
  creator: { color: "#71a7ff", label: "Creator" },
  particle: { color: "#37d39d", label: "Connector" },
  feature: { color: "#f4b247", label: "Connector Schema" },
  transformation: { color: "#f07cbc", label: "Transformation" },
  condition: { color: "#f47a7a", label: "Condition" },
  plugin: { color: "#a993ff", label: "World" },
};

export const networkEdgePalette: Record<NetworkEdgeKind, { color: string; label: string }> = {
  authored_by: { color: "#71a7ff", label: "Creator" },
  uses_feature: { color: "#40d69c", label: "uses connector schema" },
  depends_on: { color: "#ffd166", label: "Dependency" },
  uses_transformation: { color: "#f28bc6", label: "Transformation" },
  guarded_by: { color: "#ff8f8f", label: "Condition" },
  renders_with: { color: "#b5a1ff", label: "World" },
};
