import { describe, expect, it } from "vitest";

import { listCompatibleStudioPlugins, listStudioPlugins } from "../src/lib/studio/plugins/registry";

const midiQuadFormatHash = "0xfb01a34414c7cfd27fe4658f53b5b39361da407b46848efac553fd2d8ad9b411";
const fullScoreFormatHash = "0x637d49f0ec85ec68c9abfedb750881d641ebab0bbbe046db6341b128edc42dae";

describe("studio plugin registry", () => {
  it("keeps the midi plugin available as an in-app Studio plugin", () => {
    expect(listStudioPlugins().map((plugin) => plugin.id)).toContain("midi-clip-export-v1");
    expect(listStudioPlugins().map((plugin) => plugin.id)).toContain("music-score-v1");
  });

  it("matches music plugins by normalized format hash", () => {
    expect(
      listCompatibleStudioPlugins(midiQuadFormatHash.toUpperCase()).map((plugin) => plugin.id),
    ).toEqual(["midi-clip-export-v1", "music-score-v1"]);
  });

  it("matches the Music Score plugin for layered score templates", () => {
    expect(
      listCompatibleStudioPlugins(fullScoreFormatHash.toUpperCase()).map((plugin) => plugin.id),
    ).toEqual(["music-score-v1"]);
  });

  it("does not expose the midi plugin for unknown formats", () => {
    expect(listCompatibleStudioPlugins("0x1234")).toEqual([]);
    expect(listCompatibleStudioPlugins(null)).toEqual([]);
  });
});
