import type { Node, Edge } from "@xyflow/svelte";

// ---- Data payloads on nodes ----
export type FeatureData = { label: string };
export type TransformationData = { label: string };

// ---- XYFlow Node types (these are *types*, not components) ----
export type FeatureNodeType = Node<FeatureData, "feature">;
export type TransformationNodeType = Node<TransformationData, "transformation">;

// Union of all node types in editor
export type FlowNode = FeatureNodeType | TransformationNodeType;

// ---- Data payloads on edges ----
export type DimensionData = {
  label?: string;
  dimension?: number;
};

// ---- Typed custom edge ----
export type DimensionEdgeType = Edge<DimensionData, "dimension">;

// Union of all possible edges in editor
export type FlowEdge = DimensionEdgeType | Edge;