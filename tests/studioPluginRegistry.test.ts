import { describe, expect, it } from "vitest";

import {
  listCompatibleStudioPlugins,
  listStudioPlugins,
  listStudioWorldPlugins,
  studioPluginFromWorldDescriptor,
  studioPluginIdForWorld,
} from "../src/lib/studio/plugins/registry";
import { TONE_WORLD } from "../src/lib/worlds/registry";
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
  it("lists only current API Worlds and keeps retired built-ins out of the catalog", () => {
    expect(listStudioPlugins()).toEqual([]);
    expect(listStudioPlugins([backendWorld, TONE_WORLD]).map((plugin) => plugin.id)).toEqual([
      "world:backend-world-1",
    ]);
  });

  it("matches the API World's normalized format hash", () => {
    expect(
      listCompatibleStudioPlugins(midiQuadFormatHash.toUpperCase(), [backendWorld]).map(
        (plugin) => plugin.id,
      ),
    ).toEqual(["world:backend-world-1"]);
    expect(listCompatibleStudioPlugins(fullScoreFormatHash, [backendWorld])).toEqual([]);
    expect(listCompatibleStudioPlugins("0x1234", [backendWorld])).toEqual([]);
    expect(listCompatibleStudioPlugins(null, [backendWorld])).toEqual([]);
  });

  it("does not advertise deleted Worlds or Worlds without a Studio surface", () => {
    const deleted = {
      ...backendWorld,
      backend: { ...backendWorld.backend!, status: "deleted" as const },
    };
    const galleryOnly = { ...backendWorld, surfaces: ["world-page" as const] };
    expect(listStudioPlugins([deleted, galleryOnly])).toEqual([]);
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
