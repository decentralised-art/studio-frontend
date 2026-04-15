import { describe, expect, it } from "vitest";

import type { RiConnectorNodePosition } from "../src/lib/studio/riPositioning";
import { projectRiPositionsToConnectorNodes } from "../src/lib/studio/riProjectionMapping";

const node = (
  key: string,
  connectorName: string,
  position: number,
  relation: RiConnectorNodePosition["relation"],
  parentKey: string | null,
  parentDimensionIndex: number | null,
  parentSlot: number | null,
): RiConnectorNodePosition => ({
  key,
  connectorName,
  depth: 0,
  position,
  subtreeSize: 1,
  relation,
  parentKey,
  parentDimensionIndex,
  parentSlot,
  bindingKind: null,
});

describe("riProjectionMapping", () => {
  it("maps positions by structural edges and binding slot, not by connector name only", () => {
    const rootPlanKey = "root@0";
    const result = projectRiPositionsToConnectorNodes({
      rootConnectorName: "c3",
      planNodes: [
        node(rootPlanKey, "c3", 0, "root", null, null, null),
        node("c2@1", "c2", 1, "composite", rootPlanKey, 0, null),
        node("time@2", "time", 2, "binding", rootPlanKey, 1, 4),
      ],
      graphNodes: [
        { id: "n-root", connectorName: "c3", tabRoot: true },
        { id: "n-c2", connectorName: "c2" },
        { id: "n-time-slot1", connectorName: "time" },
        { id: "n-time-slot4", connectorName: "time" },
      ],
      graphEdges: [
        {
          source: "n-root",
          target: "n-c2",
          sourceHandle: "dim-0",
          targetHandle: "in",
          relation: "composite",
          bindingSlot: null,
        },
        {
          source: "n-root",
          target: "n-time-slot1",
          sourceHandle: "dim-1",
          targetHandle: "in",
          relation: "binding",
          bindingSlot: 1,
        },
        {
          source: "n-root",
          target: "n-time-slot4",
          sourceHandle: "dim-1",
          targetHandle: "in",
          relation: "binding",
          bindingSlot: 4,
        },
      ],
    });

    expect(result.warnings).toEqual([]);
    expect(result.positionByNodeId).toEqual({
      "n-root": 0,
      "n-c2": 1,
      "n-time-slot4": 2,
    });
    expect(result.positionByNodeId["n-time-slot1"]).toBeUndefined();
  });

  it("emits projection warnings when a planned node cannot be mapped", () => {
    const rootPlanKey = "root@0";
    const result = projectRiPositionsToConnectorNodes({
      rootConnectorName: "c3",
      planNodes: [
        node(rootPlanKey, "c3", 0, "root", null, null, null),
        node("missing-c2", "c2", 1, "composite", rootPlanKey, 0, null),
      ],
      graphNodes: [{ id: "n-root", connectorName: "c3", tabRoot: true }],
      graphEdges: [],
    });

    expect(result.positionByNodeId).toEqual({ "n-root": 0 });
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("Unable to project RI position 1");
  });

  it("prefers tab-root node for root projection when names are duplicated", () => {
    const rootPlanKey = "root@0";
    const result = projectRiPositionsToConnectorNodes({
      rootConnectorName: "c3",
      planNodes: [
        node(rootPlanKey, "c3", 0, "root", null, null, null),
        node("c2@1", "c2", 1, "composite", rootPlanKey, 0, null),
      ],
      graphNodes: [
        { id: "n-c3-nonroot", connectorName: "c3", tabRoot: false },
        { id: "n-c3-root", connectorName: "c3", tabRoot: true },
        { id: "n-c2", connectorName: "c2" },
      ],
      graphEdges: [
        {
          source: "n-c3-root",
          target: "n-c2",
          sourceHandle: "dim-0",
          targetHandle: "in",
          relation: "composite",
          bindingSlot: null,
        },
      ],
    });

    expect(result.warnings).toEqual([]);
    expect(result.positionByNodeId).toEqual({
      "n-c3-root": 0,
      "n-c2": 1,
    });
    expect(result.positionByNodeId["n-c3-nonroot"]).toBeUndefined();
  });

  it("maps duplicated connector names on different dimensions by structural source handle", () => {
    const rootPlanKey = "root@0";
    const result = projectRiPositionsToConnectorNodes({
      rootConnectorName: "c4",
      planNodes: [
        node(rootPlanKey, "c4", 0, "root", null, null, null),
        node("left-t0", "t0", 1, "composite", rootPlanKey, 0, null),
        node("right-t0", "t0", 2, "composite", rootPlanKey, 1, null),
      ],
      graphNodes: [
        { id: "n-root", connectorName: "c4", tabRoot: true },
        { id: "n-t0-left", connectorName: "t0" },
        { id: "n-t0-right", connectorName: "t0" },
      ],
      graphEdges: [
        {
          source: "n-root",
          target: "n-t0-left",
          sourceHandle: "dim-0",
          targetHandle: "in",
          relation: "composite",
          bindingSlot: null,
        },
        {
          source: "n-root",
          target: "n-t0-right",
          sourceHandle: "dim-1",
          targetHandle: "in",
          relation: "composite",
          bindingSlot: null,
        },
      ],
    });

    expect(result.warnings).toEqual([]);
    expect(result.positionByNodeId).toEqual({
      "n-root": 0,
      "n-t0-left": 1,
      "n-t0-right": 2,
    });
  });

  it("projects binding nodes from legacy unknown-relation edges using slot+name scoring", () => {
    const rootPlanKey = "root@0";
    const result = projectRiPositionsToConnectorNodes({
      rootConnectorName: "c3",
      planNodes: [
        node(rootPlanKey, "c3", 0, "root", null, null, null),
        node("bound-time", "time", 7, "binding", rootPlanKey, 1, 4),
      ],
      graphNodes: [
        { id: "n-root", connectorName: "c3", tabRoot: true },
        { id: "n-time-slot1", connectorName: "time" },
        { id: "n-time-slot4", connectorName: "time" },
      ],
      graphEdges: [
        {
          source: "n-root",
          target: "n-time-slot1",
          sourceHandle: "dim-1",
          targetHandle: "in",
          relation: "unknown",
          bindingSlot: 1,
        },
        {
          source: "n-root",
          target: "n-time-slot4",
          sourceHandle: "dim-1",
          targetHandle: "in",
          relation: "unknown",
          bindingSlot: 4,
        },
      ],
    });

    expect(result.warnings).toEqual([]);
    expect(result.positionByNodeId).toEqual({
      "n-root": 0,
      "n-time-slot4": 7,
    });
  });
});
