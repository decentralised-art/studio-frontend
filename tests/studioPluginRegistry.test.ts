import { describe, expect, it } from "vitest";

import { listCompatibleStudioPlugins, listStudioPlugins } from "../src/lib/studio/plugins/registry";

const midiQuadFormatHash = "0xfb01a34414c7cfd27fe4658f53b5b39361da407b46848efac553fd2d8ad9b411";

describe("studio plugin registry", () => {
  it("keeps the midi plugin available as an in-app Studio plugin", () => {
    expect(listStudioPlugins().map((plugin) => plugin.id)).toContain("midi-clip-export-v1");
  });

  it("matches the midi plugin by normalized format hash", () => {
    expect(
      listCompatibleStudioPlugins(midiQuadFormatHash.toUpperCase()).map((plugin) => plugin.id),
    ).toEqual(["midi-clip-export-v1"]);
  });

  it("does not expose the midi plugin for unknown formats", () => {
    expect(listCompatibleStudioPlugins("0x1234")).toEqual([]);
    expect(listCompatibleStudioPlugins(null)).toEqual([]);
  });
});
