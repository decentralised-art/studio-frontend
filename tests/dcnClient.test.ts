import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearChainToken, setChainToken } from "../src/lib/auth/session";
import {
  createDcnClient,
  isDcnApiError,
  resolveDcnClientBaseUrl,
} from "../src/lib/chain/dcnClient";

describe("dcnClient", () => {
  beforeEach(() => {
    clearChainToken();
  });

  it("preserves absolute chain API base URLs", () => {
    expect(resolveDcnClientBaseUrl("https://api.example.invalid/chain/")).toBe(
      "https://api.example.invalid/chain",
    );
  });

  it.each(["0x6000", null])("preserves deployed bytecode metadata: %j", async (runtime_code) => {
    const body = {
      name: "op",
      args_count: 1,
      runtime_code,
      owner: `0x${"12".repeat(20)}`,
      address: "0x0",
    };
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          headers: { "content-type": "application/json" },
        }),
    );
    const client = createDcnClient({ accessToken: null, fetch: fetchMock });
    expect(await client.transformationGet("op")).toEqual(body);
    expect(await client.conditionGet("op")).toEqual(body);
  });

  it("recognizes errors from the current SDK", async () => {
    const client = createDcnClient({
      fetch: async () =>
        new Response(JSON.stringify({ message: "Not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
    });
    const error = await client.connectorGet("missing").catch((error: unknown) => error);
    expect(isDcnApiError(error)).toBe(true);
    expect(error).toMatchObject({ status: 404, body: { message: "Not found" } });
  });

  it("resolves browser-relative chain API base URLs before passing them to the SDK", () => {
    expect(resolveDcnClientBaseUrl("/chain/")).toBe(`${window.location.origin}/chain`);
    expect(resolveDcnClientBaseUrl("chain")).toBe(`${window.location.origin}/chain`);
  });

  it("allows SDK requests to build URLs from the dev proxy base", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            limit: 1,
            cursor: {
              has_more: false,
              next_before: null,
            },
            items: [],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
    );

    const client = createDcnClient({
      accessToken: null,
      fetch: fetchMock,
    });

    await client.feed({ limit: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${window.location.origin}/chain/feed?limit=1`);
  });

  it("uses the cached chain token when accessToken is omitted", async () => {
    setChainToken("cached-chain-token");
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ name: "published", owner: "0xabc" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
    );

    const client = createDcnClient({ fetch: fetchMock });
    await client.connectorPost({ name: "published", dimensions: [] });

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer cached-chain-token");
  });

  it("does not fall back to the cached chain token when accessToken is null", async () => {
    setChainToken("cached-chain-token");
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ name: "published", owner: "0xabc" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
    );

    const client = createDcnClient({ accessToken: null, fetch: fetchMock });
    await client.connectorPost({ name: "published", dimensions: [] });

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("Authorization")).toBeNull();
  });
});
