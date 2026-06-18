import { describe, expect, it } from "vitest";

import {
  buildBackendWorldRuntimeInput,
  buildConnectorSetBindings,
  connectorBindingValueKey,
  initializeConnectorSetBindingValues,
} from "../src/lib/worlds/runtimeInput";
import type { WorldDescriptor } from "../src/lib/worlds/types";

const backendWorld: WorldDescriptor = {
  id: "backend-world-1",
  source: "backend",
  slug: "backend-world",
  name: "Backend World",
  version: "0.1.0",
  entry: "/world-assets/backend-world-1/index.html",
  entryUrn: "/world-assets/backend-world-1/index.html",
  runtime: "iframe",
  permissions: ["dcn.execute"],
  acceptedPluginIds: [],
  acceptedConnectorSets: [{ connectors: ["pitch", "duration"], optionalConnectors: ["velocity"] }],
  surfaces: ["world-page", "studio-plugin"],
  description: "A backend-hosted world.",
};

describe("world runtime input", () => {
  it("initializes connector-set bindings from required slots and the primary connector", () => {
    const values = initializeConnectorSetBindingValues(backendWorld.acceptedConnectorSets?.[0], {
      primaryConnectorName: "lead_pitch",
    });

    expect(values).toEqual({
      [connectorBindingValueKey("pitch")]: "lead_pitch",
      [connectorBindingValueKey("duration")]: "duration",
      [connectorBindingValueKey("velocity", true)]: "",
    });
  });

  it("omits blank optional connector bindings", () => {
    const bindings = buildConnectorSetBindings(backendWorld.acceptedConnectorSets?.[0], {
      [connectorBindingValueKey("pitch")]: "lead_pitch",
      [connectorBindingValueKey("duration")]: "note_length",
      [connectorBindingValueKey("velocity", true)]: "",
    });

    expect(bindings).toEqual([
      { slot: "pitch", connectorName: "lead_pitch" },
      { slot: "duration", connectorName: "note_length" },
    ]);
  });

  it("builds the backend world payload with connector-set metadata and execution output", () => {
    const input = buildBackendWorldRuntimeInput({
      world: backendWorld,
      surface: "studio-plugin",
      label: "Backend World",
      connectorName: "lead_pitch",
      connectorAddress: "0x123",
      connectorFormatHash: "0xabc",
      connectorSetIndex: 0,
      connectorBindingValues: {
        [connectorBindingValueKey("pitch")]: "lead_pitch",
        [connectorBindingValueKey("duration")]: "note_length",
        [connectorBindingValueKey("velocity", true)]: "accent_velocity",
      },
      executeOutput: [{ path: "/pitch:0", data: [60, 64, 67] }],
    });

    expect(input).toMatchObject({
      worldId: "backend-world-1",
      surface: "studio-plugin",
      label: "Backend World",
      connectorName: "lead_pitch",
      connectorNames: ["lead_pitch", "note_length", "accent_velocity"],
      connectorAddress: "0x123",
      connectorFormatHash: "0xabc",
      connectorSet: {
        index: 0,
        connectors: ["pitch", "duration"],
        optionalConnectors: ["velocity"],
      },
      connectorBindings: [
        { slot: "pitch", connectorName: "lead_pitch" },
        { slot: "duration", connectorName: "note_length" },
        { slot: "velocity", connectorName: "accent_velocity", optional: true },
      ],
      executeOutput: [{ path: "/pitch:0", data: [60, 64, 67] }],
    });
  });
});
