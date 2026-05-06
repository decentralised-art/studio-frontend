import { describe, expect, it } from "vitest";
import { fromProtocolConnectorPayload } from "../src/lib/chain/connectorContractAdapter";
import {
  buildExecutePlanConnectorRegistry,
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
    const deepScalarPosition = String(childNode.position + 4);

    const riPlan = buildExecuteRiPlan(connectors, "wrapper", {
      [nestedRootPosition]: { startPoint: 101, transformationShift: 0 },
      [deepScalarPosition]: { startPoint: 404, transformationShift: 0 },
    });

    expect(riPlan.staticRiByPosition[nestedRootPosition]).toBeUndefined();
    expect(riPlan.staticRiByPosition[immediateNestedPosition]?.connectorName).toBe("child");
    expect(riPlan.staticRiByPosition[deepScalarPosition]).toBeUndefined();
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
    expect(riPlan.dynamicRi[deepScalarPosition]).toEqual({
      start_point: 404,
      transformation_shift: 0,
    });
    expect(
      riPlan.warnings.some((warning) =>
        /Ignoring nested static_ri position 4 on connector 'child'/.test(warning),
      ),
    ).toBe(true);
    expect(riPlan.warnings.some((warning) => /unknown position/i.test(warning))).toBe(false);
  });

  it("plans execute requests against deployed static RI when the root is on chain", () => {
    const runtimeRoot = fromProtocolConnectorPayload({
      name: "test_score_root_05052026",
      dimensions: [
        {
          transformations: [{ name: "add", args: [1] }],
          composite: "test_note_table_05052026",
          bindings: {},
        },
      ],
    });
    const deployedRoot = fromProtocolConnectorPayload({
      name: "test_score_root_05052026",
      dimensions: [
        {
          transformations: [{ name: "add", args: [1] }],
          composite: "test_note_table_05052026",
          bindings: {},
        },
      ],
      static_ri: {
        "4": { start_point: 2520, transformation_shift: 0 },
      },
    });
    const noteTable = fromProtocolConnectorPayload({
      name: "test_note_table_05052026",
      dimensions: [
        {
          transformations: [{ name: "add", args: [1] }],
          composite: "score_quarter_note_tick_grid",
          bindings: {},
        },
        {
          transformations: [{ name: "add", args: [1] }],
          composite: "constant_value",
          bindings: {},
        },
        {
          transformations: [{ name: "add", args: [1] }],
          composite: "major_scale_steps",
          bindings: {},
        },
      ],
      static_ri: {
        "3": { start_point: 2520, transformation_shift: 0 },
      },
    });
    const tickGrid = fromProtocolConnectorPayload({
      name: "score_quarter_note_tick_grid",
      dimensions: [{ transformations: [{ name: "add", args: [2520] }] }],
    });
    const constantValue = fromProtocolConnectorPayload({
      name: "constant_value",
      dimensions: [{ transformations: [{ name: "add", args: [0] }] }],
    });
    const majorScaleSteps = fromProtocolConnectorPayload({
      name: "major_scale_steps",
      dimensions: [
        {
          transformations: [
            { name: "add", args: [2] },
            { name: "add", args: [2] },
            { name: "add", args: [1] },
            { name: "add", args: [2] },
            { name: "add", args: [2] },
            { name: "add", args: [2] },
            { name: "add", args: [1] },
          ],
        },
      ],
    });

    const runtimeConnectors = {
      test_score_root_05052026: runtimeRoot,
      test_note_table_05052026: noteTable,
      score_quarter_note_tick_grid: tickGrid,
      constant_value: constantValue,
      major_scale_steps: majorScaleSteps,
    };
    const deployedConnectors = {
      ...runtimeConnectors,
      test_score_root_05052026: deployedRoot,
    };
    const planConnectors = buildExecutePlanConnectorRegistry({
      runtimeConnectors,
      deployedConnectors,
      rootConnectorName: "test_score_root_05052026",
    });

    const riPlan = buildExecuteRiPlan(planConnectors, "test_score_root_05052026", {
      "4": { startPoint: 60, transformationShift: 0 },
      "6": { startPoint: 60, transformationShift: 0 },
    });
    const request = buildExecuteRequestBody({
      connectorName: "test_score_root_05052026",
      particlesCount: 10,
      riPlan,
    });

    expect(riPlan.staticRiByPosition["4"]?.startPoint).toBe(2520);
    expect(riPlan.blockedOverrides.some((entry) => entry.position === 4)).toBe(true);
    expect(request.dynamic_ri["4"]).toBeUndefined();
    expect(request.dynamic_ri["6"]).toEqual({
      start_point: 60,
      transformation_shift: 0,
    });
  });

  it("accepts dynamic overrides for scalar dimension positions", () => {
    const root = fromProtocolConnectorPayload({
      name: "test_note_table",
      dimensions: [
        { transformations: [], composite: "score_quarter_note_tick_grid", bindings: {} },
        { transformations: [], composite: "constant_value", bindings: {} },
        { transformations: [], composite: "major_scale_steps", bindings: {} },
      ],
    });
    const tickGrid = fromProtocolConnectorPayload({
      name: "score_quarter_note_tick_grid",
      dimensions: [{ transformations: [] }],
    });
    const constantValue = fromProtocolConnectorPayload({
      name: "constant_value",
      dimensions: [{ transformations: [] }],
    });
    const majorScaleSteps = fromProtocolConnectorPayload({
      name: "major_scale_steps",
      dimensions: [{ transformations: [] }],
    });

    const riPlan = buildExecuteRiPlan(
      {
        test_note_table: root,
        score_quarter_note_tick_grid: tickGrid,
        constant_value: constantValue,
        major_scale_steps: majorScaleSteps,
      },
      "test_note_table",
      {
        "4": { startPoint: 2520, transformationShift: 0 },
        "6": { startPoint: 60, transformationShift: 0 },
      },
    );
    const request = buildExecuteRequestBody({
      connectorName: "test_note_table",
      particlesCount: 8,
      riPlan,
    });

    expect(request.dynamic_ri["4"]).toEqual({
      start_point: 2520,
      transformation_shift: 0,
    });
    expect(request.dynamic_ri["6"]).toEqual({
      start_point: 60,
      transformation_shift: 0,
    });
    expect(riPlan.warnings.some((warning) => /unknown position/i.test(warning))).toBe(false);
  });
});
