import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import SocialCodeEventCard from "../src/lib/components/social/SocialCodeEventCard.svelte";

describe("social feed avatars", () => {
  it("renders initials for named authors without a profile image", () => {
    const address = "0xb584a15f38c2014cff54fdb1b417428b51999276";
    const { container, getByText } = render(SocialCodeEventCard, {
      props: {
        event: {
          type: "transformation",
          id: "event-transformation-test_add",
          authorId: address,
          createdAt: 0,
          createdLabel: "",
          elementId: "test_add",
          elementLabel: "test_add",
          runtimeSnippet: "return x + args[0];",
        },
        authorLabelById: {
          [address]: "prototype_test_account",
        },
        authorAvatarUrlById: {},
      },
    });

    expect(getByText("PT")).toBeInTheDocument();
    expect(container.querySelector("img.author-avatar")).not.toBeInTheDocument();
  });
});
