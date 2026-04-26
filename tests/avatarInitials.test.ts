import { describe, expect, it } from "vitest";

import { getUserAvatarInitials } from "../src/lib/user/avatarInitials";

describe("avatarInitials", () => {
  it("derives initials from profile names", () => {
    expect(getUserAvatarInitials("Lyra N.")).toBe("LN");
    expect(getUserAvatarInitials("prototype_test_account")).toBe("PT");
    expect(getUserAvatarInitials("Bob")).toBe("BO");
  });

  it("falls back when a name is empty", () => {
    expect(getUserAvatarInitials("")).toBe("?");
  });
});
