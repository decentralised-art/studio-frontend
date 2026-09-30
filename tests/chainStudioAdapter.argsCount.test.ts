import { describe, expect, it, vi } from "vitest";

vi.mock("$lib/chain/registryApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/chain/registryApi")>()),
  getChainAccount: async () => ({
    owned_connectors: ["root", "LocalRoot", "OtherLocal"],
    owned_transformations: ["tx", "standalone", "LocalTx"],
    owned_conditions: ["gate", "free", "LocalGate"],
  }),
  getChainConnector: async (name: string) => ({
    name,
    address: name === "root" ? `0x${"ab".repeat(20)}` : "0x0",
    owner: name === "OtherLocal" ? `0x${"34".repeat(20)}` : `0x${"12".repeat(20)}`,
    dimensions: [{ transformations: [{ name: "tx", args: [1, 2, 3] }] }],
    condition_name: "gate",
    condition_args: [1, 2],
  }),
  getChainTransformation: async (name: string) => ({
    name,
    args_count: name === "tx" ? 0 : 4,
    address: name === "LocalTx" ? "0x0" : `0x${"ab".repeat(20)}`,
    owner: `0x${"12".repeat(20)}`,
  }),
  getChainCondition: async (name: string) => ({
    name,
    args_count: name === "gate" ? 0 : 5,
    address: name === "LocalGate" ? "0x0" : `0x${"ab".repeat(20)}`,
    owner: `0x${"12".repeat(20)}`,
  }),
}));

import {
  fetchChainOwnedStudioSnapshot,
  fetchChainParticleForStudio,
} from "../src/lib/studio/chainStudioAdapter";

describe("owned Studio runtime metadata", () => {
  it("uses args_count including zero over connector bindings and hydrates standalone entities without source", async () => {
    const snapshot = await fetchChainOwnedStudioSnapshot(`0x${"12".repeat(20)}`);
    expect(snapshot.registry.transformations).toEqual({ tx: { argc: 0 }, standalone: { argc: 4 } });
    expect(snapshot.registry.conditions).toEqual({ gate: { argc: 0 }, free: { argc: 5 } });
    expect(Object.keys(snapshot.registry.connectors)).toEqual(["root"]);
    expect(snapshot.library.features[0].chainAddress).toBe(`0x${"ab".repeat(20)}`);
    expect(snapshot.particles.map((particle) => particle.id)).toEqual(["root"]);
  });

  it("discovers only the requested owner's local creates without adding Explore particles", async () => {
    const owner = `0x${"12".repeat(20)}`;
    const snapshot = await fetchChainOwnedStudioSnapshot(owner, {
      authorId: owner,
      origin: "local",
    });
    expect(Object.keys(snapshot.registry.connectors)).toEqual(["LocalRoot"]);
    expect(snapshot.library.features[0]).toMatchObject({
      chainAddress: "0x0",
      ownerAddress: owner,
    });
    expect(snapshot.library.transformations.map((item) => item.name)).toEqual(["LocalTx"]);
    expect(snapshot.library.conditions.map((item) => item.name)).toEqual(["LocalGate"]);
    expect(snapshot.particles).toEqual([]);
  });

  it("requires explicit owner-scoped access when fetching a local root", async () => {
    const options = { localOwnerAddress: `0x${"12".repeat(20)}` };
    expect((await fetchChainParticleForStudio("LocalRoot")).registry).toEqual({});
    expect((await fetchChainParticleForStudio("OtherLocal", options)).registry).toEqual({});
    const local = await fetchChainParticleForStudio("LocalRoot", options);
    expect(local.registry.connector?.chainAddress).toBe("0x0");
    expect(local.particleMeta).toBeUndefined();
  });
});
