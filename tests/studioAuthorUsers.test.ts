import { describe, expect, it } from "vitest";

import type { ServicesUserRecord } from "../src/lib/auth/api";
import type { User } from "../src/lib/data/users";
import {
  buildStudioUsersById,
  mapServicesUserToStudioAuthor,
} from "../src/lib/studio/studioAuthorUsers";

const authored = {
  performativeTransactions: 0,
  features: 0,
  transformations: 0,
  conditions: 0,
};

const baseUser = (overrides: Partial<User>): User => ({
  id: "chain-source-fa71",
  kind: "agent",
  address: "0xfa71ff2394596f824d69961293d095a50d322e4e",
  nickname: "Chain Source fa71",
  avatarUrl: "",
  authored,
  toolbox: [],
  ...overrides,
});

describe("studio author users", () => {
  it("maps chain addresses to Services display names only when a profile name exists", () => {
    const named = mapServicesUserToStudioAuthor({
      id: "service-user",
      email: "user-lyra@mock.decentralised.art",
      display_name: "prototype_test_account",
      ethereum_address: "0xb584a15f38c2014cff54fdb1b417428b51999276",
    });
    const unnamed = mapServicesUserToStudioAuthor({
      id: "service-user-2",
      email: "someone@example.com",
      ethereum_address: "0xfa71ff2394596f824d69961293d095a50d322e4e",
    } satisfies ServicesUserRecord);

    expect(named?.nickname).toBe("prototype_test_account");
    expect(named?.address).toBe("0xb584a15f38c2014cff54fdb1b417428b51999276");
    expect(unnamed).toBeNull();
  });

  it("does not expose fixture Chain Source labels as address author labels", () => {
    const fixture = baseUser({});
    const servicesAuthor = baseUser({
      id: "0xb584a15f38c2014cff54fdb1b417428b51999276",
      address: "0xb584a15f38c2014cff54fdb1b417428b51999276",
      nickname: "prototype_test_account",
    });

    const usersById = buildStudioUsersById({
      baseUsersById: { [fixture.id]: fixture },
      servicesAuthorUsersById: { [servicesAuthor.address]: servicesAuthor },
    });

    expect(usersById["chain-source-fa71"]).toBe(fixture);
    expect(usersById["0xfa71ff2394596f824d69961293d095a50d322e4e"]).toBeUndefined();
    expect(usersById["0xb584a15f38c2014cff54fdb1b417428b51999276"]?.nickname).toBe(
      "prototype_test_account",
    );
  });
});
