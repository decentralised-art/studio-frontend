import { describe, expect, it } from "vitest";

import { SCORE_VALUE_KIND_TEXT } from "../src/lib/score/codebook";
import type { StudioPluginRuntimeData } from "../src/lib/studio/plugins/runtime";
import { buildScorePluginRuntimeData } from "../src/lib/studio/plugins/scoreRuntime";

const stream = (table: string, field: string, data: number[]) => ({
  feature_path: `/root:0/${table}:0/${field}:0`,
  data,
});

const textStreams = (id: number, text: string) => {
  const codepoints = [...text].map((value) => value.codePointAt(0) ?? 0);
  return [
    stream(
      "score_text",
      "text_id",
      codepoints.map(() => id),
    ),
    stream(
      "score_text",
      "item_index",
      codepoints.map((_, index) => index),
    ),
    stream(
      "score_text",
      "text_kind",
      codepoints.map(() => 0),
    ),
    stream("score_text", "value", codepoints),
  ];
};

const midiRuntime: StudioPluginRuntimeData = {
  pluginId: "music-score-v1",
  connectorTargets: ["midi_root"],
  streams: [
    { feature_path: "/midi_root:0/pitch:0", data: [60] },
    { feature_path: "/midi_root:0/time:0", data: [0] },
    { feature_path: "/midi_root:0/duration:0", data: [1] },
    { feature_path: "/midi_root:0/velocity:0", data: [80] },
  ],
  midiGroups: [
    {
      groupPath: "/midi_root:0",
      pitch: { feature_path: "/midi_root:0/pitch:0", data: [60] },
      time: { feature_path: "/midi_root:0/time:0", data: [0] },
      duration: { feature_path: "/midi_root:0/duration:0", data: [1] },
      velocity: { feature_path: "/midi_root:0/velocity:0", data: [80] },
    },
  ],
};

describe("score plugin runtime", () => {
  it("falls back to pitch/time/duration/velocity streams for the first score plugin", () => {
    const score = buildScorePluginRuntimeData(midiRuntime);

    expect(score.adapterId).toBe("music-note-events-v1");
    expect(score.musicXml).toContain('<score-partwise version="4.0">');
    expect(score.stats.noteCount).toBe(1);
  });

  it("prefers measured note streams over MIDI grouping when present", () => {
    const score = buildScorePluginRuntimeData({
      ...midiRuntime,
      streams: [
        { feature_path: "/score_note:0/measure:0", data: [1] },
        { feature_path: "/score_note:0/onset:0", data: [0] },
        { feature_path: "/score_note:0/duration:0", data: [1] },
        { feature_path: "/score_note:0/pitch:0", data: [67] },
      ],
    });

    expect(score.adapterId).toBe("music-measured-notes-v1");
    expect(score.musicXml).toContain("<step>G</step>");
  });

  it("prefers canonical MusicXML tree streams over other subformats", () => {
    const score = buildScorePluginRuntimeData({
      ...midiRuntime,
      streams: [
        stream("score_nodes", "node_id", [1]),
        stream("score_nodes", "parent_id", [0]),
        stream("score_nodes", "child_index", [0]),
        stream("score_nodes", "element_code", [1]),
        stream("score_attrs", "node_id", [1]),
        stream("score_attrs", "attr_index", [0]),
        stream("score_attrs", "attr_code", [1]),
        stream("score_attrs", "value_kind", [SCORE_VALUE_KIND_TEXT]),
        stream("score_attrs", "text_id", [1]),
        ...textStreams(1, "4.0"),
      ],
    });

    expect(score.adapterId).toBe("musicxml-tree-v1");
    expect(score.musicXml).toContain('<score-partwise version="4.0"/>');
  });
});
