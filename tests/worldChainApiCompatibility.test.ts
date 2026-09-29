import type { DcnClient } from "dcn";
import { describe, expect, it, vi } from "vitest";
import { createWorldChainClient } from "../src/lib/worlds/chainApiCompatibility";

describe("uploaded World execute contract negotiation", () => {
  const result = {
    block_number: 123,
    block_hash: `0x${"ab".repeat(32)}`,
    runner: `0x${"12".repeat(20)}`,
    particles: [{ path: "pitch", data: [60] }],
  };
  it.each([undefined, 1, 2] as const)(
    "negotiates chainApiVersion %s and retains provenance in the host",
    async (version) => {
      const execute = vi.fn(async () => result);
      const simulate = vi.fn(async () => result.particles);
      const provenance = vi.fn();
      const client = createWorldChainClient(
        { execute, simulate } as unknown as DcnClient,
        version,
        provenance,
      );
      expect(await client.execute("demo", 1)).toEqual(version === 2 ? result : result.particles);
      expect(execute).toHaveBeenCalledWith("demo", 1);
      expect(simulate).not.toHaveBeenCalled();
      expect(provenance).toHaveBeenCalledWith({
        block_number: 123,
        block_hash: result.block_hash,
        runner: result.runner,
      });
      expect(await client.simulate("draft", 1)).toEqual(result.particles);
    },
  );
});
