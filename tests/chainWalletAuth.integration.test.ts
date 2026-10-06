import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  loginWithBrowserWalletChainAccount,
  type BrowserEthereumProvider,
} from "../src/lib/auth/api";
import { clearChainToken, getChainToken } from "../src/lib/auth/session";

const address = `0x${"12".repeat(20)}`;
const nonce = "ab".repeat(33);
const message = `https://decentralised.art wants you to sign in with your Ethereum account:\n${address}\n\nNonce: ${nonce}\n`;
const signature = `0x${"34".repeat(65)}`;
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("chain wallet sign-in through the pinned SDK", () => {
  beforeEach(clearChainToken);
  afterEach(() => vi.restoreAllMocks());

  it("signs the exact issued message and sends the current authentication body", async () => {
    const provider = {
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === "eth_requestAccounts") return [address];
        if (method === "personal_sign") return signature;
        throw new Error(`Unexpected wallet method ${method}`);
      }),
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      expect(new Headers(init?.headers).get("Authorization")).toBeNull();
      if (url.pathname.endsWith(`/nonce/${address}`)) {
        expect(url.searchParams.get("origin")).toBe(window.location.origin);
        return jsonResponse({ nonce, message });
      }
      expect(url.pathname).toMatch(/\/auth$/);
      expect(JSON.parse(String(init?.body))).toEqual({
        address,
        nonce,
        signature: signature.slice(2),
      });
      return jsonResponse({ access_token: "chain-session" });
    });

    await loginWithBrowserWalletChainAccount({ provider: provider as BrowserEthereumProvider });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(provider.request).toHaveBeenCalledWith({
      method: "personal_sign",
      params: [message, address],
    });
    expect(getChainToken()).toBe("chain-session");
  });

  it("surfaces challenge errors from the renamed SDK without prompting for a signature", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: "origin is not a configured sign-in origin" }, 400),
    );
    const provider = { request: vi.fn(async () => [address]) };
    await expect(
      loginWithBrowserWalletChainAccount({ provider: provider as BrowserEthereumProvider }),
    ).rejects.toThrow("origin is not a configured sign-in origin");
    expect(provider.request).toHaveBeenCalledOnce();
    expect(getChainToken()).toBeNull();
  });
});
