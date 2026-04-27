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

  it("resolves current user chain source aliases from profile json", async () => {
    const { resolveCurrentUserChainSourceAddresses } = await import("../src/lib/auth/api");

    expect(
      resolveCurrentUserChainSourceAddresses({
        user: {
          id: "real-user",
          ethereum_address: "0x17a67177af1a698205f30affce83cafb0c0e0bc4",
          profile_json: {
            public: {
              chain_source_addresses: ["0xb584a15f38c2014cff54fdb1b417428b51999276"],
            },
          },
        },
      }),
    ).toEqual([
      "0x17a67177af1a698205f30affce83cafb0c0e0bc4",
      "0xb584a15f38c2014cff54fdb1b417428b51999276",
    ]);
  });

  it("keeps the canonical prototype account chain source as an authored alias", async () => {
    const { resolveCurrentUserChainSourceAddresses } = await import("../src/lib/auth/api");

    expect(
      resolveCurrentUserChainSourceAddresses({
        user: {
          id: "real-lyra",
          email: "user-lyra@mock.decentralised.art",
          display_name: "prototype_test_account",
          ethereum_address: "0x17a67177af1a698205f30affce83cafb0c0e0bc4",
          profile_json: { public: {} },
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        "0x17a67177af1a698205f30affce83cafb0c0e0bc4",
        "0xb584a15f38c2014cff54fdb1b417428b51999276",
      ]),
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

  it("loads the full connector toolbox from the current services profile", async () => {
    window.localStorage.setItem("hypermusic_token", "services-token");
    const connectorToolbox = [
      "pitch",
      "time",
      "test_random_transformation1234",
      "test_random_add_connector_20260420_01",
      "velocity",
      "duration",
      "test_midi_chromatic_in_time_stable_duration_and_velocity12345",
      "test_various_midi_values12345",
      "test_midi_polyphony089768",
      "test_connector_polyphony_every_second12345678456",
      "test_break_add2_56079",
      "A2_breath_return_layer_realized",
      "A2_breath_return_overlay",
      "A2_breath_return_overlay_realized",
    ];
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        id: "43e7e391-55fb-4956-950f-85f99fe7900f",
        email: "user-lyra@mock.decentralised.art",
        display_name: "prototype_test_account",
        ethereum_address: "0xb584a15f38c2014cff54fdb1b417428b51999276",
        profile_json: {
          public: {
            nickname: "prototype_test_account",
            toolbox: [...connectorToolbox],
            toolbox_library: {
              connector: [...connectorToolbox],
              transformation: ["subtract", "add"],
              condition: [],
            },
          },
        },
      }),
    );

    const { getCurrentUserToolboxLibrary } = await import("../src/lib/auth/api");
    const toolbox = await getCurrentUserToolboxLibrary();

    expect(toolbox.connector).toEqual(connectorToolbox);
    expect(toolbox.transformation).toEqual(["subtract", "add"]);
  });

  it("does not fall back to bundled mock toolbox entries without a services session", async () => {
    const { getCurrentUserToolboxLibrary } = await import("../src/lib/auth/api");

    await expect(getCurrentUserToolboxLibrary()).resolves.toEqual({
      connector: [],
      transformation: [],
      condition: [],
    });
  });

  it("clears stale services tokens when auth/me returns not found", async () => {
    window.localStorage.setItem("hypermusic_token", "stale-services-token");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));

    const { getCurrentUserToolboxLibrary } = await import("../src/lib/auth/api");

    await expect(getCurrentUserToolboxLibrary()).rejects.toThrow("Failed to load account.");
    expect(window.localStorage.getItem("hypermusic_token")).toBeNull();
  });
});
