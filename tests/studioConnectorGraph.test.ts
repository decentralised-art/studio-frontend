import type { Edge } from "@xyflow/svelte";
import { describe, expect, it } from "vitest";

import {
  cloneStaticRiMap,
  parseConnectorEdgeBindingSlot,
  parseConnectorEdgeRelation,
  parseStaticRiPayload,
  resolveConnectorSelfStaticRi,
  toCanonicalPositionKey,
  toInt,
} from "../src/lib/studio/connectorGraph";

const edge = (partial: Partial<Edge>): Edge =>
  ({
    id: "edge-1",
    source: "source",
    target: "target",
    ...partial,
  }) as Edge;

describe("Studio connector graph helpers", () => {
  it("normalizes non-negative integer fields", () => {
    expect(toInt("5.9")).toBe(5);
    expect(toInt(-2)).toBe(0);
    expect(toInt("bad")).toBeUndefined();
    expect(toCanonicalPositionKey("01")).toBe("1");
    expect(toCanonicalPositionKey("1.5")).toBeNull();
  });

  it("parses connector edge relations from metadata before labels", () => {
    expect(parseConnectorEdgeRelation(edge({ data: { relation: "binding" } }))).toBe("binding");
    expect(parseConnectorEdgeRelation(edge({ data: { kind: "composite" } }))).toBe("composite");
    expect(parseConnectorEdgeRelation(edge({ label: "Binding slot 0" }))).toBe("binding");
    expect(parseConnectorEdgeRelation(edge({ label: "Composite" }))).toBe("composite");
    expect(parseConnectorEdgeRelation(edge({ label: "depends on" }))).toBe("unknown");
  });

  it("parses connector edge binding slots from current, legacy, and label metadata", () => {
    expect(parseConnectorEdgeBindingSlot(edge({ data: { bindingSlot: 2 } }))).toBe(2);
    expect(parseConnectorEdgeBindingSlot(edge({ data: { binding_slot: 3 } }))).toBe(3);
    expect(parseConnectorEdgeBindingSlot(edge({ data: { slot: 4 } }))).toBe(4);
    expect(parseConnectorEdgeBindingSlot(edge({ label: "Binding slot 5" }))).toBe(5);
    expect(parseConnectorEdgeBindingSlot(edge({ data: { bindingSlot: "6" } }))).toBeNull();
    expect(parseConnectorEdgeBindingSlot(edge({ data: { bindingSlot: -1 } }))).toBeNull();
  });

  it("clones and canonicalizes static RI maps", () => {
    expect(
      cloneStaticRiMap({
        "02": { startPoint: Number.NaN, transformationShift: 5.8 },
        "0": { startPoint: 3.2, transformationShift: -8 },
        "-1": { startPoint: 1, transformationShift: 1 },
      }),
    ).toEqual({
      "0": { startPoint: 3, transformationShift: 0 },
      "2": { startPoint: 0, transformationShift: 5 },
    });
  });

  it("parses static RI payloads with snake_case and camelCase fields", () => {
    expect(
      parseStaticRiPayload({
        "0": { start_point: "4", transformation_shift: "8" },
        "1": { startPoint: "2", transformationShift: "3" },
        "1.5": { start_point: 9, transformation_shift: 9 },
      }),
    ).toEqual({
      "0": { startPoint: 4, transformationShift: 8 },
      "1": { startPoint: 2, transformationShift: 3 },
    });
  });

  it("resolves self static RI only from position zero", () => {
    expect(
      resolveConnectorSelfStaticRi({ "0": { startPoint: 1, transformationShift: 2 } }),
    ).toEqual({
      startPoint: 1,
      transformationShift: 2,
    });
    expect(
      resolveConnectorSelfStaticRi({ "2": { startPoint: 1, transformationShift: 2 } }, 2),
    ).toBeNull();
  });
});
