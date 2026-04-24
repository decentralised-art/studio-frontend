export type ToolboxLibrary = {
  connector: string[];
  transformation: string[];
  condition: string[];
};

export type ToolboxItemKind = keyof ToolboxLibrary;

export const normalizeConnectorToolboxId = (id: string) =>
  id
    .trim()
    .replace(/^particle-/, "")
    .replace(/^feature-/, "");

export const normalizeTransformationToolboxId = (id: string) =>
  id.trim().replace(/^transform-/, "");

export const normalizeConditionToolboxId = (id: string) => id.trim().replace(/^condition-/, "");

export const normalizeToolboxIdByKind = (kind: ToolboxItemKind, id: string) => {
  if (kind === "connector") return normalizeConnectorToolboxId(id);
  if (kind === "transformation") return normalizeTransformationToolboxId(id);
  return normalizeConditionToolboxId(id);
};

export const normalizeToolboxListByKind = (kind: ToolboxItemKind, ids: readonly string[]) =>
  Array.from(
    new Set(ids.map((id) => normalizeToolboxIdByKind(kind, id)).filter((id) => id.length > 0)),
  );

export const createEmptyToolboxLibrary = (): ToolboxLibrary => ({
  connector: [],
  transformation: [],
  condition: [],
});

export const normalizeToolboxLibrary = (library: ToolboxLibrary): ToolboxLibrary => ({
  connector: normalizeToolboxListByKind("connector", library.connector),
  transformation: normalizeToolboxListByKind("transformation", library.transformation),
  condition: normalizeToolboxListByKind("condition", library.condition),
});

export const addToolboxLibraryItem = (
  library: ToolboxLibrary,
  kind: ToolboxItemKind,
  id: string,
): { library: ToolboxLibrary; id: string; added: boolean } => {
  const normalizedId = normalizeToolboxIdByKind(kind, id);
  if (!normalizedId || library[kind].includes(normalizedId)) {
    return { library, id: normalizedId, added: false };
  }

  return {
    library: {
      ...library,
      [kind]: [...library[kind], normalizedId],
    },
    id: normalizedId,
    added: true,
  };
};

export const toggleToolboxLibraryItem = (
  library: ToolboxLibrary,
  kind: ToolboxItemKind,
  id: string,
): { library: ToolboxLibrary; id: string; saved: boolean; changed: boolean } => {
  const normalizedId = normalizeToolboxIdByKind(kind, id);
  if (!normalizedId) {
    return { library, id: normalizedId, saved: false, changed: false };
  }

  const isSaved = library[kind].includes(normalizedId);
  return {
    library: {
      ...library,
      [kind]: isSaved
        ? library[kind].filter((itemId) => itemId !== normalizedId)
        : [...library[kind], normalizedId],
    },
    id: normalizedId,
    saved: !isSaved,
    changed: true,
  };
};
