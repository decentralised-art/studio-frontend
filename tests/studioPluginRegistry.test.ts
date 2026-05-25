import { describe, expect, it } from "vitest";

import {
  listCompatibleStudioPlugins,
  listStudioPlugins,
  TONE_WORLD_PLUGIN_ID,
} from "../src/lib/studio/plugins/registry";
import { FIRST_PARTY_WORLDS, MIDI_CLIP_WORLD_ID, TONE_WORLD } from "../src/lib/worlds/registry";

const midiQuadFormatHash = "0xfb01a34414c7cfd27fe4658f53b5b39361da407b46848efac553fd2d8ad9b411";
const fullScoreFormatHash = "0x637d49f0ec85ec68c9abfedb750881d641ebab0bbbe046db6341b128edc42dae";

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
});
