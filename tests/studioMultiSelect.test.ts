import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readStudioSource = (): string =>
  readFileSync(resolve(process.cwd(), "src/routes/studio/+page.svelte"), "utf8");

describe("Studio multi-select", () => {
  it("enables cmd and ctrl drag-box selection in the flow canvas", () => {
    const source = readStudioSource();

    expect(source).toContain("SelectionMode,");
    expect(source).toContain('selectionKey={["Meta", "Control"]}');
    expect(source).toContain('multiSelectionKey={["Meta", "Control"]}');
    expect(source).toContain("selectionMode={SelectionMode.Partial}");
  });

  it("deletes the full selected graph set instead of only the primary item", () => {
    const source = readStudioSource();

    expect(source).toContain("let selectedNodeIds = $state.raw<string[]>([]);");
    expect(source).toContain("let selectedEdgeIds = $state.raw<string[]>([]);");
    expect(source).toContain("const selectedNodeIdsForRemoval = nodes");
    expect(source).toContain("const selectedEdgeIdsForRemoval = edges");
    expect(source).toContain("nodeIdsToRemove.forEach((nodeId) => {");
    expect(source).toContain("edgeIdsToRemove.forEach((edgeId) => {");
  });

  it("clears selected nodes and edges when the flow pane is clicked", () => {
    const source = readStudioSource();

    expect(source).toContain("const clearGraphSelection = () => {");
    expect(source).toContain("selectedNodeIds = [];");
    expect(source).toContain("selectedEdgeIds = [];");
    expect(source).toContain("const handlePaneClick = () => {");
    expect(source).toContain("onpaneclick={handlePaneClick}");
    expect(source).toContain("const handleFlowAreaPointerDown = (event: PointerEvent) => {");
    expect(source).toContain("if (event.metaKey || event.ctrlKey || event.shiftKey) return;");
    expect(source).toContain("window.setTimeout(clearGraphSelection, 0);");
    expect(source).toContain(
      '<div class="flow-area" role="presentation" onpointerdowncapture={handleFlowAreaPointerDown}>',
    );
  });

  it("persists dragged group positions when selection changes", () => {
    const source = readStudioSource();

    expect(source).toContain("const beginManualGraphDrag = () => {");
    expect(source).toContain("const endManualGraphDrag = () => {");
    expect(source).toContain("const shouldDeferAutoLayout = () =>");
    expect(source).toContain("const syncDraggedNodePositions = (draggedNodes: StudioNode[])");
    expect(source).toContain("const handleNodeDragStart = ({ nodes: draggedNodes }");
    expect(source).toContain("const handleNodeDragStop = ({ nodes: draggedNodes }");
    expect(source).toContain(
      "const handleSelectionDragStop = (_event: MouseEvent, draggedNodes: StudioNode[])",
    );
    expect(source).toContain("if (draggedNodes.length === 0) return;");
    expect(source).toContain("cancelLayoutFrames();");
    expect(source).toContain("syncDraggedNodePositions(draggedNodes);");
    expect(source).toContain("saveActiveGraph();");
    expect(source).toContain("const draggedById = new SvelteMap(");
    expect(source).toContain("position: { ...draggedNode.position },");
    expect(source).toContain("onnodedragstart={handleNodeDragStart}");
    expect(source).toContain("onnodedrag={handleNodeDrag}");
    expect(source).toContain("onnodedragstop={handleNodeDragStop}");
    expect(source).toContain("onselectiondrag={handleSelectionDrag}");
    expect(source).toContain("onselectiondragstop={handleSelectionDragStop}");
  });
});
