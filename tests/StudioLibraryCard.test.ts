import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import StudioLibraryCard from "../src/lib/components/studio/StudioLibraryCard.svelte";
import type { LibraryItem } from "../src/lib/data/studioLibrary";
import type { User } from "../src/lib/data/users";

const connectorItem: LibraryItem = {
  id: "feature-test_connector",
  name: "test_connector",
  kind: "feature",
  authorId: "0xb584a15f38c2014cff54fdb1b417428b51999276",
  summary: "Synced from chain.",
  dimensions: 1,
};

const author = (overrides: Partial<User>): User => ({
  id: "0xb584a15f38c2014cff54fdb1b417428b51999276",
  kind: "human",
  address: "0xb584a15f38c2014cff54fdb1b417428b51999276",
  nickname: "prototype_test_account",
  avatarUrl: "",
  authored: {
    performativeTransactions: 0,
    features: 0,
    transformations: 0,
    conditions: 0,
  },
  toolbox: [],
  ...overrides,
});

describe("StudioLibraryCard", () => {
  it("links connector names to connector pages and authors to user pages", () => {
    const { getByRole } = render(StudioLibraryCard, {
      props: {
        item: connectorItem,
        author: author({}),
      },
    });

    expect(getByRole("link", { name: "test_connector" })).toHaveAttribute(
      "href",
      "/c/test_connector",
    );
    expect(getByRole("link", { name: "prototype_test_account" })).toHaveAttribute(
      "href",
      "/u/0xb584a15f38c2014cff54fdb1b417428b51999276",
    );
  });

  it("falls back from unknown author names to address hashes", () => {
    const { getByRole } = render(StudioLibraryCard, {
      props: {
        item: connectorItem,
        author: author({ nickname: "Unknown" }),
      },
    });

    const authorLink = getByRole("link", {
      name: "0xb584a15f38c2014cff54fdb1b417428b51999276",
    });
    expect(authorLink).toHaveAttribute("title", "0xb584a15f38c2014cff54fdb1b417428b51999276");
    expect(authorLink).toHaveAttribute("href", "/u/0xb584a15f38c2014cff54fdb1b417428b51999276");
  });
});
