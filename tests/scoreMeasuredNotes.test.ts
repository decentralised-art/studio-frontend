import { describe, expect, it } from "vitest";

import type { PtOutputFeature } from "../src/lib/particles/ptMidiAdapter";
import {
  buildScoreFromMeasuredNoteStreams,
  hasMeasuredNoteStreams,
} from "../src/lib/score/adapters/measuredNotes";
import { serializeScoreTreeToMusicXml } from "../src/lib/score/musicXmlSerializer";

const measuredStream = (field: string, data: number[]): PtOutputFeature => ({
  feature_path: `/score_note:0/${field}:0`,
  data,
});

const scoreTemplateStream = (
  collector: string,
  field: string,
  data: number[],
  shaper?: string,
): PtOutputFeature => ({
  feature_path: shaper ? `/${collector}:0/${shaper}:0/${field}:0` : `/${collector}:0/${field}:0`,
  data,
});

describe("score measured-note adapter", () => {
  const quarter = 2520;

  it("detects measured note subformat streams", () => {
    const streams = [
      measuredStream("measure", [2]),
      measuredStream("onset", [1]),
      measuredStream("duration", [1]),
      measuredStream("pitch", [72]),
    ];

    expect(hasMeasuredNoteStreams(streams)).toBe(true);
  });

  it("converts measure-local coordinates into absolute score time", () => {
    const result = buildScoreFromMeasuredNoteStreams([
      measuredStream("measure", [2]),
      measuredStream("onset", [1]),
      measuredStream("duration", [1]),
      measuredStream("pitch", [72]),
      measuredStream("dynamic_code", [6]),
      measuredStream("part", [1]),
    ]);

    expect(result?.tree).not.toBeNull();
    expect(result?.stats).toMatchObject({
      adapterId: "music-measured-notes-v1",
      noteCount: 1,
      measureCount: 2,
    });
    const musicXml = serializeScoreTreeToMusicXml(result!.tree!);
    expect(musicXml).toContain('<measure number="2">');
    expect(musicXml).toContain("<ff/>");
  });

  it("accepts deployed score slot connector names as measured note fields", () => {
    const result = buildScoreFromMeasuredNoteStreams([
      measuredStream("score_measure", [1]),
      measuredStream("score_onset", [0]),
      measuredStream("score_duration", [1]),
      measuredStream("score_pitch", [60]),
      measuredStream("score_dynamic_code", [4]),
      measuredStream("score_part", [1]),
      measuredStream("score_staff", [1]),
      measuredStream("score_voice", [1]),
    ]);

    expect(result?.tree).not.toBeNull();
    expect(result?.stats.noteCount).toBe(1);
    const musicXml = serializeScoreTreeToMusicXml(result!.tree!);
    expect(musicXml).toContain("<mf/>");
    expect(musicXml).toContain("<step>C</step>");
  });

  it("uses global tick time and explicit meter layers for score templates", () => {
    const result = buildScoreFromMeasuredNoteStreams([
      scoreTemplateStream("score_notes_v1", "score_event_id", [1, 2]),
      scoreTemplateStream("score_notes_v1", "score_onset", [0, 3 * quarter]),
      scoreTemplateStream("score_notes_v1", "score_duration", [quarter, quarter]),
      scoreTemplateStream("score_notes_v1", "score_pitch", [60, 64]),
      scoreTemplateStream("score_meter_v2", "score_meter_time_tick", [0]),
      scoreTemplateStream("score_meter_v2", "score_beats", [3]),
      scoreTemplateStream("score_meter_v2", "score_beat_type", [4]),
      scoreTemplateStream("score_parts_v2", "score_part", [1]),
      scoreTemplateStream("score_parts_v2", "score_staff_count", [1]),
      scoreTemplateStream("score_tempo_v2", "score_tempo_time_tick", [0]),
      scoreTemplateStream("score_tempo_v2", "score_tempo_bpm", [72]),
      scoreTemplateStream("score_key_v2", "score_key_time_tick", [0]),
      scoreTemplateStream("score_key_v2", "score_key_fifths", [2]),
      scoreTemplateStream("score_key_v2", "score_key_mode_code", [0]),
      scoreTemplateStream("score_clefs_v2", "score_clef_time_tick", [0]),
      scoreTemplateStream("score_clefs_v2", "score_part", [1]),
      scoreTemplateStream("score_clefs_v2", "score_staff", [1]),
      scoreTemplateStream("score_clefs_v2", "score_clef_sign_code", [0]),
      scoreTemplateStream("score_clefs_v2", "score_clef_line", [2]),
    ]);

    expect(result?.tree).not.toBeNull();
    expect(result?.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain(
      "missing-score-meter",
    );
    expect(result?.stats.measureCount).toBe(2);
    const musicXml = serializeScoreTreeToMusicXml(result!.tree!);
    expect(musicXml).toContain("<divisions>2520</divisions>");
    expect(musicXml).toContain("<beats>3</beats>");
    expect(musicXml).toContain("<beat-type>4</beat-type>");
    expect(musicXml).toContain("<fifths>2</fifths>");
    expect(musicXml).toContain("<mode>major</mode>");
    expect(musicXml).toContain('<sound tempo="72"/>');
    expect(musicXml).toContain('<measure number="2">');
  });

  it("interprets notes onset and duration slots as global ticks", () => {
    const result = buildScoreFromMeasuredNoteStreams([
      scoreTemplateStream("score_notes_v1", "score_event_id", [1]),
      scoreTemplateStream("score_notes_v1", "score_onset", [0]),
      scoreTemplateStream("score_notes_v1", "score_duration", [quarter]),
      scoreTemplateStream("score_notes_v1", "score_pitch", [60]),
      scoreTemplateStream("score_meter_v2", "score_meter_time_tick", [0]),
      scoreTemplateStream("score_meter_v2", "score_beats", [4]),
      scoreTemplateStream("score_meter_v2", "score_beat_type", [4]),
    ]);

    expect(result?.tree).not.toBeNull();
    expect(result?.stats.noteCount).toBe(1);
    expect(result?.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain(
      "missing-measured-note-stream",
    );
  });

  it("maps deployed open score collector dimensions by position", () => {
    const result = buildScoreFromMeasuredNoteStreams([
      { feature_path: "/score_full_v2:5/score_notes_v1:0", data: [1] },
      { feature_path: "/score_full_v2:5/score_notes_v1:1", data: [0] },
      { feature_path: "/score_full_v2:5/score_notes_v1:2", data: [quarter] },
      { feature_path: "/score_full_v2:5/score_notes_v1:3", data: [60] },
      { feature_path: "/score_full_v2:1/score_meter_v2:0/score_meter_time_tick:0", data: [0] },
      { feature_path: "/score_full_v2:1/score_meter_v2:1/score_beats:0", data: [4] },
      { feature_path: "/score_full_v2:1/score_meter_v2:2/score_beat_type:0", data: [4] },
    ]);

    expect(result?.tree).not.toBeNull();
    expect(result?.stats.adapterId).toBe("music-measured-notes-v1");
    expect(result?.stats.noteCount).toBe(1);
    const musicXml = serializeScoreTreeToMusicXml(result!.tree!);
    expect(musicXml).toContain("<step>C</step>");
  });

  it("renders meter changes from the meter layer", () => {
    const result = buildScoreFromMeasuredNoteStreams([
      scoreTemplateStream("score_notes_v1", "score_onset", [0, 4 * quarter]),
      scoreTemplateStream("score_notes_v1", "score_duration", [quarter, quarter]),
      scoreTemplateStream("score_notes_v1", "score_pitch", [60, 62]),
      scoreTemplateStream("score_meter_v2", "score_meter_time_tick", [0, 4 * quarter]),
      scoreTemplateStream("score_meter_v2", "score_beats", [4, 5]),
      scoreTemplateStream("score_meter_v2", "score_beat_type", [4, 8]),
    ]);

    expect(result?.tree).not.toBeNull();
    const musicXml = serializeScoreTreeToMusicXml(result!.tree!);
    expect(musicXml).toContain("<beats>4</beats>");
    expect(musicXml).toContain("<beats>5</beats>");
    expect(musicXml).toContain("<beat-type>8</beat-type>");
  });

  it("groups shaped score slot streams by their nearest notes collector", () => {
    const result = buildScoreFromMeasuredNoteStreams([
      scoreTemplateStream("score_notes_v1", "score_event_id", [1]),
      scoreTemplateStream("score_notes_v1", "score_onset", [0]),
      scoreTemplateStream("score_notes_v1", "score_duration", [quarter]),
      scoreTemplateStream("score_notes_v1", "score_pitch", [67], "scale_mapper"),
      scoreTemplateStream("score_notes_v1", "score_dynamic_code", [5], "phrase_shape"),
    ]);

    expect(result?.tree).not.toBeNull();
    expect(result?.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain(
      "missing-measured-note-stream",
    );
    const musicXml = serializeScoreTreeToMusicXml(result!.tree!);
    expect(musicXml).toContain("<step>G</step>");
    expect(musicXml).toContain("<f/>");
  });

  it("attaches articulation and slur templates to notes by score_event_id", () => {
    const result = buildScoreFromMeasuredNoteStreams([
      scoreTemplateStream("score_notes_v1", "score_event_id", [42, 43]),
      scoreTemplateStream("score_notes_v1", "score_onset", [0, quarter]),
      scoreTemplateStream("score_notes_v1", "score_duration", [quarter, quarter]),
      scoreTemplateStream("score_notes_v1", "score_pitch", [60, 62]),
      scoreTemplateStream("score_articulations_v1", "score_event_id", [42]),
      scoreTemplateStream("score_articulations_v1", "score_articulation_code", [1]),
      scoreTemplateStream("score_articulations_v1", "score_placement", [6]),
      scoreTemplateStream("score_slurs_v1", "score_event_id", [42, 43]),
      scoreTemplateStream("score_slurs_v1", "score_slur_number", [1, 1]),
      scoreTemplateStream("score_slurs_v1", "score_slur_type", [1, 2]),
      scoreTemplateStream("score_slurs_v1", "score_placement", [6, 6]),
    ]);

    expect(result?.tree).not.toBeNull();
    const musicXml = serializeScoreTreeToMusicXml(result!.tree!);
    expect(musicXml).toContain("<articulations>");
    expect(musicXml).toContain('<staccato placement="above"/>');
    expect(musicXml).toContain('<slur number="1" placement="above" type="start"/>');
    expect(musicXml).toContain('<slur number="1" placement="above" type="stop"/>');
  });

  it("reports missing measured note rows without falling back silently", () => {
    const result = buildScoreFromMeasuredNoteStreams([
      measuredStream("measure", [1]),
      measuredStream("onset", [0]),
      measuredStream("duration", [1]),
      measuredStream("pitch", []),
    ]);

    expect(result?.tree).toBeNull();
    expect(result?.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "missing-measured-note-value",
    );
  });
});
