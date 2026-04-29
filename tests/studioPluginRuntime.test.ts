import { describe, expect, it } from "vitest";

import type { PtOutputFeature } from "../src/lib/particles/ptMidiAdapter";
import {
  buildStudioPluginRuntimeData,
  collectConnectorScopedStreams,
  groupMidiStreams,
  pathContainsAnyConnectorName,
  pathContainsConnectorName,
  pathStartsWithAnyConnectorPrefix,
  pathStartsWithConnectorPrefix,
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

  it("matches connector names inside stream path segments", () => {
    expect(
      pathContainsConnectorName(
        "/test_midi_polyphony089768:0/test_various_midi_values12345:2/durationv2:0",
        "test_various_midi_values12345",
      ),
    ).toBe(true);
    expect(
      pathContainsAnyConnectorName(
        "/test_midi_polyphony089768:0/test_various_midi_values12345:2/durationv2:0",
        ["missing", "test_midi_polyphony089768"],
      ),
    ).toBe(true);
    expect(pathContainsConnectorName("/root:0/child:0/pitch:0", "other_child")).toBe(false);
  });

  it("matches connector path prefixes without confusing duplicate connector names", () => {
    expect(pathStartsWithConnectorPrefix("/root:0/same:1/pitch:0", "/root:0/same:1")).toBe(true);
    expect(pathStartsWithConnectorPrefix("/root:0/same:0/pitch:0", "/root:0/same:1")).toBe(false);
    expect(pathStartsWithConnectorPrefix("/root:1/same:0/pitch:0", "/root:1/same:*")).toBe(true);
    expect(pathStartsWithConnectorPrefix("/root:0/same:3/pitch:0", "/root:1/same:*")).toBe(false);
    expect(
      pathStartsWithAnyConnectorPrefix("/root:2/same:3/pitch:0", [
        "/root:0/same:*",
        "/root:2/same:*",
      ]),
    ).toBe(true);
  });
});
