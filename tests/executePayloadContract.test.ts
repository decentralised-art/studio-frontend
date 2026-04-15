import { describe, expect, it } from "vitest";
import { normalizeChainExecutePayload } from "../src/lib/chain/executePayloadContract";

describe("execute payload contract normalizer", () => {
  it("normalizes connector_name and sorts dynamic_ri keys", () => {
    const normalized = normalizeChainExecutePayload({
      connector_name: "  t0  ",
      particles_count: "12",
      dynamic_ri: {
        "3": { start_point: 1, transformation_shift: 2 },
        "0": { start_point: 10, transformation_shift: 0 },
      },
    });

    expect(normalized).toEqual({
      connector_name: "t0",
      particles_count: "12",
      dynamic_ri: {
        "0": { start_point: 10, transformation_shift: 0 },
        "3": { start_point: 1, transformation_shift: 2 },
      },
    });
  });

  it("rejects legacy or unknown top-level fields", () => {
    expect(() =>
      normalizeChainExecutePayload({
        connector_name: "t0",
        particles_count: "5",
        dynamic_ri: {},
        running_instances: [],
      } as unknown as {
        connector_name: string;
        particles_count: string;
        dynamic_ri: Record<string, { start_point: number; transformation_shift: number }>;
      }),
    ).toThrowError(/unsupported top-level keys/i);
  });

  it("rejects non-canonical dynamic_ri keys", () => {
    expect(() =>
      normalizeChainExecutePayload({
        connector_name: "t0",
        particles_count: "5",
        dynamic_ri: {
          "01": { start_point: 0, transformation_shift: 0 },
        },
      }),
    ).toThrowError(/canonical non-negative integer string/i);
  });

  it("rejects invalid particles_count", () => {
    expect(() =>
      normalizeChainExecutePayload({
        connector_name: "t0",
        particles_count: "0005",
        dynamic_ri: {},
      }),
    ).toThrowError(/particles_count/i);
  });
});
