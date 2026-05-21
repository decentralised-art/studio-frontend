import { describe, expect, it } from "vitest";

import {
  buildMidiClipFromStreamGroups,
  formatMidiSkippedReason,
  midiNoteName,
} from "../src/lib/midi/midiClip";

describe("midi clip model", () => {
  it("maps complete stream groups into strict midi notes", () => {
    const clip = buildMidiClipFromStreamGroups([
      {
        groupPath: "/root/melody",
        pitch: { path: "/root/melody/pitch:0", data: [60, 64] },
        time: { path: "/root/melody/time:0", data: [0, 1.5] },
        duration: { path: "/root/melody/duration:0", data: [1, 0.5] },
        velocity: { path: "/root/melody/velocity:0", data: [90, 80] },
      },
    ]);

    expect(clip.notes).toHaveLength(2);
    expect(clip.notes[0]).toMatchObject({
      pitch: 60,
      time: 0,
      duration: 1,
      velocity: 90,
      channel: 1,
      groupPath: "/root/melody",
    });
    expect(clip.lengthBeats).toBe(2);
    expect(clip.skippedNotes).toBe(0);
  });

  it("accepts explicit tempo and ppq settings", () => {
    const clip = buildMidiClipFromStreamGroups([], { tempo: 96, ppq: 960 });

    expect(clip.tempo).toBe(96);
    expect(clip.ppq).toBe(960);
  });

  it("does not invent missing scalar streams", () => {
    const clip = buildMidiClipFromStreamGroups([
      {
        groupPath: "/root/incomplete",
        pitch: { path: "/root/incomplete/pitch:0", data: [60] },
        time: { path: "/root/incomplete/time:0", data: [0] },
      },
    ]);

    expect(clip.notes).toEqual([]);
    expect(clip.diagnostics[0]?.missing).toEqual(["duration", "velocity"]);
  });

  it("reports missing array entries without defaulting them", () => {
    const clip = buildMidiClipFromStreamGroups([
      {
        groupPath: "/root/uneven",
        pitch: { path: "/root/uneven/pitch:0", data: [60, 62] },
        time: { path: "/root/uneven/time:0", data: [0] },
        duration: { path: "/root/uneven/duration:0", data: [1, 1] },
        velocity: { path: "/root/uneven/velocity:0", data: [90, 90] },
      },
    ]);

    expect(clip.notes).toHaveLength(1);
    expect(clip.skippedNotes).toBe(1);
    expect(clip.skipped[0]).toMatchObject({
      groupPath: "/root/uneven",
      index: 1,
      reason: "missing-value",
    });
  });

  it("rejects invalid midi pitch and velocity ranges", () => {
    const clip = buildMidiClipFromStreamGroups([
      {
        groupPath: "/root/bad-values",
        pitch: { path: "/root/bad-values/pitch:0", data: [60, 128, 64] },
        time: { path: "/root/bad-values/time:0", data: [0, 1, 2] },
        duration: { path: "/root/bad-values/duration:0", data: [1, 1, 1] },
        velocity: { path: "/root/bad-values/velocity:0", data: [90, 90, 160] },
      },
    ]);

    expect(clip.notes).toHaveLength(1);
    expect(clip.skipped.map((item) => item.reason)).toEqual(["invalid-pitch", "invalid-velocity"]);
    expect(clip.diagnostics[0]?.skippedReasons).toMatchObject({
      "invalid-pitch": 1,
      "invalid-velocity": 1,
    });
  });

  it("applies world scalar value limits without dropping later in-range notes", () => {
    const clip = buildMidiClipFromStreamGroups(
      [
        {
          groupPath: "/root/limited-values",
          pitch: { path: "/root/limited-values/pitch:0", data: [60, 90, 64] },
          time: { path: "/root/limited-values/time:0", data: [0, 1, 2] },
          duration: { path: "/root/limited-values/duration:0", data: [1, 1, 1] },
          velocity: { path: "/root/limited-values/velocity:0", data: [90, 90, 90] },
        },
      ],
      {
        scalarValueLimits: {
          pitch: { min: 0, max: 72 },
          time: { min: 0, max: 16 },
          duration: { min: 0.01, max: 16 },
          velocity: { min: 0, max: 127 },
        },
      },
    );

    expect(clip.notes.map((note) => note.pitch)).toEqual([60, 64]);
    expect(clip.skipped.map((item) => item.reason)).toEqual(["invalid-pitch"]);
  });

  it("formats note names and diagnostics for UI display", () => {
    expect(midiNoteName(60)).toBe("C4");
    expect(formatMidiSkippedReason("invalid-duration")).toBe("zero or negative duration");
  });
});
