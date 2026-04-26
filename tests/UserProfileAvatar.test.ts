import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import UserProfilePage from "../src/lib/components/user/UserProfilePage.svelte";
import UserProfileView from "../src/lib/components/user/UserProfileView.svelte";
import type { ProfileViewUser } from "../src/lib/user/profileModel";

const profileUser = (overrides: Partial<ProfileViewUser> = {}): ProfileViewUser => ({
  id: "prototype",
  kind: "human",
  address: "0xb584a15f38c2014cff54fdb1b417428b51999276",
  nickname: "prototype_test_account",
  avatarUrl: "",
  bio: "",
  authored: {
    performativeTransactions: 0,
    features: 0,
    transformations: 0,
    conditions: 0,
  },
  toolbox: [],
  email: "user-lyra@mock.decentralised.art",
  status: "active",
  roles: ["user"],
  createdAt: "",
  updatedAt: "",
  lastLoginAt: null,
  profileJson: {},
  ...overrides,
});

describe("profile avatar rendering", () => {
  it("renders current profile initials instead of a mock image when avatar is missing", () => {
    const { container, getByText } = render(UserProfilePage, {
      props: {
        user: profileUser(),
        mode: "self",
      },
    });

    expect(getByText("PT")).toBeInTheDocument();
    expect(container.querySelector("img.avatar-img")).not.toBeInTheDocument();
  });

  it("renders public profile initials instead of the Lyra avatar when avatar is missing", () => {
    const { container, getByText } = render(UserProfileView, {
      props: {
        user: profileUser(),
      },
    });

    expect(getByText("PT")).toBeInTheDocument();
    expect(container.querySelector("img.avatar-img")).not.toBeInTheDocument();
  });

  it("renders a supplied profile image when an avatar URL exists", () => {
    const { container, getByAltText, queryByText } = render(UserProfileView, {
      props: {
        user: profileUser({
          avatarUrl: "/avatars/rae.svg",
        }),
      },
    });

    expect(getByAltText("prototype_test_account")).toHaveAttribute("src", "/avatars/rae.svg");
    expect(queryByText("PT")).not.toBeInTheDocument();
    expect(container.querySelector("img.avatar-img")).toBeInTheDocument();
  });
});
