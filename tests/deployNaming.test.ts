import { describe, expect, it } from "vitest";

import {
  createEphemeralDeployName,
  isReservedCoreCollectionName,
} from "../src/lib/chain/deployNaming";

describe("deploy naming policy", () => {
  it("creates chain-safe test names for deploy experiments", () => {
    const value = createEphemeralDeployName("transformation", {
      scope: "ri smoke",
      authorTag: "Lyra N",
      date: new Date("2026-04-16T15:05:30Z"),
    });

    expect(value).toMatch(/^test_transformation_ri_smoke_lyra_n_20260416150530_[0-9a-f]{4}$/);
    expect(value).toMatch(/^[a-z_][a-z0-9_]*$/);
  });

  it("marks core collection names as reserved", () => {
    expect(isReservedCoreCollectionName("transformation", "add")).toBe(true);
    expect(isReservedCoreCollectionName("condition", "always_true")).toBe(true);
    expect(isReservedCoreCollectionName("condition", "custom_gate")).toBe(false);
  });
});
