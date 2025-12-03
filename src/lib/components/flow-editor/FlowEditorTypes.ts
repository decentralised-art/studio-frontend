import type { Node, NodeProps, Edge, EdgeProps, getBezierPath } from "@xyflow/svelte";

// ---- Nodes ----
export type FeatureData = {
    name: string;
    exists_on_server: boolean;
};

// ---- Node types ----
export type FeatureNodePropsType = NodeProps<FeatureNodeType>;
export type FeatureNodeType = Node<FeatureData, "feature">;

// Union of all node types in editor
export type FlowNode = FeatureNodeType;

// ---- Edges ----
export type TransformationDef = {
    id: string;
    name: string;
    args: number[];
};

export type TransformationDefPropsType = {
    edgeId: string;
    def: TransformationDef;
}

// Type of a path factory function (same shape as getBezierPath)
type EdgePathFn = typeof getBezierPath;

export type DimensionData = {
    defs: TransformationDef[];
    //injectable path function
    pathFn: EdgePathFn;
};

// ---- Edge types ----
export type DimensionEdgePropsType = EdgeProps<DimensionEdgeType>;
export type DimensionEdgeType = Edge<DimensionData, "dimension">;

// Union of all possible edges in editor
export type FlowEdge = DimensionEdgeType;