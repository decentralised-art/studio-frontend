import { beforeEach, describe, expect, it, vi } from "vitest";

import { extraChainSourceProfiles, mockUsers, mockUsersById } from "../src/lib/data/users";

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("auth profile source bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("resolves legacy followed user ids to chain source addresses", async () => {
    window.localStorage.setItem("hypermusic_token", "services-token");
    const { getOrCreateMockEthereumAccount } = await import("../src/lib/auth/mockEthereum");
    const storedJunAccount = getOrCreateMockEthereumAccount("mock-user:user-jun");

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        user: {
          id: "real-lyra",
          email: "user-lyra@mock.decentralised.art",
          display_name: "Lyra N.",
          profile_json: {
            public: {
              social_preferences: {
                followed_user_ids: ["user-jun", "chain-source-fa71"],
              },
            },
          },
        },
      }),
    );

    const { getCurrentUserProfileState } = await import("../src/lib/auth/api");
    const state = await getCurrentUserProfileState();

    expect(state.social.followedUserAddresses).toContain(storedJunAccount.address.toLowerCase());
    expect(state.social.followedUserAddresses).not.toContain(
      mockUsersById["user-jun"].address.toLowerCase(),
    );
    expect(state.social.followedUserAddresses).toContain(
      "0xfa71ff2394596f824d69961293d095a50d322e4e",
    );
  });

  it("canonicalizes saved follows so legacy user ids cannot rehydrate unfollows", async () => {
    window.localStorage.setItem("hypermusic_token", "services-token");
    const junAddress = mockUsersById["user-jun"].address.toLowerCase();
    const sourceAddress = "0xfa71ff2394596f824d69961293d095a50d322e4e";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/auth/me")) {
        return jsonResponse({
          user: {
            id: "real-lyra",
            email: "user-lyra@mock.decentralised.art",
            display_name: "Lyra N.",
            profile_json: {
              public: {
                followedUserAddresses: [junAddress],
                followed_user_ids: ["user-jun"],
                social_preferences: {
                  followedUserAddresses: [junAddress],
                  followedUserIds: ["chain-source-fa71"],
                },
              },
            },
          },
        });
      }
      if (url.includes("/users/real-lyra") && init?.method === "PATCH") {
        return jsonResponse({ ok: true });
      }
      return jsonResponse({ message: "unexpected request" }, 500);
    });

    const { unfollowUserInProfile } = await import("../src/lib/auth/api");
    await unfollowUserInProfile(junAddress);

    const patchCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input).includes("/users/real-lyra") && init?.method === "PATCH",
    );
    expect(patchCall).toBeTruthy();
    const body = JSON.parse(String(patchCall?.[1]?.body ?? "{}")) as {
      profile_json?: {
        public?: {
          followed_user_addresses?: string[];
          followed_user_ids?: string[];
          followedUserAddresses?: string[];
          followedUserIds?: string[];
          social_preferences?: {
            followed_user_addresses?: string[];
            followed_user_ids?: string[];
            followedUserAddresses?: string[];
            followedUserIds?: string[];
          };
        };
      };
    };
    const profilePublic = body.profile_json?.public;
    expect(profilePublic?.followed_user_addresses).toEqual([sourceAddress]);
    expect(profilePublic).not.toHaveProperty("followed_user_ids");
    expect(profilePublic).not.toHaveProperty("followedUserAddresses");
    expect(profilePublic).not.toHaveProperty("followedUserIds");
    expect(profilePublic?.social_preferences?.followed_user_addresses).toEqual([sourceAddress]);
    expect(profilePublic?.social_preferences).not.toHaveProperty("followed_user_ids");
    expect(profilePublic?.social_preferences).not.toHaveProperty("followedUserAddresses");
    expect(profilePublic?.social_preferences).not.toHaveProperty("followedUserIds");
  });

  it("seeds empty mock profiles with prototype follow addresses", async () => {
    window.localStorage.setItem("hypermusic_token", "services-token");
    const { getOrCreateMockEthereumAccount } = await import("../src/lib/auth/mockEthereum");
    const storedJunAccount = getOrCreateMockEthereumAccount("mock-user:user-jun");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/auth/me")) {
        return jsonResponse({
          user: {
            id: "real-lyra",
            email: "user-lyra@mock.decentralised.art",
            display_name: "Lyra N.",
            profile_json: { public: {} },
          },
        });
      }
      if (url.includes("/users/real-lyra") && init?.method === "PATCH") {
        return jsonResponse({ ok: true });
      }
      return jsonResponse({ message: "unexpected request" }, 500);
    });

    const { getCurrentUserProfileState } = await import("../src/lib/auth/api");
    const state = await getCurrentUserProfileState({ bootstrapPrototypeIfEmpty: true });

    expect(state.social.followedUserAddresses).toEqual(
      expect.arrayContaining([
        ...mockUsers
          .filter((user) => user.id !== "user-lyra")
          .map((user) =>
            user.id === "user-jun"
              ? storedJunAccount.address.toLowerCase()
              : user.address.toLowerCase(),
          ),
        ...extraChainSourceProfiles.map((user) => user.address.toLowerCase()),
      ]),
    );
    expect(state.social.followedUserAddresses).not.toContain(
      mockUsersById["user-jun"].address.toLowerCase(),
    );

    const patchCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input).includes("/users/real-lyra") && init?.method === "PATCH",
    );
    expect(patchCall).toBeTruthy();
    const body = JSON.parse(String(patchCall?.[1]?.body ?? "{}")) as {
      profile_json?: { public?: { followed_user_addresses?: string[] } };
    };
    expect(body.profile_json?.public?.followed_user_addresses).toContain(
      "0xfa71ff2394596f824d69961293d095a50d322e4e",
    );
    expect(body.profile_json?.public?.followed_user_addresses).toContain(
      "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
    );
  });
});
