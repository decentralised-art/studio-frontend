import { describe, expect, it } from "vitest";
import {
  buildNonceLoginMessage,
  createChainAuthRequest,
  createMockEthereumAccountFromPrivateKey,
  keccak256Hex,
  signMessageWithKeccak256,
} from "../src/lib/auth/mockEthereum";

describe("mockEthereum", () => {
  const privateKeyOne = "0x0000000000000000000000000000000000000000000000000000000000000001";

  it("computes known keccak256 vectors", () => {
    expect(keccak256Hex("")).toBe(
      "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
    );
    expect(keccak256Hex("abc")).toBe(
      "0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45",
    );
  });

  it("derives ethereum-compatible address from a known private key", () => {
    const account = createMockEthereumAccountFromPrivateKey(privateKeyOne);

    expect(account.publicKey).toBe(
      "0x0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8",
    );
    expect(account.address).toBe("0x7e5f4552091a69125d5dfcb7b8c2659029395bdf");
  });

  it("builds nonce login message and chain auth payload", () => {
    const account = createMockEthereumAccountFromPrivateKey(privateKeyOne);
    const authRequest = createChainAuthRequest(account, " 42 ");

    expect(authRequest.address).toBe(account.address);
    expect(authRequest.message).toBe("Login nonce: 42");
    expect(authRequest.signature).toMatch(/^[0-9a-f]{130}$/);
  });

  it("produces deterministic signatures with recovery byte 27/28", () => {
    const message = "Login nonce: 99";
    const signatureA = signMessageWithKeccak256(privateKeyOne, message);
    const signatureB = signMessageWithKeccak256(privateKeyOne, message);

    expect(signatureA).toBe(signatureB);

    const recovery = Number.parseInt(signatureA.slice(-2), 16);
    expect([27, 28]).toContain(recovery);
  });

  it("rejects empty nonce messages", () => {
    expect(() => buildNonceLoginMessage("   ")).toThrowError("Nonce is empty.");
  });
});
