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
      dimensions: [{ transformations: [], composite: "c2", bindings: { "1": "velocity" } }],
      static_ri: {
        "0": { start_point: 5, transformation_shift: 1 },
      },
    });
    const c2 = fromProtocolConnectorPayload({
      name: "c2",
      dimensions: [
        { transformations: [], composite: "pitch", bindings: {} },
        { transformations: [], composite: "time", bindings: {} },
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
    const velocity = fromProtocolConnectorPayload({
      name: "velocity",
      dimensions: [{ transformations: [] }],
    });

    const connectors = {
      c3,
      c2,
      pitch,
      time,
      velocity,
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

  it("matches PT nested static_ri semantics for wrapped connectors", () => {
    const wrapper = fromProtocolConnectorPayload({
      name: "wrapper",
      dimensions: [{ transformations: [], composite: "child", bindings: {} }],
    });
    const child = fromProtocolConnectorPayload({
      name: "child",
      dimensions: [
        { transformations: [], composite: "pitch", bindings: {} },
        { transformations: [], composite: "time", bindings: {} },
      ],
      static_ri: {
        "0": { start_point: 11, transformation_shift: 0 },
        "2": { start_point: 22, transformation_shift: 0 },
        "4": { start_point: 44, transformation_shift: 0 },
      },
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
      wrapper,
      child,
      pitch,
      time,
    };

    const basePlan = buildExecuteRiPlan(connectors, "wrapper", {});
    const childNode = basePlan.positioning.nodes.find((entry) => entry.connectorName === "child");
    expect(childNode).toBeTruthy();
    if (!childNode) {
      throw new Error("Expected child connector position to exist in RI positioning.");
    }

    const nestedRootPosition = String(childNode.position);
    const immediateNestedPosition = String(childNode.position + 2);
    const ignoredNestedDeepPosition = String(childNode.position + 4);

    const riPlan = buildExecuteRiPlan(connectors, "wrapper", {
      [nestedRootPosition]: { startPoint: 101, transformationShift: 0 },
      [ignoredNestedDeepPosition]: { startPoint: 404, transformationShift: 0 },
    });

    expect(riPlan.staticRiByPosition[nestedRootPosition]).toBeUndefined();
    expect(riPlan.staticRiByPosition[immediateNestedPosition]?.connectorName).toBe("child");
    expect(riPlan.staticRiByPosition[ignoredNestedDeepPosition]).toBeUndefined();
    expect(
      riPlan.blockedOverrides.some((entry) => entry.position === Number(nestedRootPosition)),
    ).toBe(false);
    expect(
      riPlan.blockedOverrides.some((entry) => entry.position === Number(immediateNestedPosition)),
    ).toBe(false);
    expect(riPlan.dynamicRi[nestedRootPosition]).toEqual({
      start_point: 101,
      transformation_shift: 0,
    });
    expect(riPlan.dynamicRi[ignoredNestedDeepPosition]).toBeUndefined();
    expect(
      riPlan.warnings.some((warning) =>
        /Ignoring nested static_ri position 4 on connector 'child'/.test(warning),
      ),
    ).toBe(true);
    expect(riPlan.warnings.some((warning) => /unknown position/i.test(warning))).toBe(true);
  });
});
