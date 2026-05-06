import { describe, expect, it } from "vitest";
import type { StudioConnectorDef } from "../src/lib/studio/domain/connectorModel";
import { computeRiPositioning } from "../src/lib/studio/riPositioning";

const createConnector = (
  name: string,
  dimensions: Array<{
    composite?: string;
    bindings?: Record<string, string>;
  }>,
): StudioConnectorDef => ({
  name,
  dimensions: dimensions.map((dimension) => ({
    transformations: [],
    ...(dimension.composite ? { composite: dimension.composite } : {}),
    bindings: { ...(dimension.bindings ?? {}) },
  })),
});

describe("riPositioning", () => {
  it("produces stable deterministic DFS positions", () => {
    const connectors: Record<string, StudioConnectorDef> = {
      root: createConnector("root", [{ composite: "child" }, {}]),
      child: createConnector("child", [{ composite: "leaf" }, {}]),
      leaf: createConnector("leaf", [{}]),
    };

    const first = computeRiPositioning(connectors, "root");
    const second = computeRiPositioning(connectors, "root");

    expect(first.totalPositions).toBe(second.totalPositions);
    expect(first.nodes.map((node) => [node.connectorName, node.position, node.relation])).toEqual(
      second.nodes.map((node) => [node.connectorName, node.position, node.relation]),
    );

    expect(first.nodes.find((node) => node.relation === "root")?.position).toBe(0);
    const allNodePositions = first.nodes.map((node) => node.position);
    expect(new Set(allNodePositions).size).toBe(allNodePositions.length);
    expect(first.totalPositions).toBeGreaterThan(Math.max(...allNodePositions));
  });

  it("handles nested composite + static binding traversal without position collisions", () => {
    const connectors: Record<string, StudioConnectorDef> = {
      pitch: createConnector("pitch", [{}]),
      time: createConnector("time", [{}]),
      branch: createConnector("branch", [{ composite: "pitch" }, { composite: "time" }]),
      root: createConnector("root", [{ composite: "branch", bindings: { "0": "time" } }]),
    };

    const result = computeRiPositioning(connectors, "root");
    const positions = result.nodes.map((node) => node.position);

    expect(new Set(positions).size).toBe(positions.length);
    expect(result.nodes.some((node) => node.relation === "binding")).toBe(true);
    expect(result.nodes.some((node) => node.bindingKind === "static")).toBe(true);
    expect(result.totalPositions).toBeGreaterThan(Math.max(...positions));
  });

  it("records connector occurrence and local dimension DFS positions separately", () => {
    const connectors: Record<string, StudioConnectorDef> = {
      test_note_table: createConnector("test_note_table", [
        { composite: "score_quarter_note_tick_grid" },
        { composite: "constant_value" },
        { composite: "major_scale_steps" },
      ]),
      score_quarter_note_tick_grid: createConnector("score_quarter_note_tick_grid", [{}]),
      constant_value: createConnector("constant_value", [{}]),
      major_scale_steps: createConnector("major_scale_steps", [{}]),
    };

    const result = computeRiPositioning(connectors, "test_note_table");

    expect(
      result.nodes.map((entry) => [entry.connectorName, entry.position, entry.relation]),
    ).toEqual([
      ["test_note_table", 0, "root"],
      ["score_quarter_note_tick_grid", 1, "composite"],
      ["constant_value", 3, "composite"],
      ["major_scale_steps", 5, "composite"],
    ]);
    expect(
      result.dimensions.map((entry) => [entry.connectorName, entry.dimensionIndex, entry.position]),
    ).toEqual([
      ["test_note_table", 0, 1],
      ["score_quarter_note_tick_grid", 0, 2],
      ["test_note_table", 1, 3],
      ["constant_value", 0, 4],
      ["test_note_table", 2, 5],
      ["major_scale_steps", 0, 6],
    ]);
    expect(result.totalPositions).toBe(7);
  });

  it("throws explicit cycle errors", () => {
    const connectors: Record<string, StudioConnectorDef> = {
      a: createConnector("a", [{ composite: "b" }]),
      b: createConnector("b", [{ composite: "a" }]),
    };

    expect(() => computeRiPositioning(connectors, "a")).toThrowError(/cycle/i);
  });

  it("throws explicit missing connector errors", () => {
    const connectors: Record<string, StudioConnectorDef> = {
      root: createConnector("root", [{ composite: "missing_connector" }]),
    };

    expect(() => computeRiPositioning(connectors, "root")).toThrowError(/missing connector/i);
  });
});
