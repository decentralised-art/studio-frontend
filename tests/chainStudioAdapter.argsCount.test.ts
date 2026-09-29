import { describe, expect, it, vi } from "vitest";

vi.mock("$lib/chain/registryApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/chain/registryApi")>()),
  getChainAccount: async () => ({
    owned_connectors: ["root"],
    owned_transformations: ["tx", "standalone"],
    owned_conditions: ["gate", "free"],
  }),
  getChainConnector: async () => ({
    name: "root",
    dimensions: [{ transformations: [{ name: "tx", args: [1, 2, 3] }] }],
    condition_name: "gate",
    condition_args: [1, 2],
  }),
  getChainTransformation: async (name: string) => ({ name, args_count: name === "tx" ? 0 : 4 }),
  getChainCondition: async (name: string) => ({ name, args_count: name === "gate" ? 0 : 5 }),
}));

import { fetchChainOwnedStudioSnapshot } from "../src/lib/studio/chainStudioAdapter";

describe("owned Studio runtime metadata", () => {
  it("uses args_count including zero over connector bindings and hydrates standalone entities without source", async () => {
    const snapshot = await fetchChainOwnedStudioSnapshot(`0x${"12".repeat(20)}`);
    expect(snapshot.registry.transformations).toEqual({ tx: { argc: 0 }, standalone: { argc: 4 } });
    expect(snapshot.registry.conditions).toEqual({ gate: { argc: 0 }, free: { argc: 5 } });
  });
});
