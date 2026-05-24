import { beforeEach, describe, expect, it, vi } from "vitest";

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });

const utf8Hex = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  return `0x${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
};

describe("browser wallet chain auth", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("authenticates with MetaMask signature and stores a wallet-scoped chain token", async () => {
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

describe("browser wallet services SIWE auth", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("requests a SIWE challenge, signs it, verifies it, and stores the services token", async () => {
    const address = "0x17A67177aF1A698205f30AffcE83cafb0c0E0bC4";
    const normalizedAddress = address.toLowerCase();
    const siweMessage = `${normalizedAddress} wants to sign in`;
    const provider = {
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === "eth_requestAccounts") return [address];
        if (method === "eth_chainId") return "0x1";
        if (method === "personal_sign") return "0xsiwesignature";
        throw new Error(`Unexpected provider method ${method}`);
      }),
    };

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/services/auth/siwe/challenge")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          address?: string;
          chain_id?: number;
          app_origin?: string;
        };
        expect(body.address).toBe(normalizedAddress);
        expect(body.chain_id).toBe(1);
        expect(body.app_origin).toBe(window.location.origin);
        return jsonResponse({
          message: siweMessage,
          expires_at: "2026-05-24T12:00:00Z",
        });
      }
      if (url.includes("/services/auth/siwe/verify")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          message?: string;
          signature?: string;
        };
        expect(body.message).toBe(siweMessage);
        expect(body.signature).toBe("0xsiwesignature");
        return jsonResponse("services-siwe-token");
      }
      if (url.includes("/services/auth/me")) {
        expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer services-siwe-token");
        return jsonResponse({
          id: normalizedAddress,
          display_name: "Person",
          profile_json: {},
        });
      }
      return jsonResponse({ message: `Unexpected request ${url}` }, 500);
    });

    const { loginWithBrowserWalletServicesAccount } = await import("../src/lib/auth/api");
    type LoginOptions = NonNullable<Parameters<typeof loginWithBrowserWalletServicesAccount>[0]>;
    const result = await loginWithBrowserWalletServicesAccount({
      provider: provider as LoginOptions["provider"],
    });

    expect(result.address).toBe(normalizedAddress);
    expect(result.chainId).toBe(1);
    expect(provider.request).toHaveBeenCalledWith({ method: "eth_requestAccounts" });
    expect(provider.request).toHaveBeenCalledWith({ method: "eth_chainId" });
    expect(provider.request).toHaveBeenCalledWith({
      method: "personal_sign",
      params: [utf8Hex(siweMessage), normalizedAddress],
    });
    expect(window.localStorage.getItem("hypermusic_token")).toBe("services-siwe-token");
  });
});
