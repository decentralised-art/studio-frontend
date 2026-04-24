import type { LibraryItem } from "$lib/data/studioLibrary";
import {
  normalizeConditionToolboxId,
  normalizeConnectorToolboxId,
  normalizeTransformationToolboxId,
  type ToolboxItemKind,
  type ToolboxLibrary,
} from "$lib/toolbox/toolboxLibrary";

export type NetworkLibraryKind = "feature" | "transformation" | "condition";

export const toolboxEntryForLibraryItem = (
  item: LibraryItem,
): { kind: ToolboxItemKind; id: string } | null => {
  if (item.kind === "feature") {
    return { kind: "connector", id: normalizeConnectorToolboxId(item.id) };
  }
  if (item.kind === "transformation") {
    return { kind: "transformation", id: normalizeTransformationToolboxId(item.id) };
  }
  if (item.kind === "condition") {
    return { kind: "condition", id: normalizeConditionToolboxId(item.id) };
  }
  return null;
};

export const isLibraryItemSavedInToolbox = (
  toolboxLibrary: ToolboxLibrary,
  item: LibraryItem,
): boolean => {
  const entry = toolboxEntryForLibraryItem(item);
  if (!entry) return false;
  return toolboxLibrary[entry.kind].includes(entry.id);
};

export const toolboxKindForLibraryKind = (kind: NetworkLibraryKind): ToolboxItemKind =>
  kind === "feature" ? "connector" : kind;

export const toolboxLibraryItemId = (kind: NetworkLibraryKind, id: string): string => {
  if (kind === "feature") return `feature-${id}`;
  if (kind === "transformation") return `transform-${id}`;
  return `condition-${id}`;
};

export const buildToolboxFallbackLibraryItem = ({
  kind,
  id,
  authorId,
}: {
  kind: NetworkLibraryKind;
  id: string;
  authorId: string;
}): LibraryItem => ({
  id: toolboxLibraryItemId(kind, id),
  name: id,
  kind,
  authorId,
  summary: "Saved in toolbox.",
  ...(kind === "feature" ? { dimensions: 1 } : {}),
});

export const listToolboxLibraryItemsForKind = ({
  kind,
  source,
  toolboxLibrary,
  fallbackAuthorId,
}: {
  kind: NetworkLibraryKind;
  source: readonly LibraryItem[];
  toolboxLibrary: ToolboxLibrary;
  fallbackAuthorId: string;
}): LibraryItem[] => {
  const toolboxKind = toolboxKindForLibraryKind(kind);
  const sourceByToolboxId = new Map<string, LibraryItem>();
  source.forEach((item) => {
    const entry = toolboxEntryForLibraryItem(item);
    if (!entry || entry.kind !== toolboxKind) return;
    sourceByToolboxId.set(entry.id, item);
  });

  return toolboxLibrary[toolboxKind].map(
    (id) =>
      sourceByToolboxId.get(id) ??
      buildToolboxFallbackLibraryItem({ kind, id, authorId: fallbackAuthorId }),
  );
};
