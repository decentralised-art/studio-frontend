import { describe, expect, it } from "vitest";

import { SCORE_VALUE_KIND_TEXT } from "../src/lib/score/codebook";
import {
  buildStudioPluginRuntimeData,
  type StudioPluginRuntimeData,
} from "../src/lib/studio/plugins/runtime";
import { buildScorePluginRuntimeData } from "../src/lib/studio/plugins/scoreRuntime";

const stream = (table: string, field: string, data: number[]) => ({
  feature_path: `/root:0/${table}:0/${field}:0`,
  data,
});

const fullScoreStream = (path: string, data = Array.from({ length: 12 }, (_, index) => index)) => ({
  feature_path: `/test_full_score_empty_100604052026:0/score_full_v2:${path}`,
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

  it("renders deployed full-score template streams with positional open collectors", () => {
    const runtime = buildStudioPluginRuntimeData(
      "music-score-v1",
      ["test_full_score_empty_100604052026"],
      [
        {
          feature_path: "/test_full_score_empty_100604052026:0/score_full_v2:5/score_notes_v1:0",
          data: [1],
        },
        {
          feature_path: "/test_full_score_empty_100604052026:0/score_full_v2:5/score_notes_v1:1",
          data: [0],
        },
        {
          feature_path: "/test_full_score_empty_100604052026:0/score_full_v2:5/score_notes_v1:2",
          data: [2520],
        },
        {
          feature_path: "/test_full_score_empty_100604052026:0/score_full_v2:5/score_notes_v1:3",
          data: [60],
        },
        {
          feature_path:
            "/test_full_score_empty_100604052026:0/score_full_v2:1/score_meter_v2:0/score_meter_time_tick:0",
          data: [0],
        },
        {
          feature_path:
            "/test_full_score_empty_100604052026:0/score_full_v2:1/score_meter_v2:1/score_beats:0",
          data: [4],
        },
        {
          feature_path:
            "/test_full_score_empty_100604052026:0/score_full_v2:1/score_meter_v2:2/score_beat_type:0",
          data: [4],
        },
      ],
    );
    const score = buildScorePluginRuntimeData(runtime);

    expect(runtime.streams).toHaveLength(7);
    expect(score.adapterId).toBe("music-measured-notes-v1");
    expect(score.musicXml).toContain("<step>C</step>");
  });

  it("keeps raw full-score archetype output renderable for OSMD", () => {
    const runtime = buildStudioPluginRuntimeData(
      "music-score-v1",
      ["test_full_score_empty_100604052026"],
      [
        fullScoreStream("0/score_parts_v2:0/score_part:0"),
        fullScoreStream("0/score_parts_v2:1/score_staff_count:0"),
        fullScoreStream("1/score_meter_v2:0/score_meter_time_tick:0"),
        fullScoreStream("1/score_meter_v2:1/score_beats:0"),
        fullScoreStream("1/score_meter_v2:2/score_beat_type:0"),
        fullScoreStream("2/score_clefs_v2:0/score_clef_time_tick:0"),
        fullScoreStream("2/score_clefs_v2:1/score_part:0"),
        fullScoreStream("2/score_clefs_v2:2/score_staff:0"),
        fullScoreStream("2/score_clefs_v2:3/score_clef_sign_code:0"),
        fullScoreStream("2/score_clefs_v2:4/score_clef_line:0"),
        fullScoreStream("3/score_tempo_v2:0/score_tempo_time_tick:0"),
        fullScoreStream("3/score_tempo_v2:1/score_tempo_bpm:0"),
        fullScoreStream("4/score_key_v2:0/score_key_time_tick:0"),
        fullScoreStream("4/score_key_v2:1/score_key_fifths:0"),
        fullScoreStream("4/score_key_v2:2/score_key_mode_code:0"),
        fullScoreStream("4/score_key_v2:3/score_part:0"),
        fullScoreStream("5/score_notes_v1:0"),
        fullScoreStream("5/score_notes_v1:1"),
        fullScoreStream("5/score_notes_v1:2"),
        fullScoreStream("5/score_notes_v1:3"),
        fullScoreStream("5/score_notes_v1:4"),
        fullScoreStream("5/score_notes_v1:5"),
        fullScoreStream("5/score_notes_v1:6"),
        fullScoreStream("5/score_notes_v1:7"),
        fullScoreStream("5/score_notes_v1:8"),
      ],
    );
    const score = buildScorePluginRuntimeData(runtime);

    expect(score.adapterId).toBe("music-measured-notes-v1");
    expect(score.stats.noteCount).toBeGreaterThan(0);
    expect(score.stats.measureCount).toBe(1);
    expect(score.musicXml).toContain('<score-partwise version="4.0">');
    expect(score.musicXml).not.toContain("<fifths>8</fifths>");
    expect(score.musicXml).not.toContain("<mode>dorian</mode>");
    expect(score.musicXml).not.toContain("<beat-type>3</beat-type>");
    expect(score.musicXml).not.toContain("<line>1</line>");
    expect(score.musicXml).not.toContain("<octave>-1</octave>");
    expect(score.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "unsupported-score-key-mode",
    );
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
