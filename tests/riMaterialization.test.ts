import { describe, expect, it } from "vitest";

import { materializeReferencedRiIntoRootStatic } from "../src/lib/studio/riMaterialization";

describe("riMaterialization", () => {
  it("materializes only user-lockable referenced on-chain dynamic RIs", () => {
    const result = materializeReferencedRiIntoRootStatic(
      {
        "0": { startPoint: 2, transformationShift: 0 },
      },
      [],
      {},
      [
        {
          fromNetwork: true,
          riLocked: true,
          riPosition: 5,
          riStart: 10,
          riShift: 0,
          lockToggleDisabled: false,
        },
        {
          fromNetwork: true,
          riLocked: true,
          riPosition: 7,
          riStart: 4,
          riShift: 1,
          lockToggleDisabled: true,
        },
        {
          fromNetwork: false,
          riLocked: true,
          riPosition: 3,
          riStart: 9,
          riShift: 0,
          lockToggleDisabled: false,
        },
      ],
    );

    expect(result.changed).toBe(true);
    expect(result.materializedPositions).toEqual([5]);
    expect(result.materializedSnapshot).toEqual({
      "5": { startPoint: 10, transformationShift: 0 },
    });
    expect(result.staticRi).toEqual({
      "0": { startPoint: 2, transformationShift: 0 },
      "5": { startPoint: 10, transformationShift: 0 },
    });
  });

  it("removes previously materialized entries when no candidate remains locked", () => {
    const result = materializeReferencedRiIntoRootStatic(
      {
        "0": { startPoint: 2, transformationShift: 0 },
        "5": { startPoint: 10, transformationShift: 0 },
      },
      [5],
      {
        "5": { startPoint: 10, transformationShift: 0 },
      },
      [],
    );

    expect(result.changed).toBe(true);
    expect(result.materializedPositions).toEqual([]);
    expect(result.materializedSnapshot).toEqual({});
    expect(result.staticRi).toEqual({
      "0": { startPoint: 2, transformationShift: 0 },
    });
  });

  it("returns unchanged when materialized positions and values are stable", () => {
    const result = materializeReferencedRiIntoRootStatic(
      {
        "0": { startPoint: 2, transformationShift: 0 },
        "5": { startPoint: 10, transformationShift: 0 },
      },
      [5],
      {
        "5": { startPoint: 10, transformationShift: 0 },
      },
      [
        {
          fromNetwork: true,
          riLocked: true,
          riPosition: 5,
          riStart: 10,
          riShift: 0,
          lockToggleDisabled: false,
        },
      ],
    );

    expect(result.changed).toBe(false);
    expect(result.materializedPositions).toEqual([5]);
    expect(result.materializedSnapshot).toEqual({
      "5": { startPoint: 10, transformationShift: 0 },
    });
    expect(result.staticRi).toEqual({
      "0": { startPoint: 2, transformationShift: 0 },
      "5": { startPoint: 10, transformationShift: 0 },
    });
  });

  it("keeps user-overridden root static value at previously materialized position", () => {
    const result = materializeReferencedRiIntoRootStatic(
      {
        "0": { startPoint: 2, transformationShift: 0 },
        "5": { startPoint: 77, transformationShift: 9 },
      },
      [5],
      {
        "5": { startPoint: 10, transformationShift: 0 },
      },
      [],
    );

    expect(result.changed).toBe(true);
    expect(result.materializedPositions).toEqual([]);
    expect(result.materializedSnapshot).toEqual({});
    expect(result.staticRi).toEqual({
      "0": { startPoint: 2, transformationShift: 0 },
      "5": { startPoint: 77, transformationShift: 9 },
    });
  });
});
