import { describe, expect, it } from "vitest";
import {
  publicationAddressUrl,
  publicationTransactionUrl,
} from "../src/lib/studio/publicationExplorer";

const tx_hash = `0x${"ab".repeat(32)}`;
const address = `0x${"cd".repeat(20)}`;

describe("publication explorer links", () => {
  it("opens the explorer for the saved chain, transaction, and address", () => {
    expect(publicationTransactionUrl({ chainId: "0xaa36a7", tx_hash })).toBe(
      `https://sepolia.etherscan.io/tx/${tx_hash}`,
    );
    expect(publicationAddressUrl({ chainId: "0x1", address })).toBe(
      `https://etherscan.io/address/${address}`,
    );
  });

  it("does not invent a link for an unknown chain or invalid identifier", () => {
    expect(publicationTransactionUrl({ chainId: "0x2", tx_hash })).toBeNull();
    expect(publicationTransactionUrl({ chainId: "0xaa36a7", tx_hash: "bad" })).toBeNull();
    expect(publicationAddressUrl({ chainId: "0xaa36a7", address: "0x0" })).toBeNull();
  });
});
