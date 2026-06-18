import { describe, expect, it } from "vitest";

import type { StudioPluginDescriptor } from "../src/lib/studio/plugins/registry";
import {
  describeStudioWorldPluginCompatibility,
  resolveStudioWorldConnectorSetMatch,
  studioWorldConnectorSetSelectionFromMatch,
  summarizeStudioWorldConnectorSets,
} from "../src/lib/studio/plugins/worldCompatibility";
import { connectorBindingValueKey } from "../src/lib/worlds/runtimeInput";

const backendPlugin: StudioPluginDescriptor = {
  id: "world:backend-world-1",
  name: "Backend World",
  summary: "Backend world.",
  supportedFormatHashes: [],
  acceptedConnectorSets: [{ connectors: ["pitch", "duration"], optionalConnectors: ["velocity"] }],
  status: "active",
  source: "backend-world",
};

describe("studio world compatibility", () => {
  it("maps the active root connector to the first required slot and exact matching nodes to the rest", () => {
    const match = resolveStudioWorldConnectorSetMatch({
      connectorSets: backendPlugin.acceptedConnectorSets,
      rootConnectorName: "lead_pitch",
      availableTargets: [
        { id: "node-pitch", name: "lead_pitch" },
        { id: "node-duration", name: "duration" },
        { id: "node-velocity", name: "velocity" },
      ],
    });

    expect(match).toMatchObject({
      connectorSetIndex: 0,
      attachedTargetIds: ["node-pitch", "node-duration", "node-velocity"],
      missingRequiredConnectors: [],
      bindings: [
        { slot: "pitch", connectorName: "lead_pitch", targetId: "node-pitch" },
        { slot: "duration", connectorName: "duration", targetId: "node-duration" },
        {
          slot: "velocity",
          connectorName: "velocity",
          optional: true,
          targetId: "node-velocity",
        },
      ],
    });
  });

  it("reports missing required connector slots without serializing a runnable selection", () => {
    const compatibility = describeStudioWorldPluginCompatibility({
      plugin: backendPlugin,
      rootConnectorName: "lead_pitch",
      rootFormatHash: "",
      availableTargets: [{ id: "node-pitch", name: "lead_pitch" }],
    });

    expect(compatibility).toMatchObject({
      label: "Partial connector set",
      detail: "Missing required connector slots: duration",
      kind: "partial",
      match: {
        attachedTargetIds: ["node-pitch"],
        missingRequiredConnectors: ["duration"],
      },
    });
    expect(studioWorldConnectorSetSelectionFromMatch(compatibility.match)).toBeUndefined();
  });

  it("serializes the scored connector-set match for runtime payload construction", () => {
    const match = resolveStudioWorldConnectorSetMatch({
      connectorSets: [
        { connectors: ["foo", "bar"], optionalConnectors: [] },
        { connectors: ["pitch", "duration"], optionalConnectors: ["velocity"] },
      ],
      rootConnectorName: "lead_pitch",
      availableTargets: [
        { id: "node-lead-pitch", name: "lead_pitch" },
        { id: "node-duration", name: "duration" },
        { id: "node-velocity", name: "velocity" },
      ],
    });

    expect(match?.connectorSetIndex).toBe(1);
    expect(studioWorldConnectorSetSelectionFromMatch(match)).toEqual({
      connectorSetIndex: 1,
      connectorBindingValues: {
        [connectorBindingValueKey("pitch")]: "lead_pitch",
        [connectorBindingValueKey("duration")]: "duration",
        [connectorBindingValueKey("velocity", true)]: "velocity",
      },
    });
  });

  it("falls back to normalized format-hash compatibility when no connector set matches", () => {
    const compatibility = describeStudioWorldPluginCompatibility({
      plugin: {
        ...backendPlugin,
        acceptedConnectorSets: [],
        supportedFormatHashes: ["0xabc"],
      },
      rootConnectorName: "score_root",
      rootFormatHash: "0XABC",
      availableTargets: [{ id: "score-root", name: "score_root" }],
    });

    expect(compatibility).toMatchObject({
      label: "Format match",
      detail: "0xabc",
      kind: "format",
      match: null,
    });
  });

  it("summarizes declared connector sets for plugin cards", () => {
    expect(summarizeStudioWorldConnectorSets(backendPlugin.acceptedConnectorSets)).toBe(
      "Set 1: pitch, duration; optional velocity",
    );
  });
});
