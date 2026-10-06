import { beforeEach, describe, expect, it, vi } from "vitest";

const { createDcnClientMock, getNonceMock, loginWithSignatureMock } = vi.hoisted(() => ({
  createDcnClientMock: vi.fn(),
  getNonceMock: vi.fn(),
  loginWithSignatureMock: vi.fn(),
}));

vi.mock("$lib/chain/dcnClient", () => ({
  createDcnClient: createDcnClientMock,
  isDcnApiError: (error: unknown) =>
    Boolean(
      error &&
      typeof error === "object" &&
      (error as { name?: string }).name === "DecentralisedArtApiError",
    ),
}));

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
    createDcnClientMock.mockReset();
    getNonceMock.mockReset();
    loginWithSignatureMock.mockReset();
    createDcnClientMock.mockReturnValue({
      getNonce: getNonceMock,
      loginWithSignature: loginWithSignatureMock,
    });
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
    const nonce = "ab".repeat(33);
    const message = `https://decentralised.art wants you to sign in with your Ethereum account:\n${address}\n\nNonce: ${nonce}\n`;
    getNonceMock.mockResolvedValue({ nonce, message });
    loginWithSignatureMock.mockResolvedValue({ access_token: "chain-token" });

    const { loginWithBrowserWalletChainAccount } = await import("../src/lib/auth/api");
    type LoginOptions = NonNullable<Parameters<typeof loginWithBrowserWalletChainAccount>[0]>;
    const result = await loginWithBrowserWalletChainAccount({
      provider: provider as LoginOptions["provider"],
    });

    expect(result.address).toBe(normalizedAddress);
    expect(provider.request).toHaveBeenCalledWith({ method: "eth_requestAccounts" });
    expect(provider.request).toHaveBeenCalledWith({
      method: "personal_sign",
      params: [message, normalizedAddress],
    });
    expect(result).toMatchObject({ nonce, message });
    expect(getNonceMock).toHaveBeenCalledWith(normalizedAddress, {
      origin: window.location.origin,
    });
    expect(loginWithSignatureMock).toHaveBeenCalledWith(normalizedAddress, nonce, "abc123");
    expect(window.localStorage.getItem("hypermusic_chain_token")).toBe("chain-token");
    expect(window.localStorage.getItem("hypermusic_chain_token_user_id")).toBe(
      `wallet:${normalizedAddress}`,
    );
  });

  it.each([
    { nonce: "ab".repeat(33) },
    { nonce: "ab".repeat(33), message: "   " },
    { nonce: "42", message: "Sign in" },
  ])("rejects a malformed challenge before asking the wallet to sign: %j", async (challenge) => {
    getNonceMock.mockResolvedValue(challenge);
    const provider = {
      request: vi.fn(async () => [`0x${"12".repeat(20)}`]),
    };
    const { authenticateBrowserWalletInChain } = await import("../src/lib/auth/api");
    type LoginOptions = NonNullable<Parameters<typeof authenticateBrowserWalletInChain>[0]>;
    await expect(
      authenticateBrowserWalletInChain({ provider: provider as LoginOptions["provider"] }),
    ).rejects.toThrow(/Chain nonce response/);
    expect(provider.request).toHaveBeenCalledOnce();
    expect(loginWithSignatureMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("hypermusic_chain_token")).toBeNull();
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
