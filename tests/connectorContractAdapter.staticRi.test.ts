import { describe, expect, it } from "vitest";
import {
  fromProtocolConnectorPayload,
  toProtocolConnectorPayload,
} from "../src/lib/chain/connectorContractAdapter";

describe("connectorContractAdapter static_ri mapping", () => {
  it("parses static_ri from protocol payload into connector.staticRi", () => {
    const connector = fromProtocolConnectorPayload({
      name: "root",
      dimensions: [{ transformations: [] }],
      static_ri: {
        "2": { start_point: 12, transformation_shift: 3 },
        "0": { start_point: 1, transformation_shift: 0 },
      },
    });

    expect(connector.staticRi).toEqual({
      "0": { startPoint: 1, transformationShift: 0 },
      "2": { startPoint: 12, transformationShift: 3 },
    });
  });

  it("accepts staticRi compatibility payload fields", () => {
    const connector = fromProtocolConnectorPayload({
      name: "root",
      dimensions: [{ transformations: [] }],
      staticRi: {
        "1": { startPoint: 4, transformShift: 7 },
      },
    } as never);

    expect(connector.staticRi).toEqual({
      "1": { startPoint: 4, transformationShift: 7 },
    });
  });

  it("serializes connector.staticRi into protocol static_ri", () => {
    const payload = toProtocolConnectorPayload({
      name: "root",
      dimensions: [{ transformations: [], bindings: {} }],
      staticRi: {
        "3": { startPoint: 33, transformationShift: 8 },
        "0": { startPoint: 2, transformationShift: 1 },
      },
    });

    expect(payload.static_ri).toEqual({
      "0": { start_point: 2, transformation_shift: 1 },
      "3": { start_point: 33, transformation_shift: 8 },
    });
  });

  it("accepts uint32 static_ri boundary values", () => {
    const payload = toProtocolConnectorPayload({
      name: "root",
      dimensions: [{ transformations: [], bindings: {} }],
      staticRi: {
        "0": { startPoint: 2_147_483_648, transformationShift: 4_294_967_295 },
      },
    });

    expect(payload.static_ri).toEqual({
      "0": { start_point: 2_147_483_648, transformation_shift: 4_294_967_295 },
    });
  });

  it("rejects static_ri values outside uint32 range", () => {
    expect(() =>
      toProtocolConnectorPayload({
        name: "root",
        dimensions: [{ transformations: [], bindings: {} }],
        staticRi: {
          "0": { startPoint: 4_294_967_296, transformationShift: 0 },
        },
      }),
    ).toThrow(/uint32/);
  });

  it("omits static_ri when connector has no staticRi", () => {
    const payload = toProtocolConnectorPayload({
      name: "root",
      dimensions: [{ transformations: [], bindings: {} }],
    });

    expect(payload.static_ri).toBeUndefined();
  });

  it("serializes empty condition fields required by the connector API", () => {
    const payload = toProtocolConnectorPayload({
      name: "root",
      dimensions: [{ transformations: [], bindings: {} }],
    });

    expect(payload.condition_name).toBe("");
    expect(payload.condition_args).toEqual([]);
  });
});
