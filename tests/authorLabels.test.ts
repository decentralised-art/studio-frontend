import { asset } from "$app/paths";
import { describe, expect, it } from "vitest";

import {
  buildAuthorAvatarMapFromServicesUsers,
  buildAuthorLabelMapFromServicesUsers,
  getServicesUserChainSourceAddresses,
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

  it("maps labels across service profile chain source aliases", () => {
    const alias = "0xfa71ff2394596f824d69961293d095a50d322e4e";
    const directAddress = "0x17a67177af1a698205f30affce83cafb0c0e0bc4";
    const user = {
      id: "prototype",
      email: "user-lyra@mock.decentralised.art",
      display_name: "prototype_test_account",
      ethereum_address: directAddress.toUpperCase(),
      profile_json: {
        public: {
          chain_source_addresses: [alias.toUpperCase()],
        },
      },
    };

    expect(getServicesUserChainSourceAddresses(user)).toEqual([directAddress, alias]);
    expect(buildAuthorLabelMapFromServicesUsers([user])).toEqual({
      [directAddress]: "prototype_test_account",
      [alias]: "prototype_test_account",
    });
  });

  it("uses explicitly stored service profile avatars", () => {
    expect(
      resolveServicesUserAvatarUrl({
        id: "prototype",
        email: "user-lyra@mock.decentralised.art",
        display_name: "prototype_test_account",
        ethereum_address: address,
        profile_json: {
          public: {
            avatar_url: "/app/avatars/lyra.svg",
          },
        },
      }),
    ).toBe(asset("/avatars/lyra.svg"));
  });
});
