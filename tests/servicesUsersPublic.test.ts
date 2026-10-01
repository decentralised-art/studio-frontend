import { afterEach, describe, expect, it, vi } from "vitest";

import { listServicesUsers } from "../src/lib/auth/api";

const address = "0xfa71Ff2394596F824D69961293D095A50d322e4E";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("public services users", () => {
  it("loads names from public profile endpoints without a services session", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([address]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: address,
            display_name: "Sawyer",
            profile_json: { public: { nickname: "Sawyer" } },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const users = await listServicesUsers();

    expect(users).toHaveLength(1);
    expect(users[0]?.display_name).toBe("Sawyer");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(`/users/${address}`);
  });
});
