import { asset } from "$app/paths";
import { describe, expect, it } from "vitest";

import { normalizeProfileUser, resolveProfileAvatarUrl } from "../src/lib/user/profileModel";

describe("profileModel", () => {
  it("resolves stored static avatar paths through the app asset base", () => {
    const expected = asset("/avatars/lyra.svg");

    expect(resolveProfileAvatarUrl("/avatars/lyra.svg")).toBe(expected);
    expect(resolveProfileAvatarUrl("avatars/lyra.svg")).toBe(expected);
    expect(resolveProfileAvatarUrl("/app/avatars/lyra.svg")).toBe(expected);
  });

  it("keeps external profile avatar URLs unchanged", () => {
    expect(resolveProfileAvatarUrl("https://example.test/avatar.png")).toBe(
      "https://example.test/avatar.png",
    );
    expect(resolveProfileAvatarUrl("data:image/svg+xml,%3Csvg%3E%3C/svg%3E")).toBe(
      "data:image/svg+xml,%3Csvg%3E%3C/svg%3E",
    );
  });

  it("normalizes service profile avatar URLs before rendering", () => {
    const user = normalizeProfileUser({
      id: "user-1",
      display_name: "Prototype",
      profile_json: {
        public: {
          avatar_url: "/avatars/lyra.svg",
        },
      },
    });

    expect(user.avatarUrl).toBe(asset("/avatars/lyra.svg"));
  });

  it("ignores the legacy Lyra avatar on the prototype services account", () => {
    const user = normalizeProfileUser({
      id: "prototype",
      email: "user-lyra@mock.decentralised.art",
      display_name: "prototype_test_account",
      profile_json: {
        public: {
          avatar_url: "/avatars/lyra.svg",
        },
      },
    });

    expect(user.avatarUrl).toBe("");
  });

  it("does not assign the mock Lyra avatar to profiles without avatars", () => {
    const user = normalizeProfileUser({
      id: "user-1",
      display_name: "Prototype",
      profile_json: {
        public: {},
      },
    });

    expect(user.avatarUrl).toBe("");
  });
});
