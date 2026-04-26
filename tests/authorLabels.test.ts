import { asset } from "$app/paths";
import { describe, expect, it } from "vitest";

import {
  buildAuthorAvatarMapFromServicesUsers,
  resolveServicesUserAvatarUrl,
} from "../src/lib/social/authorLabels";

const address = "0xb584a15f38c2014cff54fdb1b417428b51999276";

describe("authorLabels", () => {
  it("extracts profile avatars from services users", () => {
    expect(
      resolveServicesUserAvatarUrl({
        id: "prototype",
        ethereum_address: address,
        profile_json: {
          public: {
            avatar_url: "/avatars/lyra.svg",
          },
        },
      }),
    ).toBe(asset("/avatars/lyra.svg"));
  });

  it("maps services user avatars by normalized chain address", () => {
    expect(
      buildAuthorAvatarMapFromServicesUsers([
        {
          id: "prototype",
          ethereum_address: address.toUpperCase(),
          profile_json: {
            public: {
              avatar_url: "/app/avatars/lyra.svg",
            },
          },
        },
      ]),
    ).toEqual({
      [address]: asset("/avatars/lyra.svg"),
    });
  });
});
