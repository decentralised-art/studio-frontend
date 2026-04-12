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
