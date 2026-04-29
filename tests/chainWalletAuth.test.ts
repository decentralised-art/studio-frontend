import { beforeEach, describe, expect, it, vi } from "vitest";

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("browser wallet chain auth", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("authenticates with MetaMask signature and stores a wallet-scoped chain token", async () => {
    window.localStorage.setItem("hypermusic_token", "services-token");
    const address = "0x17A67177aF1A698205f30AffcE83cafb0c0E0bC4";
    const normalizedAddress = address.toLowerCase();
    const provider = {
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === "eth_requestAccounts") return [address];
        if (method === "personal_sign") return "0xabc123";
        throw new Error(`Unexpected provider method ${method}`);
      }),
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/chain/nonce/")) return jsonResponse({ nonce: "nonce-1" });
      if (url.includes("/chain/auth")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as { signature?: string };
        expect(body.signature).toBe("abc123");
        return jsonResponse("chain-token");
      }
      if (url.includes("/services/auth/me")) {
        return jsonResponse({
          id: "services-user",
          email: "person@example.com",
          display_name: "Person",
          profile_json: {},
        });
      }
      if (url.includes("/services/users/services-user") && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body ?? "{}")) as { ethereum_address?: string };
        expect(body.ethereum_address).toBe(normalizedAddress);
        return jsonResponse({ id: "services-user", ethereum_address: normalizedAddress });
      }
      return jsonResponse({ message: `Unexpected request ${url}` }, 500);
    });

    const { loginWithBrowserWalletChainAccount } = await import("../src/lib/auth/api");
    type LoginOptions = NonNullable<Parameters<typeof loginWithBrowserWalletChainAccount>[0]>;
    const result = await loginWithBrowserWalletChainAccount({
      provider: provider as LoginOptions["provider"],
    });

    expect(result.address).toBe(normalizedAddress);
    expect(provider.request).toHaveBeenCalledWith({ method: "eth_requestAccounts" });
    expect(provider.request).toHaveBeenCalledWith({
      method: "personal_sign",
      params: ["Login nonce: nonce-1", normalizedAddress],
    });
    expect(window.localStorage.getItem("hypermusic_chain_token")).toBe("chain-token");
    expect(window.localStorage.getItem("hypermusic_chain_token_user_id")).toBe(
      `wallet:${normalizedAddress}`,
    );
    expect(fetchMock).toHaveBeenCalled();
  });
});
