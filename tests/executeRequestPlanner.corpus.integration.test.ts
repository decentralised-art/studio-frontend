import { describe, expect, it } from "vitest";
import { fromProtocolConnectorPayload } from "../src/lib/chain/connectorContractAdapter";
import {
  buildExecuteRequestBody,
  buildExecuteRiPlan,
  formatExecuteRiSummary,
} from "../src/lib/studio/executeRequestPlanner";

describe("executeRequestPlanner corpus integration", () => {
  it("builds canonical execute payload for a corpus-style connector and preserves static locks", () => {
    const chromaticScale = fromProtocolConnectorPayload({
      name: "chromatic_scale",
      dimensions: [
        { transformations: [{ name: "add", args: [1] }], composite: "pitch", bindings: {} },
        { transformations: [{ name: "add", args: [1] }], composite: "time", bindings: {} },
        { transformations: [{ name: "add", args: [1] }], composite: "durationv2", bindings: {} },
        { transformations: [{ name: "add", args: [1] }], composite: "velocity", bindings: {} },
      ],
      static_ri: {
        "0": { start_point: 10, transformation_shift: 0 },
      },
    });
    const pitch = fromProtocolConnectorPayload({
      name: "pitch",
      dimensions: [{ transformations: [{ name: "add", args: [1] }] }],
    });
    const time = fromProtocolConnectorPayload({
      name: "time",
      dimensions: [{ transformations: [{ name: "add", args: [1] }] }],
    });
    const durationv2 = fromProtocolConnectorPayload({
      name: "durationv2",
      dimensions: [{ transformations: [{ name: "identity", args: [] }] }],
    });
    const velocity = fromProtocolConnectorPayload({
      name: "velocity",
      dimensions: [{ transformations: [{ name: "identity", args: [] }] }],
    });

    const connectors = {
      chromatic_scale: chromaticScale,
      pitch,
      time,
      durationv2,
      velocity,
    };

    const basePlan = buildExecuteRiPlan(connectors, "chromatic_scale", {});
    const timeNodePosition = basePlan.positioning.nodes.find(
      (entry) => entry.connectorName === "time",
    )?.position;
    expect(Number.isInteger(timeNodePosition)).toBe(true);
    if (!Number.isInteger(timeNodePosition)) {
      throw new Error("Expected time connector position to exist in RI positioning.");
    }

    const riPlan = buildExecuteRiPlan(connectors, "chromatic_scale", {
      "0": { startPoint: 3, transformationShift: 1 },
      [String(timeNodePosition)]: { startPoint: 7, transformationShift: 2 },
      "999": { startPoint: 1, transformationShift: 1 },
    });

    expect(riPlan.staticRiByPosition["0"]?.connectorName).toBe("chromatic_scale");
    expect(riPlan.blockedOverrides.some((entry) => entry.position === 0)).toBe(true);
    expect(riPlan.warnings.some((warning) => /unknown position 999/i.test(warning))).toBe(true);

    const request = buildExecuteRequestBody({
      connectorName: "chromatic_scale",
      particlesCount: 12,
      riPlan,
    });

    expect(request.connector_name).toBe("chromatic_scale");
    expect(request.particles_count).toBe("12");
    expect(request.dynamic_ri["0"]).toBeUndefined();
    expect(request.dynamic_ri[String(timeNodePosition)]).toEqual({
      start_point: 7,
      transformation_shift: 2,
    });
    expect(formatExecuteRiSummary(riPlan)).toContain("RI plan");
  });
});
