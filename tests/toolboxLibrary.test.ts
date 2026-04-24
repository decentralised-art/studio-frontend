import { describe, expect, it } from "vitest";

import type { LibraryItem } from "../src/lib/data/studioLibrary";
import {
  isLibraryItemSavedInToolbox,
  listToolboxLibraryItemsForKind,
  toolboxEntryForLibraryItem,
} from "../src/lib/studio/studioToolbox";
import {
  addToolboxLibraryItem,
  normalizeToolboxLibrary,
  toggleToolboxLibraryItem,
  type ToolboxLibrary,
} from "../src/lib/toolbox/toolboxLibrary";

const emptyToolbox = (): ToolboxLibrary => ({
  connector: [],
  transformation: [],
  condition: [],
});

describe("toolbox library helpers", () => {
  it("normalizes legacy library ids by toolbox kind", () => {
    expect(
      normalizeToolboxLibrary({
        connector: [" particle-pitch ", "feature-score", "score", ""],
        transformation: ["transform-add", " add "],
        condition: ["condition-gate", " gate "],
      }),
    ).toEqual({
      connector: ["pitch", "score"],
      transformation: ["add"],
      condition: ["gate"],
    });
  });

  it("adds and toggles normalized toolbox items immutably", () => {
    const initial = emptyToolbox();
    const added = addToolboxLibraryItem(initial, "connector", "feature-pitch");
    const duplicate = addToolboxLibraryItem(added.library, "connector", "particle-pitch");
    const removed = toggleToolboxLibraryItem(added.library, "connector", "pitch");

    expect(added).toMatchObject({ id: "pitch", added: true });
    expect(initial.connector).toEqual([]);
    expect(added.library.connector).toEqual(["pitch"]);
    expect(duplicate).toMatchObject({ id: "pitch", added: false });
    expect(removed).toMatchObject({ id: "pitch", saved: false, changed: true });
    expect(removed.library.connector).toEqual([]);
  });

  it("maps library items to toolbox entries and saved state", () => {
    const item: LibraryItem = {
      id: "feature-pitch",
      name: "Pitch",
      kind: "feature",
      authorId: "user-lyra",
    };

    expect(toolboxEntryForLibraryItem(item)).toEqual({ kind: "connector", id: "pitch" });
    expect(isLibraryItemSavedInToolbox({ ...emptyToolbox(), connector: ["pitch"] }, item)).toBe(
      true,
    );
  });

  it("lists saved toolbox items from source data with fallbacks for missing entries", () => {
    const source: LibraryItem[] = [
      {
        id: "feature-pitch",
        name: "Pitch",
        kind: "feature",
        authorId: "user-lyra",
        dimensions: 2,
      },
    ];

    expect(
      listToolboxLibraryItemsForKind({
        kind: "feature",
        source,
        toolboxLibrary: { ...emptyToolbox(), connector: ["pitch", "remote-only"] },
        fallbackAuthorId: "user-lyra",
      }),
    ).toEqual([
      source[0],
      {
        id: "feature-remote-only",
        name: "remote-only",
        kind: "feature",
        authorId: "user-lyra",
        summary: "Saved in toolbox.",
        dimensions: 1,
      },
    ]);
  });
});
