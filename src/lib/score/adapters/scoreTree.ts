import type { PtOutputFeature } from "$lib/particles/ptMidiAdapter";
import {
  formatNumericXmlValue,
  isValidXmlName,
  MUSICXML_CUSTOM_ATTR_CODE,
  MUSICXML_CUSTOM_ELEMENT_CODE,
  resolveMusicXmlAttrName,
  resolveMusicXmlElementName,
  resolveMusicXmlEnumValue,
  resolveTextToken,
  SCORE_VALUE_KIND_ENUM,
  SCORE_VALUE_KIND_NUMBER,
  SCORE_VALUE_KIND_TEXT,
  SCORE_VALUE_KIND_YES_NO,
} from "$lib/score/codebook";
import { hasScoreErrors, scoreDiagnostic } from "$lib/score/diagnostics";
import type { ScoreBuildResult, ScoreXmlNode } from "$lib/score/types";
import { normalizePluginPathSegmentName } from "$lib/studio/plugins/runtime";

export const SCORE_TREE_ADAPTER_ID = "musicxml-tree-v1";

type ScoreTableName = "score_nodes" | "score_attrs" | "score_text";
type TableStreams = Map<string, PtOutputFeature>;

type NodeRow = {
  id: number;
  parentId: number;
  childIndex: number;
  name: string;
  text?: string;
};

type AttrRow = {
  nodeId: number;
  attrIndex: number;
  name: string;
  value: string;
};

const TABLE_NAMES = new Set<ScoreTableName>(["score_nodes", "score_attrs", "score_text"]);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const toInt = (value: unknown): number | null => (isFiniteNumber(value) ? Math.trunc(value) : null);

const parsePathSegments = (path: string): string[] =>
  path
    .trim()
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

const parseTableField = (path: string): { table: ScoreTableName; field: string } | null => {
  const segments = parsePathSegments(path);
  const normalized = segments.map(normalizePluginPathSegmentName);
  const tableIndex = normalized.findIndex((segment): segment is ScoreTableName =>
    TABLE_NAMES.has(segment as ScoreTableName),
  );
  if (tableIndex < 0) return null;
  const field = normalized[normalized.length - 1];
  if (!field || TABLE_NAMES.has(field as ScoreTableName)) return null;
  return { table: normalized[tableIndex] as ScoreTableName, field };
};

const collectTableStreams = (streams: readonly PtOutputFeature[]) => {
  const tables: Record<ScoreTableName, TableStreams> = {
    score_nodes: new Map(),
    score_attrs: new Map(),
    score_text: new Map(),
  };
  streams.forEach((stream) => {
    const parsed = parseTableField(stream.feature_path);
    if (!parsed) return;
    tables[parsed.table].set(parsed.field, stream);
  });
  return tables;
};

const maxTableRows = (table: TableStreams): number =>
  Math.max(0, ...[...table.values()].map((stream) => stream.data.length));

const streamValue = (table: TableStreams, field: string, index: number): number | null =>
  toInt(table.get(field)?.data[index]);

export const hasScoreTreeStreams = (streams: readonly PtOutputFeature[]): boolean => {
  const nodes = collectTableStreams(streams).score_nodes;
  return (
    nodes.has("node_id") &&
    nodes.has("parent_id") &&
    nodes.has("child_index") &&
    nodes.has("element_code")
  );
};

const buildTextTable = (
  table: TableStreams,
): { textById: Map<number, string>; diagnostics: ScoreBuildResult["diagnostics"] } => {
  const diagnostics: ScoreBuildResult["diagnostics"] = [];
  const pieces = new Map<number, Array<{ index: number; text: string }>>();

  for (let row = 0; row < maxTableRows(table); row += 1) {
    const textId = streamValue(table, "text_id", row);
    const itemIndex = streamValue(table, "item_index", row);
    const textKind = streamValue(table, "text_kind", row);
    const value = table.get("value")?.data[row];
    if (textId === null || itemIndex === null || textKind === null || !isFiniteNumber(value)) {
      diagnostics.push(
        scoreDiagnostic(
          "warning",
          "invalid-score-text-row",
          `Skipped score_text row ${row} because a required value is missing.`,
        ),
      );
      continue;
    }

    const current = pieces.get(textId) ?? [];
    current.push({ index: itemIndex, text: resolveTextToken(textKind, value) });
    pieces.set(textId, current);
  }

  const textById = new Map<number, string>();
  pieces.forEach((rows, id) => {
    textById.set(
      id,
      rows
        .sort((a, b) => a.index - b.index)
        .map((piece) => piece.text)
        .join(""),
    );
  });

  return { textById, diagnostics };
};

const resolveElementName = (
  table: TableStreams,
  textById: Map<number, string>,
  row: number,
): string | null => {
  const code = streamValue(table, "element_code", row);
  if (code === null) return null;
  if (code === MUSICXML_CUSTOM_ELEMENT_CODE) {
    const textId =
      streamValue(table, "custom_element_text_id", row) ??
      streamValue(table, "element_text_id", row);
    return textId === null ? null : (textById.get(textId) ?? null);
  }
  return resolveMusicXmlElementName(code);
};

const buildNodeRows = (
  table: TableStreams,
  textById: Map<number, string>,
): { rows: NodeRow[]; diagnostics: ScoreBuildResult["diagnostics"] } => {
  const diagnostics: ScoreBuildResult["diagnostics"] = [];
  const rows: NodeRow[] = [];
  const seen = new Set<number>();

  for (let row = 0; row < maxTableRows(table); row += 1) {
    const id = streamValue(table, "node_id", row);
    const parentId = streamValue(table, "parent_id", row);
    const childIndex = streamValue(table, "child_index", row);
    const name = resolveElementName(table, textById, row);
    if (id === null || parentId === null || childIndex === null || !name) {
      diagnostics.push(
        scoreDiagnostic(
          "error",
          "invalid-score-node-row",
          `Cannot build score node row ${row}: node_id, parent_id, child_index, or element name is missing.`,
        ),
      );
      continue;
    }
    if (seen.has(id)) {
      diagnostics.push(
        scoreDiagnostic("error", "duplicate-score-node-id", `Duplicate score node id ${id}.`),
      );
      continue;
    }
    if (!isValidXmlName(name)) {
      diagnostics.push(
        scoreDiagnostic(
          "error",
          "invalid-score-node-name",
          `Invalid MusicXML element name ${name}.`,
        ),
      );
      continue;
    }

    seen.add(id);
    const textId = streamValue(table, "text_id", row);
    rows.push({
      id,
      parentId,
      childIndex,
      name,
      ...(textId !== null && textById.has(textId) ? { text: textById.get(textId) } : {}),
    });
  }

  return { rows, diagnostics };
};

const resolveAttrName = (
  table: TableStreams,
  textById: Map<number, string>,
  row: number,
): string | null => {
  const code = streamValue(table, "attr_code", row);
  if (code === null) return null;
  if (code === MUSICXML_CUSTOM_ATTR_CODE) {
    const textId =
      streamValue(table, "custom_attr_text_id", row) ?? streamValue(table, "attr_text_id", row);
    return textId === null ? null : (textById.get(textId) ?? null);
  }
  return resolveMusicXmlAttrName(code);
};

const resolveAttrValue = (
  table: TableStreams,
  textById: Map<number, string>,
  row: number,
): string | null => {
  const kind = streamValue(table, "value_kind", row);
  if (kind === null || kind === SCORE_VALUE_KIND_NUMBER) {
    const value = table.get("number_value")?.data[row];
    return isFiniteNumber(value) ? formatNumericXmlValue(value) : null;
  }
  if (kind === SCORE_VALUE_KIND_ENUM) {
    const enumCode = streamValue(table, "enum_code", row);
    return enumCode === null ? null : resolveMusicXmlEnumValue(enumCode);
  }
  if (kind === SCORE_VALUE_KIND_TEXT) {
    const textId = streamValue(table, "text_id", row);
    return textId === null ? null : (textById.get(textId) ?? null);
  }
  if (kind === SCORE_VALUE_KIND_YES_NO) {
    const enumCode = streamValue(table, "enum_code", row);
    if (enumCode !== null) return resolveMusicXmlEnumValue(enumCode);
    const numberValue = table.get("number_value")?.data[row];
    return numberValue && numberValue > 0 ? "yes" : "no";
  }
  return null;
};

const buildAttrRows = (
  table: TableStreams,
  textById: Map<number, string>,
): { rows: AttrRow[]; diagnostics: ScoreBuildResult["diagnostics"] } => {
  const diagnostics: ScoreBuildResult["diagnostics"] = [];
  const rows: AttrRow[] = [];

  for (let row = 0; row < maxTableRows(table); row += 1) {
    const nodeId = streamValue(table, "node_id", row);
    const attrIndex = streamValue(table, "attr_index", row);
    const name = resolveAttrName(table, textById, row);
    const value = resolveAttrValue(table, textById, row);
    if (nodeId === null || attrIndex === null || !name || value === null) {
      diagnostics.push(
        scoreDiagnostic(
          "warning",
          "invalid-score-attr-row",
          `Skipped score_attrs row ${row}: node_id, attr_index, name, or value is missing.`,
        ),
      );
      continue;
    }
    if (!isValidXmlName(name)) {
      diagnostics.push(
        scoreDiagnostic(
          "warning",
          "invalid-score-attr-name",
          `Skipped score attribute with invalid name ${name}.`,
        ),
      );
      continue;
    }
    rows.push({ nodeId, attrIndex, name, value });
  }

  return { rows, diagnostics };
};

const assembleTree = (
  nodeRows: readonly NodeRow[],
  attrRows: readonly AttrRow[],
): { root: ScoreXmlNode | null; diagnostics: ScoreBuildResult["diagnostics"] } => {
  const diagnostics: ScoreBuildResult["diagnostics"] = [];
  const nodeById = new Map(nodeRows.map((row) => [row.id, row]));
  const childrenByParent = new Map<number, NodeRow[]>();
  const attrsByNode = new Map<number, AttrRow[]>();

  nodeRows.forEach((row) => {
    if (row.parentId <= 0) return;
    if (!nodeById.has(row.parentId)) {
      diagnostics.push(
        scoreDiagnostic(
          "error",
          "missing-score-node-parent",
          `Score node ${row.id} references missing parent ${row.parentId}.`,
        ),
      );
      return;
    }
    const current = childrenByParent.get(row.parentId) ?? [];
    current.push(row);
    childrenByParent.set(row.parentId, current);
  });

  attrRows.forEach((row) => {
    if (!nodeById.has(row.nodeId)) {
      diagnostics.push(
        scoreDiagnostic(
          "warning",
          "missing-score-attr-node",
          `Skipped attribute ${row.name} for missing node ${row.nodeId}.`,
        ),
      );
      return;
    }
    const current = attrsByNode.get(row.nodeId) ?? [];
    current.push(row);
    attrsByNode.set(row.nodeId, current);
  });

  if (hasScoreErrors(diagnostics)) return { root: null, diagnostics };

  const roots = nodeRows
    .filter((row) => row.parentId <= 0)
    .sort((a, b) => a.childIndex - b.childIndex || a.id - b.id);
  if (roots.length === 0) {
    diagnostics.push(
      scoreDiagnostic("error", "missing-score-root", "No score root node was supplied."),
    );
    return { root: null, diagnostics };
  }
  if (roots.length > 1) {
    diagnostics.push(
      scoreDiagnostic(
        "warning",
        "multiple-score-roots",
        "Multiple root nodes supplied; using the first root.",
      ),
    );
  }

  const visiting = new Set<number>();
  const visited = new Set<number>();
  const buildNode = (row: NodeRow): ScoreXmlNode | null => {
    if (visiting.has(row.id)) {
      diagnostics.push(
        scoreDiagnostic(
          "error",
          "score-node-cycle",
          `Score node ${row.id} participates in a cycle.`,
        ),
      );
      return null;
    }
    visiting.add(row.id);

    const attributes: Record<string, string> = {};
    (attrsByNode.get(row.id) ?? [])
      .sort((a, b) => a.attrIndex - b.attrIndex)
      .forEach((attr) => {
        attributes[attr.name] = attr.value;
      });

    const children: ScoreXmlNode[] = [];
    for (const child of (childrenByParent.get(row.id) ?? []).sort(
      (a, b) => a.childIndex - b.childIndex || a.id - b.id,
    )) {
      const node = buildNode(child);
      if (node) children.push(node);
    }

    visiting.delete(row.id);
    visited.add(row.id);
    return {
      name: row.name,
      ...(Object.keys(attributes).length ? { attributes } : {}),
      ...(row.text ? { text: row.text } : {}),
      ...(children.length ? { children } : {}),
    };
  };

  const root = buildNode(roots[0]);
  if (root?.name !== "score-partwise") {
    diagnostics.push(
      scoreDiagnostic(
        "warning",
        "non-partwise-score-root",
        "The score root is not score-partwise; OSMD may not render it.",
      ),
    );
  }

  if (visited.size < nodeRows.length && !hasScoreErrors(diagnostics)) {
    diagnostics.push(
      scoreDiagnostic(
        "warning",
        "unreachable-score-nodes",
        "Some score nodes were not reachable from the root.",
      ),
    );
  }

  return { root, diagnostics };
};

const countNodes = (node: ScoreXmlNode, name: string): number =>
  (node.name === name ? 1 : 0) +
  (node.children ?? []).reduce((count, child) => count + countNodes(child, name), 0);

export const buildScoreFromTreeStreams = (
  streams: readonly PtOutputFeature[],
): ScoreBuildResult | null => {
  if (!hasScoreTreeStreams(streams)) return null;

  const tables = collectTableStreams(streams);
  const { textById, diagnostics: textDiagnostics } = buildTextTable(tables.score_text);
  const { rows: nodeRows, diagnostics: nodeDiagnostics } = buildNodeRows(
    tables.score_nodes,
    textById,
  );
  const { rows: attrRows, diagnostics: attrDiagnostics } = buildAttrRows(
    tables.score_attrs,
    textById,
  );
  const { root, diagnostics: treeDiagnostics } = assembleTree(nodeRows, attrRows);
  const diagnostics = [
    ...textDiagnostics,
    ...nodeDiagnostics,
    ...attrDiagnostics,
    ...treeDiagnostics,
  ];

  return {
    tree: root && !hasScoreErrors(diagnostics) ? { root } : null,
    diagnostics,
    stats: {
      adapterId: SCORE_TREE_ADAPTER_ID,
      noteCount: root ? countNodes(root, "note") : 0,
      measureCount: root ? countNodes(root, "measure") : 0,
      partCount: root ? countNodes(root, "part") : 0,
      streamCount: streams.length,
    },
  };
};
