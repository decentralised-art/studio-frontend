import { describe, expect, it } from "vitest";

import type { PtOutputFeature } from "../src/lib/particles/ptMidiAdapter";
import { buildScoreFromTreeStreams } from "../src/lib/score/adapters/scoreTree";
import { SCORE_VALUE_KIND_TEXT } from "../src/lib/score/codebook";
import { serializeScoreTreeToMusicXml } from "../src/lib/score/musicXmlSerializer";

const stream = (field: string, data: number[], table = "score_nodes"): PtOutputFeature => ({
  feature_path: `/root:0/${table}:0/${field}:0`,
  data,
});

const textStreams = (entries: Array<{ id: number; text: string }>): PtOutputFeature[] => {
  const rows = entries.flatMap((entry) =>
    [...entry.text].map((value, index) => ({
      id: entry.id,
      index,
      value: value.codePointAt(0) ?? 0,
    })),
  );
  return [
    stream(
      "text_id",
      rows.map((row) => row.id),
      "score_text",
    ),
    stream(
      "item_index",
      rows.map((row) => row.index),
      "score_text",
    ),
    stream(
      "text_kind",
      rows.map(() => 0),
      "score_text",
    ),
    stream(
      "value",
      rows.map((row) => row.value),
      "score_text",
    ),
  ];
};

describe("score tree adapter", () => {
  it("assembles canonical score_nodes and score_attrs streams into MusicXML", () => {
    const result = buildScoreFromTreeStreams([
      stream("node_id", [1, 2, 3, 4, 5]),
      stream("parent_id", [0, 1, 1, 3, 3]),
      stream("child_index", [0, 0, 1, 0, 1]),
      stream("element_code", [1, 2, 5, 4, 6]),
      stream("text_id", [0, 0, 0, 2, 0]),
      stream("node_id", [1], "score_attrs"),
      stream("attr_index", [0], "score_attrs"),
      stream("attr_code", [1], "score_attrs"),
      stream("value_kind", [SCORE_VALUE_KIND_TEXT], "score_attrs"),
      stream("text_id", [1], "score_attrs"),
      ...textStreams([
        { id: 1, text: "4.0" },
        { id: 2, text: "P1" },
      ]),
    ]);

    expect(result?.tree).not.toBeNull();
    expect(result?.stats).toMatchObject({
      adapterId: "musicxml-tree-v1",
      measureCount: 1,
      partCount: 1,
      streamCount: 14,
    });
    const musicXml = serializeScoreTreeToMusicXml(result!.tree!);
    expect(musicXml).toContain('<score-partwise version="4.0">');
    expect(musicXml).toContain("<part-name>P1</part-name>");
    expect(musicXml).toContain("<measure/>");
  });

  it("rejects duplicate node identifiers", () => {
    const result = buildScoreFromTreeStreams([
      stream("node_id", [1, 1]),
      stream("parent_id", [0, 1]),
      stream("child_index", [0, 0]),
      stream("element_code", [1, 2]),
    ]);

    expect(result?.tree).toBeNull();
    expect(result?.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "duplicate-score-node-id",
    );
  });

  it("rejects missing parent references", () => {
    const result = buildScoreFromTreeStreams([
      stream("node_id", [1, 2]),
      stream("parent_id", [0, 99]),
      stream("child_index", [0, 0]),
      stream("element_code", [1, 2]),
    ]);

    expect(result?.tree).toBeNull();
    expect(result?.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "missing-score-node-parent",
    );
  });
});
