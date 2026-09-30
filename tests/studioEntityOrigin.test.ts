import { describe, expect, it } from "vitest";
import { fromProtocolConnectorPayload } from "../src/lib/chain/connectorContractAdapter";
import {
  isLocalEntityAddress,
  isOwnedLocalEntity,
  isPublishedChainAddress,
} from "../src/lib/studio/studioEntityOrigin";

const owner = `0x${"ab".repeat(20)}`;

describe("Studio entity provenance", () => {
  it("requires an actual nonzero chain address for Network", () => {
    expect(isPublishedChainAddress(owner)).toBe(true);
    for (const value of [undefined, "", "0x0", `0x${"0".repeat(40)}`, "0x123", "published"]) {
      expect(isPublishedChainAddress(value)).toBe(false);
    }
  });

  it("admits local zero addresses only for the current owner", () => {
    expect(isLocalEntityAddress("0x0")).toBe(true);
    expect(isLocalEntityAddress(`0x${"0".repeat(40)}`)).toBe(true);
    expect(isOwnedLocalEntity({ address: "0x0", owner: owner.slice(2).toUpperCase() }, owner)).toBe(
      true,
    );
    expect(isOwnedLocalEntity({ address: "0x0", owner }, `0x${"12".repeat(20)}`)).toBe(false);
    expect(isOwnedLocalEntity({ address: "0x0" }, "")).toBe(false);
    expect(isOwnedLocalEntity({ address: owner, owner }, owner)).toBe(false);
  });

  it("preserves chain and local address metadata through connector adaptation", () => {
    for (const address of [owner, "0x0"]) {
      expect(
        fromProtocolConnectorPayload({
          name: "Root",
          dimensions: [{ transformations: [] }],
          owner,
          address,
        }),
      ).toMatchObject({ chainAddress: address, ownerAddress: owner });
    }
  });
});
