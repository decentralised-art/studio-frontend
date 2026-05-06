import { describe, expect, it } from "vitest";

import { mergeRuntimeRiOverridesIntoProjectedNode } from "../src/lib/studio/runtimeRiOverrides";

describe("runtime RI overrides", () => {
  it("preserves connector runtime RI values when a projected tab is rebuilt", () => {
    const projectedNode = {
      id: "connector-root",
      data: {
        kind: "connector",
        networkId: "root",
        riPosition: 0,
        riStart: 0,
        riShift: 0,
        riLocked: false,
        staticRi: { "0": { startPoint: 1, transformationShift: 2 } },
      },
    };
    const overlayNode = {
      id: "connector-root",
      data: {
        kind: "connector",
        networkId: "root",
        riPosition: 0,
        riStart: 12,
        riShift: 3,
        riLocked: true,
        staticRi: { "0": { startPoint: 99, transformationShift: 99 } },
      },
    };

    expect(mergeRuntimeRiOverridesIntoProjectedNode(projectedNode, overlayNode)).toEqual({
      id: "connector-root",
      data: {
        kind: "connector",
        networkId: "root",
        riPosition: 0,
        riStart: 12,
        riShift: 3,
        riLocked: true,
        staticRi: { "0": { startPoint: 1, transformationShift: 2 } },
      },
    });
  });

  it("preserves dimension runtime RI values", () => {
    const result = mergeRuntimeRiOverridesIntoProjectedNode(
      { id: "dimension-1", data: { kind: "dimension", riStart: 0, riShift: 0 } },
      { id: "dimension-1", data: { kind: "dimension", riStart: "7.8", riShift: -2 } },
    );

    expect(result.data).toMatchObject({ riStart: 7, riShift: 0 });
  });

  it("ignores stale overrides for a different projected connector position", () => {
    const projectedNode = {
      id: "connector-reused",
      data: {
        kind: "connector",
        networkId: "major_scale_steps",
        riPosition: 5,
        riStart: 0,
        riShift: 0,
        riLocked: false,
      },
    };
    const result = mergeRuntimeRiOverridesIntoProjectedNode(projectedNode, {
      id: "connector-reused",
      data: {
        kind: "connector",
        networkId: "constant_value",
        riPosition: 3,
        riStart: 2520,
        riShift: 0,
        riLocked: true,
      },
    });

    expect(result).toBe(projectedNode);
  });

  it("ignores stale overrides for a different RI target position", () => {
    const projectedNode = {
      id: "connector-reused",
      data: {
        kind: "connector",
        networkId: "constant_value",
        riPosition: 3,
        riTargetPosition: 4,
        riStart: 0,
        riShift: 0,
        riLocked: false,
      },
    };
    const result = mergeRuntimeRiOverridesIntoProjectedNode(projectedNode, {
      id: "connector-reused",
      data: {
        kind: "connector",
        networkId: "constant_value",
        riPosition: 3,
        riTargetPosition: 6,
        riStart: 2520,
        riShift: 0,
        riLocked: true,
      },
    });

    expect(result).toBe(projectedNode);
  });

  it("ignores nodes that do not expose RI controls", () => {
    const projectedNode = { id: "condition-1", data: { kind: "condition", riStart: 0 } };
    const result = mergeRuntimeRiOverridesIntoProjectedNode(projectedNode, {
      id: "condition-1",
      data: { kind: "condition", riStart: 6 },
    });

    expect(result).toBe(projectedNode);
  });
});
