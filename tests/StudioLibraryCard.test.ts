import "@testing-library/jest-dom/vitest";
import { fireEvent, render } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

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

  it("offers Local publication without a public connector link or toolbox action", async () => {
    const onPublish = vi.fn();
    const onOpen = vi.fn();
    const { getByRole, queryByRole, queryByTitle, rerender } = render(StudioLibraryCard, {
      props: { item: connectorItem, author: author({}), local: true, onPublish, onOpen },
    });
    expect(queryByRole("link", { name: "test_connector" })).not.toBeInTheDocument();
    expect(queryByTitle("Add to toolbox")).not.toBeInTheDocument();
    await fireEvent.click(getByRole("button", { name: "Publish to the Network" }));
    expect(onPublish).toHaveBeenCalledWith(connectorItem);
    await fireEvent.click(getByRole("button", { name: "Open in Studio" }));
    expect(onOpen).toHaveBeenCalledWith(connectorItem);

    await rerender({
      item: connectorItem,
      author: author({}),
      local: true,
      onPublish,
      publishDisabled: true,
    });
    expect(getByRole("button", { name: "Publish to the Network" })).toBeDisabled();
  });

  it("only exposes publication and toolbox actions when their callbacks are supplied", () => {
    const { getByTitle, queryByRole } = render(StudioLibraryCard, {
      props: { item: connectorItem, author: author({}), onToolbox: vi.fn() },
    });
    expect(getByTitle("Add to toolbox")).toBeInTheDocument();
    expect(queryByRole("button", { name: "Publish to the Network" })).not.toBeInTheDocument();
  });
});
