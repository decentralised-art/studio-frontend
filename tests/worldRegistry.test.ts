import { describe, expect, it } from "vitest";

import { MIDI_CLIP_WORLD, MUSICXML_SCORE_WORLD } from "../src/lib/worlds/registry";

describe("world registry", () => {
  it("declares scalar value limits for every MusicXML accepted scalar", () => {
    const limits = MUSICXML_SCORE_WORLD.valueLimits?.scalarValues ?? {};

    MUSICXML_SCORE_WORLD.acceptedScalars?.forEach((scalar) => {
      const limit = limits[scalar];
      expect(limit, scalar).toBeDefined();
      if (!limit) return;
      expect(limit.min, scalar).toBeLessThanOrEqual(limit.max);
    });
  });

  it("declares scalar value limits for every MIDI accepted scalar", () => {
    const limits = MIDI_CLIP_WORLD.valueLimits?.scalarValues ?? {};

    MIDI_CLIP_WORLD.acceptedScalars?.forEach((scalar) => {
      const limit = limits[scalar];
      expect(limit, scalar).toBeDefined();
      if (!limit) return;
      expect(limit.min, scalar).toBeLessThanOrEqual(limit.max);
    });
  });
});
