import { describe, expect, it } from "vitest";

import {
  listCompatibleStudioPlugins,
  listStudioPlugins,
  listStudioWorldPlugins,
  studioPluginFromWorldDescriptor,
  studioPluginIdForWorld,
  TONE_WORLD_PLUGIN_ID,
} from "../src/lib/studio/plugins/registry";
import { FIRST_PARTY_WORLDS, MIDI_CLIP_WORLD_ID, TONE_WORLD } from "../src/lib/worlds/registry";
import type { WorldDescriptor } from "../src/lib/worlds/types";

const midiQuadFormatHash = "0xfb01a34414c7cfd27fe4658f53b5b39361da407b46848efac553fd2d8ad9b411";
const fullScoreFormatHash = "0x637d49f0ec85ec68c9abfedb750881d641ebab0bbbe046db6341b128edc42dae";
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
  acceptedFormatHashes: [midiQuadFormatHash.toUpperCase(), "not-a-format"],
  acceptedConnectorSets: [{ connectors: ["pitch"], optionalConnectors: [] }],
  surfaces: ["studio-plugin", "world-page"],
  description: "A backend-hosted world.",
  shortDescription: "Backend-hosted world preview.",
  backend: {
    ownerId: "user-1",
    bundleHash: "a".repeat(64),
    manifestHash: "b".repeat(64),
    entryPath: "index.html",
    entryUrn: "/world-assets/backend-world-1/index.html",
    status: "active",
    createdAt: "2026-06-17T12:00:00Z",
    updatedAt: "2026-06-17T12:00:00Z",
  },
};

describe("studio plugin registry", () => {
  it("keeps the midi plugin available as an in-app Studio plugin", () => {
    expect(listStudioPlugins().map((plugin) => plugin.id)).toContain("midi-clip-export-v1");
    expect(listStudioPlugins().map((plugin) => plugin.id)).toContain("music-score-v1");
    expect(listStudioPlugins().map((plugin) => plugin.id)).toContain(TONE_WORLD_PLUGIN_ID);
    expect(FIRST_PARTY_WORLDS.map((world) => world.id)).toContain(MIDI_CLIP_WORLD_ID);
    expect(TONE_WORLD.acceptedPluginIds).toContain(TONE_WORLD_PLUGIN_ID);
  });

  it("matches music plugins by normalized format hash", () => {
    expect(
      listCompatibleStudioPlugins(midiQuadFormatHash.toUpperCase()).map((plugin) => plugin.id),
    ).toEqual(["midi-clip-export-v1"]);
  });

  it("does not match old layered score template hashes for the Music Score plugin", () => {
    expect(
      listCompatibleStudioPlugins(fullScoreFormatHash.toUpperCase()).map((plugin) => plugin.id),
    ).toEqual([]);
  });

  it("does not expose the midi plugin for unknown formats", () => {
    expect(listCompatibleStudioPlugins("0x1234")).toEqual([]);
    expect(listCompatibleStudioPlugins(null)).toEqual([]);
  });

  it("adapts backend world descriptors into Studio plugin entries", () => {
    const plugin = studioPluginFromWorldDescriptor(backendWorld);

    expect(plugin).toMatchObject({
      id: studioPluginIdForWorld(backendWorld),
      name: "Backend World",
      summary: "Backend-hosted world preview.",
      source: "backend-world",
      status: "active",
      supportedFormatHashes: [midiQuadFormatHash],
      acceptedConnectorSets: [{ connectors: ["pitch"], optionalConnectors: [] }],
    });
    expect(plugin.worldDescriptor).toEqual(backendWorld);
    expect(listStudioWorldPlugins([backendWorld, TONE_WORLD])).toEqual([plugin]);
  });
});
