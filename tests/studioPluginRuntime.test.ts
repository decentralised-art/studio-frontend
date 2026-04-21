import { describe, expect, it } from "vitest";

import type { PtOutputFeature } from "../src/lib/particles/ptMidiAdapter";
import {
  buildStudioPluginRuntimeData,
  collectConnectorScopedStreams,
  groupMidiStreams,
} from "../src/lib/studio/plugins/runtime";

const sampleStreams: PtOutputFeature[] = [
  {
    feature_path: "/test_midi_polyphony089768:0/test_various_midi_values12345:0/pitch:0",
    data: [20, 22, 23],
  },
  {
    feature_path: "/test_midi_polyphony089768:0/test_various_midi_values12345:1/time:0",
    data: [0, 1, 4],
  },
  {
    feature_path: "/test_midi_polyphony089768:0/test_various_midi_values12345:2/durationv2:0",
    data: [1, 2, 4],
  },
  {
    feature_path: "/test_midi_polyphony089768:0/test_various_midi_values12345:3/velocity:0",
    data: [60, 70, 55],
  },
  {
    feature_path: "/other_connector:0/pitch:0",
    data: [10, 11, 12],
  },
];

describe("studio plugin runtime helpers", () => {
  it("scopes streams to connected connector targets", () => {
    const scoped = collectConnectorScopedStreams(sampleStreams, [
      "test_midi_polyphony089768",
      "missing_connector",
    ]);
    expect(scoped).toHaveLength(4);
    expect(
      scoped.every((stream) => stream.feature_path.includes("test_midi_polyphony089768")),
    ).toBe(true);
  });

  it("groups scalar streams by path and normalizes duration aliases", () => {
    const groups = groupMidiStreams(sampleStreams);
    expect(groups).toHaveLength(2);

    const polyphonyGroup = groups.find((group) =>
      group.groupPath.includes("/test_midi_polyphony089768:0"),
    );
    expect(polyphonyGroup).toBeDefined();
    expect(polyphonyGroup?.duration?.feature_path.endsWith("/durationv2:0")).toBe(true);
    expect(polyphonyGroup?.pitch?.feature_path.endsWith("/pitch:0")).toBe(true);
  });

  it("builds plugin runtime payload with scoped streams and midi groups", () => {
    const payload = buildStudioPluginRuntimeData(
      "midi-clip-export-v1",
      ["test_midi_polyphony089768"],
      sampleStreams,
    );

    expect(payload.pluginId).toBe("midi-clip-export-v1");
    expect(payload.connectorTargets).toEqual(["test_midi_polyphony089768"]);
    expect(payload.streams).toHaveLength(4);
    expect(payload.midiGroups.length).toBeGreaterThan(0);
  });
});
