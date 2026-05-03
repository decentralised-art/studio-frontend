import { describe, expect, it } from "vitest";

import {
  buildScoreFromMidiGroups,
  buildScoreFromNoteEvents,
} from "../src/lib/score/adapters/noteEvents";
import { serializeScoreTreeToMusicXml } from "../src/lib/score/musicXmlSerializer";

describe("score note-event adapter", () => {
  it("converts pitch/time/duration/velocity events into MusicXML 4.0", () => {
    const result = buildScoreFromNoteEvents([
      { pitch: 60, time: 0, duration: 1, velocity: 64 },
      { pitch: 64, time: 1, duration: 2, velocity: 96 },
    ]);

    expect(result.tree).not.toBeNull();
    expect(result.stats).toMatchObject({
      adapterId: "music-note-events-v1",
      noteCount: 2,
      measureCount: 1,
      partCount: 1,
    });

    const musicXml = serializeScoreTreeToMusicXml(result.tree!);
    expect(musicXml).toContain('<score-partwise version="4.0">');
    expect(musicXml).toContain("<step>C</step>");
    expect(musicXml).toContain("<octave>4</octave>");
    expect(musicXml).toContain("<duration>480</duration>");
    expect(musicXml).toContain("<mf/>");
    expect(musicXml).toContain("<ff/>");
  });

  it("keeps simultaneous notes as a MusicXML chord", () => {
    const result = buildScoreFromNoteEvents([
      { pitch: 60, time: 0, duration: 1, velocity: 80 },
      { pitch: 67, time: 0, duration: 1, velocity: 80 },
    ]);

    const musicXml = serializeScoreTreeToMusicXml(result.tree!);
    expect(musicXml).toContain("<chord/>");
    expect(result.stats.noteCount).toBe(2);
  });

  it("splits long notes across measures with ties", () => {
    const result = buildScoreFromNoteEvents([{ pitch: 60, time: 3, duration: 2, velocity: 80 }]);

    const musicXml = serializeScoreTreeToMusicXml(result.tree!);
    expect(result.stats.measureCount).toBe(2);
    expect(musicXml).toContain('<tie type="start"/>');
    expect(musicXml).toContain('<tie type="stop"/>');
  });

  it("emits dynamics only when the value changes across measures", () => {
    const result = buildScoreFromNoteEvents([
      { pitch: 60, time: 0, duration: 1, velocity: 64 },
      { pitch: 62, time: 4, duration: 1, velocity: 64 },
      { pitch: 64, time: 8, duration: 1, velocity: 96 },
    ]);

    const musicXml = serializeScoreTreeToMusicXml(result.tree!);
    expect(musicXml.match(/<mf\/>/g)).toHaveLength(1);
    expect(musicXml.match(/<ff\/>/g)).toHaveLength(1);
  });

  it("declares multiple staves when score events target more than one staff", () => {
    const result = buildScoreFromNoteEvents([
      { pitch: 72, time: 0, duration: 1, staff: 1, voice: 1 },
      { pitch: 48, time: 1, duration: 1, staff: 2, voice: 2 },
    ]);

    const musicXml = serializeScoreTreeToMusicXml(result.tree!);
    expect(musicXml).toContain("<staves>2</staves>");
    expect(musicXml).toContain('<clef number="1">');
    expect(musicXml).toContain('<clef number="2">');
    expect(musicXml).toContain("<staff>2</staff>");
  });

  it("skips invalid score values with diagnostics", () => {
    const result = buildScoreFromNoteEvents([{ pitch: 60, time: 0, duration: 0 }]);

    expect(result.tree).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("invalid-duration");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("no-score-notes");
  });

  it("adapts Studio MIDI stream groups into notation", () => {
    const result = buildScoreFromMidiGroups(
      [
        {
          groupPath: "/midi_root:0",
          pitch: { feature_path: "/midi_root:0/pitch:0", data: [60] },
          time: { feature_path: "/midi_root:0/time:0", data: [0] },
          duration: { feature_path: "/midi_root:0/duration:0", data: [1] },
          velocity: { feature_path: "/midi_root:0/velocity:0", data: [80] },
        },
      ],
      4,
    );

    expect(result.tree).not.toBeNull();
    expect(result.stats.streamCount).toBe(4);
    expect(serializeScoreTreeToMusicXml(result.tree!)).toContain("<part-name>Part 1</part-name>");
  });
});
