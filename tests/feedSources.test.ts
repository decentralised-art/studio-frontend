import { describe, expect, it } from "vitest";
import {
  computeFeedSourceAddresses,
  normalizeFeedSourceAddress,
} from "../src/lib/feed/feedSources";

describe("feed source address helpers", () => {
  it("normalizes valid ethereum addresses and rejects invalid values", () => {
    expect(normalizeFeedSourceAddress("0xFA71FF2394596F824D69961293D095A50D322E4E")).toBe(
      "0xfa71ff2394596f824d69961293d095a50d322e4e",
    );
    expect(normalizeFeedSourceAddress("fa71ff2394596f824d69961293d095a50d322e4e")).toBe(
      "0xfa71ff2394596f824d69961293d095a50d322e4e",
    );
    expect(normalizeFeedSourceAddress("user-lyra")).toBe("");
  });

  it("computes deduplicated source list from self + followed addresses", () => {
    expect(
      computeFeedSourceAddresses({
        currentUserAddress: "0xb584a15f38c2014cff54fdb1b417428b51999276",
        followedUserAddresses: [
          "0xFA71FF2394596F824D69961293D095A50D322E4E",
          "b584a15f38c2014cff54fdb1b417428b51999276",
          "invalid-value",
        ],
      }),
    ).toEqual([
      "0xb584a15f38c2014cff54fdb1b417428b51999276",
      "0xfa71ff2394596f824d69961293d095a50d322e4e",
    ]);
  });
});
