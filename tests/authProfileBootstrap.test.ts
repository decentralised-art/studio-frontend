import { beforeEach, describe, expect, it, vi } from "vitest";

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("auth profile state", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("ignores legacy followed user ids instead of resolving bundled mock accounts", async () => {
    window.localStorage.setItem("hypermusic_token", "services-token");

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        user: {
          id: "real-user",
          email: "user@example.test",
          display_name: "Real User",
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

    expect(state.social.followedUserAddresses).toEqual([]);
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

  it("does not add prototype chain source aliases by email or display name", async () => {
    const { resolveCurrentUserChainSourceAddresses } = await import("../src/lib/auth/api");

    expect(
      resolveCurrentUserChainSourceAddresses({
        user: {
          id: "real-user",
          email: "user-lyra@mock.decentralised.art",
          display_name: "prototype_test_account",
          ethereum_address: "0x17a67177af1a698205f30affce83cafb0c0e0bc4",
          profile_json: { public: {} },
        },
      }),
    ).toEqual(["0x17a67177af1a698205f30affce83cafb0c0e0bc4"]);
  });

  it("canonicalizes saved follows so legacy user ids cannot rehydrate unfollows", async () => {
    window.localStorage.setItem("hypermusic_token", "services-token");
    const followedAddress = "0x17a67177af1a698205f30affce83cafb0c0e0bc4";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/auth/me")) {
        return jsonResponse({
          user: {
            id: "real-user",
            email: "user@example.test",
            display_name: "Real User",
            profile_json: {
              public: {
                followedUserAddresses: [followedAddress],
                followed_user_ids: ["user-jun"],
                social_preferences: {
                  followedUserAddresses: [followedAddress],
                  followedUserIds: ["chain-source-fa71"],
                },
              },
            },
          },
        });
      }
      if (url.includes("/users/real-user") && init?.method === "PATCH") {
        return jsonResponse({ ok: true });
      }
      return jsonResponse({ message: "unexpected request" }, 500);
    });

    const { unfollowUserInProfile } = await import("../src/lib/auth/api");
    await unfollowUserInProfile(followedAddress);

    const patchCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input).includes("/users/real-user") && init?.method === "PATCH",
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
    expect(profilePublic?.followed_user_addresses).toEqual([]);
    expect(profilePublic).not.toHaveProperty("followed_user_ids");
    expect(profilePublic).not.toHaveProperty("followedUserAddresses");
    expect(profilePublic).not.toHaveProperty("followedUserIds");
    expect(profilePublic?.social_preferences?.followed_user_addresses).toEqual([]);
    expect(profilePublic?.social_preferences).not.toHaveProperty("followed_user_ids");
    expect(profilePublic?.social_preferences).not.toHaveProperty("followedUserAddresses");
    expect(profilePublic?.social_preferences).not.toHaveProperty("followedUserIds");
  });

  it("does not seed empty profiles with mock follow addresses", async () => {
    window.localStorage.setItem("hypermusic_token", "services-token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/auth/me")) {
        return jsonResponse({
          user: {
            id: "real-user",
            email: "user@example.test",
            display_name: "Real User",
            profile_json: { public: {} },
          },
        });
      }
      if (url.includes("/users/real-user") && init?.method === "PATCH") {
        return jsonResponse({ ok: true });
      }
      return jsonResponse({ message: "unexpected request" }, 500);
    });

    const { getCurrentUserProfileState } = await import("../src/lib/auth/api");
    const state = await getCurrentUserProfileState();

    expect(state.social.followedUserAddresses).toEqual([]);
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) => String(input).includes("/users/real-user") && init?.method === "PATCH",
      ),
    ).toBe(false);
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
        email: "user@example.test",
        display_name: "Current User",
        ethereum_address: "0xb584a15f38c2014cff54fdb1b417428b51999276",
        profile_json: {
          public: {
            nickname: "Current User",
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

  it("keeps cached profile JSON when profile updates return partial user payloads", async () => {
    window.localStorage.setItem("hypermusic_token", "services-token");
    const existingMePayload = {
      user: {
        id: "real-user",
        email: "user@example.test",
        display_name: "Adam",
        profile_json: {
          public: {
            nickname: "Adam",
            bio: "Prototype composer profile.",
            toolbox_library: {
              connector: ["pitch"],
              transformation: [],
              condition: [],
            },
          },
        },
      },
    };
    window.localStorage.setItem("dcn_services_me_cache_v1", JSON.stringify(existingMePayload));

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        user: {
          id: "real-user",
          display_name: "sunsetsobserver",
        },
      }),
    );

    const { getCachedMe, updateUserById } = await import("../src/lib/auth/api");
    const { normalizeProfileUser } = await import("../src/lib/user/profileModel");
    const nextProfileJson = {
      public: {
        nickname: "sunsetsobserver",
        bio: "Prototype composer profile.",
        toolbox_library: {
          connector: ["pitch"],
          transformation: [],
          condition: [],
        },
      },
    };

    const payload = await updateUserById("real-user", {
      display_name: "sunsetsobserver",
      profile_json: nextProfileJson,
    });

    expect(normalizeProfileUser(payload).bio).toBe("Prototype composer profile.");
    expect(normalizeProfileUser(getCachedMe()).bio).toBe("Prototype composer profile.");
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
