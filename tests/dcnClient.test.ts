import { describe, expect, it, vi } from "vitest";

import { createDcnClient, resolveDcnClientBaseUrl } from "../src/lib/chain/dcnClient";

describe("dcnClient", () => {
  it("preserves absolute chain API base URLs", () => {
    expect(resolveDcnClientBaseUrl("https://api.example.invalid/chain/")).toBe(
      "https://api.example.invalid/chain",
    );
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
});
