import { describe, expect, it } from "vitest";
import { fromProtocolConnectorPayload } from "../src/lib/chain/connectorContractAdapter";
import {
  buildExecuteRequestBody,
  buildExecuteRiPlan,
} from "../src/lib/studio/executeRequestPlanner";

describe("executeRequestPlanner integration", () => {
  it("preserves synced static_ri locking in execute request generation", () => {
    const c3 = fromProtocolConnectorPayload({
      name: "c3",
      dimensions: [{ transformations: [], composite: "c2", bindings: { "4": "time" } }],
      static_ri: {
        "0": { start_point: 5, transformation_shift: 1 },
      },
    });
    const c2 = fromProtocolConnectorPayload({
      name: "c2",
      dimensions: [
        { transformations: [], composite: "c0", bindings: {} },
        { transformations: [], bindings: { "4": "time" } },
        { transformations: [], composite: "pitch", bindings: {} },
      ],
    });
    const c0 = fromProtocolConnectorPayload({
      name: "c0",
      dimensions: [
        { transformations: [], composite: "t0", bindings: {} },
        { transformations: [], composite: "t0", bindings: {} },
      ],
    });
    const t0 = fromProtocolConnectorPayload({
      name: "t0",
      dimensions: [
        { transformations: [], composite: "pitch", bindings: {} },
        { transformations: [], bindings: { "1": "time" } },
      ],
    });
    const pitch = fromProtocolConnectorPayload({
      name: "pitch",
      dimensions: [{ transformations: [] }],
    });
    const time = fromProtocolConnectorPayload({
      name: "time",
      dimensions: [{ transformations: [] }],
    });

    const connectors = {
      c3,
      c2,
      c0,
      t0,
      pitch,
      time,
    };

    const riPlan = buildExecuteRiPlan(connectors, "c3", {
      "0": { startPoint: 9, transformationShift: 3 },
      "2": { startPoint: 1, transformationShift: 1 },
    });

    expect(riPlan.blockedOverrides.some((entry) => entry.position === 0)).toBe(true);
    expect(riPlan.staticRiByPosition["0"]?.connectorName).toBe("c3");

    const request = buildExecuteRequestBody({
      connectorName: "c3",
      particlesCount: 12,
      riPlan,
    });

    expect(request.connector_name).toBe("c3");
    expect(request.particles_count).toBe("12");
    expect(request.dynamic_ri["0"]).toBeUndefined();
    expect(request.dynamic_ri["2"]).toEqual({
      start_point: 1,
      transformation_shift: 1,
    });
  });

  it("clamps execute payload RI values to uint32 range", () => {
    const root = fromProtocolConnectorPayload({
      name: "root",
      dimensions: [{ transformations: [] }],
    });

    const riPlan = buildExecuteRiPlan({ root }, "root", {
      "0": { startPoint: Number.MAX_SAFE_INTEGER, transformationShift: -12 },
    });
    const request = buildExecuteRequestBody({
      connectorName: "root",
      particlesCount: Number.MAX_SAFE_INTEGER,
      riPlan,
    });

    expect(request.particles_count).toBe("4294967295");
    expect(request.dynamic_ri["0"]).toEqual({
      start_point: 0xffff_ffff,
      transformation_shift: 0,
    });
  });
});
