import { describe, expect, it } from "vitest";

import { encodeMidiClip, pluginRuntimeToMidiClip } from "../src/lib/studio/plugins/midiExport";
import type { StudioPluginRuntimeData } from "../src/lib/studio/plugins/runtime";

const runtimeData: StudioPluginRuntimeData = {
  pluginId: "midi-clip-export-v1",
  connectorTargets: ["test_midi_connector078963"],
  streams: [],
  midiGroups: [
    {
      groupPath: "/test_midi_connector078963:0",
      pitch: { feature_path: "/test_midi_connector078963:0/pitch:0", data: [60, 62, 64] },
      time: { feature_path: "/test_midi_connector078963:0/time:0", data: [0, 1, 2] },
      duration: { feature_path: "/test_midi_connector078963:0/duration:0", data: [1, 1, 1] },
      velocity: { feature_path: "/test_midi_connector078963:0/velocity:0", data: [50, 60, 70] },
    },
  ],
};

describe("studio plugin midi export", () => {
  it("maps plugin runtime groups into midi notes directly", () => {
    const clip = pluginRuntimeToMidiClip(runtimeData);
    expect(clip.notes).toHaveLength(3);
    expect(clip.notes[0]).toMatchObject({
      pitch: 60,
      time: 0,
      duration: 1,
      velocity: 50,
      channel: 1,
    });
    expect(clip.lengthBeats).toBe(3);
  });

  it("drops out-of-range pitch notes instead of clamping", () => {
    const clip = pluginRuntimeToMidiClip({
      ...runtimeData,
      midiGroups: [
        {
          ...runtimeData.midiGroups[0],
          pitch: { feature_path: "/x/pitch:0", data: [60, 200] },
          time: { feature_path: "/x/time:0", data: [0, 1] },
          duration: { feature_path: "/x/duration:0", data: [1, 1] },
          velocity: { feature_path: "/x/velocity:0", data: [90, 90] },
        },
      ],
    });
    expect(clip.notes).toHaveLength(1);
    expect(clip.skippedNotes).toBe(1);
  });

  it("encodes valid midi bytes with MThd header", () => {
    const clip = pluginRuntimeToMidiClip(runtimeData);
    const bytes = encodeMidiClip(clip);
    expect(bytes[0]).toBe(0x4d); // M
    expect(bytes[1]).toBe(0x54); // T
    expect(bytes[2]).toBe(0x68); // h
    expect(bytes[3]).toBe(0x64); // d
    expect(bytes.length).toBeGreaterThan(24);
  });
});
