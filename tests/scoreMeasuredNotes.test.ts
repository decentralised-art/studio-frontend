import { describe, expect, it } from "vitest";

import type { PtOutputFeature } from "../src/lib/particles/ptMidiAdapter";
import {
  buildScoreFromMeasuredNoteStreams,
  hasMeasuredNoteStreams,
} from "../src/lib/score/adapters/measuredNotes";
import { serializeScoreTreeToMusicXml } from "../src/lib/score/musicXmlSerializer";

const stream = (path: string, data: number[]): PtOutputFeature => ({
  feature_path: path,
  data,
});

const groupStream = (group: string, field: string, data: number[], shaper?: string) =>
  stream(shaper ? `/${group}:0/${shaper}:0/${field}:0` : `/${group}:0/${field}:0`, data);

describe("score measured-note adapter", () => {
  const quarter = 2520;

  it("detects the required MusicXML World semantic terminal streams", () => {
    const streams = [
      groupStream("melody", "onset_tick", [0]),
      groupStream("melody", "duration_tick", [quarter]),
      groupStream("melody", "pitch_midi", [72]),
    ];

    expect(hasMeasuredNoteStreams(streams)).toBe(true);
  });

  it("builds notes from world-agnostic musical terminal fields under a shared parent", () => {
    const streams = [
      stream("/melody:0/tick_grid:0/onset_tick:0", [0, quarter]),
      stream("/melody:0/duration_logic:0/duration_tick:0", [quarter, quarter]),
      stream("/melody:0/scale_logic:0/pitch_midi:0", [60, 62]),
      stream("/melody:0/accent_logic:0/velocity_midi:0", [48, 96]),
    ];
    const result = buildScoreFromMeasuredNoteStreams(streams);

    expect(hasMeasuredNoteStreams(streams)).toBe(true);
    expect(result?.tree).not.toBeNull();
    expect(result?.stats.noteCount).toBe(2);
    const musicXml = serializeScoreTreeToMusicXml(result!.tree!);
    expect(musicXml).toContain("<step>C</step>");
    expect(musicXml).toContain("<step>D</step>");
  });

  it("keeps optional note-property source paths for score highlighting", () => {
    const velocityPath = "/melody:0/accent_logic:0/velocity_midi:0";
    const dynamicPath = "/melody:0/dynamic_logic:0/dynamic_code:0";
    const voicePath = "/melody:0/voice_logic:0/voice:0";
    const staffPath = "/melody:0/staff_logic:0/staff:0";
    const partPath = "/melody:0/part_logic:0/part:0";
    const result = buildScoreFromMeasuredNoteStreams([
      stream("/melody:0/tick_grid:0/onset_tick:0", [0]),
      stream("/melody:0/duration_logic:0/duration_tick:0", [quarter]),
      stream("/melody:0/scale_logic:0/pitch_midi:0", [60]),
      stream(velocityPath, [96]),
      stream(dynamicPath, [4]),
      stream(voicePath, [1]),
      stream(staffPath, [1]),
      stream(partPath, [1]),
    ]);

    expect(result).not.toBeNull();
    const sourcePaths = (result!.renderedNotes ?? [])[0]?.sourcePaths ?? [];
    expect(sourcePaths).toEqual(
      expect.arrayContaining([velocityPath, dynamicPath, voicePath, staffPath, partPath]),
    );
  });

  it("groups semantic terminal fields connected to sibling dimensions of the same parent", () => {
    const result = buildScoreFromMeasuredNoteStreams([
      stream("/major_scale_score:0/quarter_tick_grid:0/onset_tick:0", [0, quarter]),
      stream("/major_scale_score:1/constant_value:0/duration_tick:0", [quarter, quarter]),
      stream("/major_scale_score:2/major_scale_steps:0/pitch_midi:0", [60, 62]),
    ]);

    expect(result?.tree).not.toBeNull();
    expect(result?.stats.noteCount).toBe(2);
    expect(result?.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain(
      "missing-measured-note-stream",
    );
    const musicXml = serializeScoreTreeToMusicXml(result!.tree!);
    expect(musicXml).toContain("<step>C</step>");
    expect(musicXml).toContain("<step>D</step>");
  });

  it("uses global tick time and explicit semantic meter layers", () => {
    const result = buildScoreFromMeasuredNoteStreams([
      groupStream("notes", "event_id", [1, 2]),
      groupStream("notes", "onset_tick", [0, 3 * quarter]),
      groupStream("notes", "duration_tick", [quarter, quarter]),
      groupStream("notes", "pitch_midi", [60, 64]),
      groupStream("meter", "meter_time_tick", [0]),
      groupStream("meter", "meter_beats", [3]),
      groupStream("meter", "meter_beat_type", [4]),
      groupStream("parts", "part", [1]),
      groupStream("parts", "staff_count", [1]),
      groupStream("tempo", "tempo_time_tick", [0]),
      groupStream("tempo", "tempo_bpm", [72]),
      groupStream("key", "key_time_tick", [0]),
      groupStream("key", "key_fifths", [2]),
      groupStream("key", "key_mode_code", [0]),
      groupStream("clefs", "clef_time_tick", [0]),
      groupStream("clefs", "clef_part", [1]),
      groupStream("clefs", "clef_staff", [1]),
      groupStream("clefs", "clef_sign_code", [0]),
      groupStream("clefs", "clef_line", [2]),
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
  });

  it("groups optional score layers by semantic terminal fields under shared parents", () => {
    const result = buildScoreFromMeasuredNoteStreams([
      stream("/melody:0/tick_grid:0/onset_tick:0", [0, 3 * quarter]),
      stream("/melody:0/duration_logic:0/duration_tick:0", [quarter, quarter]),
      stream("/melody:0/scale_logic:0/pitch_midi:0", [60, 64]),
      stream("/global_signature:0/timing_logic:0/meter_time_tick:0", [0]),
      stream("/global_signature:0/beat_logic:0/meter_beats:0", [3]),
      stream("/global_signature:0/beat_type_logic:0/meter_beat_type:0", [4]),
      stream("/score_tempo_controls:0/timing_logic:0/tempo_time_tick:0", [0]),
      stream("/score_tempo_controls:0/bpm_logic:0/tempo_bpm:0", [84]),
      stream("/score_key_controls:0/timing_logic:0/key_time_tick:0", [0]),
      stream("/score_key_controls:0/fifths_logic:0/key_fifths:0", [1]),
      stream("/score_key_controls:0/mode_logic:0/key_mode_code:0", [0]),
      stream("/score_clef_controls:0/timing_logic:0/clef_time_tick:0", [0]),
      stream("/score_clef_controls:0/part_logic:0/clef_part:0", [1]),
      stream("/score_clef_controls:0/staff_logic:0/clef_staff:0", [1]),
      stream("/score_clef_controls:0/sign_logic:0/clef_sign_code:0", [0]),
      stream("/score_clef_controls:0/line_logic:0/clef_line:0", [2]),
    ]);

    expect(result?.tree).not.toBeNull();
    expect(result?.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain(
      "missing-score-meter",
    );
    const musicXml = serializeScoreTreeToMusicXml(result!.tree!);
    expect(musicXml).toContain("<beats>3</beats>");
    expect(musicXml).toContain("<fifths>1</fifths>");
    expect(musicXml).toContain("<mode>major</mode>");
    expect(musicXml).toContain('<sound tempo="84"/>');
  });

  it("does not render legacy score_onset/score_duration/score_pitch aliases", () => {
    const streams = [
      groupStream("legacy", "score_onset", [0]),
      groupStream("legacy", "score_duration", [quarter]),
      groupStream("legacy", "score_pitch", [60]),
    ];

    expect(hasMeasuredNoteStreams(streams)).toBe(false);
    expect(buildScoreFromMeasuredNoteStreams(streams)).toBeNull();
  });

  it("does not infer note semantics from positional schema slots", () => {
    const streams: PtOutputFeature[] = [
      stream("/positional_score:0/note_table:0/quarter_tick_grid:0", [0, quarter]),
      stream("/positional_score:0/note_table:1/constant_duration:0", [quarter, quarter]),
      stream("/positional_score:0/note_table:2/scale_logic:0", [60, 62]),
    ];

    expect(hasMeasuredNoteStreams(streams, ["positional_score"])).toBe(false);
    expect(buildScoreFromMeasuredNoteStreams(streams, ["positional_score"])).toBeNull();
  });

  it("preserves non-notatable tick durations instead of quantizing them", () => {
    const result = buildScoreFromMeasuredNoteStreams([
      stream("/melody:0/quarter_tick_grid:0/onset_tick:0", [0, quarter]),
      stream("/melody:0/counter:0/duration_tick:0", [quarter, quarter + 1]),
      stream("/melody:0/major_scale_steps:0/pitch_midi:0", [60, 62]),
    ]);

    expect(result?.tree).not.toBeNull();
    expect(result?.stats.noteCount).toBe(2);
    expect(result?.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain(
      "quantized-note-grid",
    );
    const musicXml = serializeScoreTreeToMusicXml(result!.tree!);
    expect(musicXml).toContain("<duration>2520</duration>");
    expect(musicXml).toContain("<duration>2521</duration>");
  });

  it("skips out-of-range world scalar values while keeping later in-range rows renderable", () => {
    const result = buildScoreFromMeasuredNoteStreams(
      [
        stream("/melody:0/tick_grid:0/onset_tick:0", [0, quarter, 2 * quarter]),
        stream("/melody:0/duration_logic:0/duration_tick:0", [quarter, quarter, quarter]),
        stream("/melody:0/scale_logic:0/pitch_midi:0", [60, 140, 64]),
      ],
      [],
      {
        scalarValueLimits: {
          onset_tick: { min: 0, max: 10 * quarter },
          duration_tick: { min: 1, max: 10 * quarter },
          pitch_midi: { min: 0, max: 127 },
        },
      },
    );

    expect(result?.tree).not.toBeNull();
    expect(result?.stats.noteCount).toBe(2);
    expect(result?.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "out-of-range-measured-note-value",
    );
    const musicXml = serializeScoreTreeToMusicXml(result!.tree!);
    expect(musicXml).toContain("<step>C</step>");
    expect(musicXml).toContain("<step>E</step>");
  });

  it("renders meter changes from semantic meter streams", () => {
    const result = buildScoreFromMeasuredNoteStreams([
      groupStream("notes", "onset_tick", [0, 4 * quarter]),
      groupStream("notes", "duration_tick", [quarter, quarter]),
      groupStream("notes", "pitch_midi", [60, 62]),
      groupStream("meter", "meter_time_tick", [0, 4 * quarter]),
      groupStream("meter", "meter_beats", [4, 5]),
      groupStream("meter", "meter_beat_type", [4, 8]),
    ]);

    expect(result?.tree).not.toBeNull();
    const musicXml = serializeScoreTreeToMusicXml(result!.tree!);
    expect(musicXml).toContain("<beats>4</beats>");
    expect(musicXml).toContain("<beats>5</beats>");
    expect(musicXml).toContain("<beat-type>8</beat-type>");
  });

  it("attaches articulation and slur streams to notes by event_id", () => {
    const result = buildScoreFromMeasuredNoteStreams([
      groupStream("notes", "event_id", [42, 43]),
      groupStream("notes", "onset_tick", [0, quarter]),
      groupStream("notes", "duration_tick", [quarter, quarter]),
      groupStream("notes", "pitch_midi", [60, 62]),
      groupStream("articulations", "event_id", [42]),
      groupStream("articulations", "articulation_code", [1]),
      groupStream("articulations", "placement", [6]),
      groupStream("slurs", "event_id", [42, 43]),
      groupStream("slurs", "slur_number", [1, 1]),
      groupStream("slurs", "slur_type", [1, 2]),
      groupStream("slurs", "placement", [6, 6]),
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
      groupStream("notes", "onset_tick", [0]),
      groupStream("notes", "duration_tick", [quarter]),
      groupStream("notes", "pitch_midi", []),
    ]);

    expect(result?.tree).toBeNull();
    expect(result?.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "missing-measured-note-value",
    );
  });
});
