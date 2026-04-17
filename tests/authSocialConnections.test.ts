import { describe, expect, it } from "vitest";
import { computeUserSocialConnections, type ServicesUserRecord } from "../src/lib/auth/api";

const addressA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const addressB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const addressC = "0xcccccccccccccccccccccccccccccccccccccccc";

const users: ServicesUserRecord[] = [
  {
    id: "user-a",
    ethereum_address: addressA,
    profile_json: {
      public: {
        followed_user_addresses: [addressB],
      },
    },
  },
  {
    id: "user-b",
    ethereum_address: addressB,
    profile_json: {
      public: {
        followed_user_addresses: [addressC],
      },
    },
  },
];

describe("computeUserSocialConnections", () => {
  it("returns follower/following lists for indexed addresses", () => {
    expect(computeUserSocialConnections(users, addressB)).toEqual({
      followingIds: [addressC],
      followerIds: [addressA],
      status: "ok",
    });
  });

  it("returns unavailable status for chain addresses missing in services index", () => {
    expect(computeUserSocialConnections(users, addressC)).toEqual({
      followingIds: [],
      followerIds: [],
      status: "address_not_indexed_in_services",
    });
  });
});
