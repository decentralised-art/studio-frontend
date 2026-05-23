import { describe, expect, it } from "vitest";

import { MIDI_CLIP_WORLD, MUSICXML_SCORE_WORLD, TONE_WORLD } from "../src/lib/worlds/registry";

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

  it("declares scalar value limits for every Tone World accepted scalar", () => {
    const limits = TONE_WORLD.valueLimits?.scalarValues ?? {};

    TONE_WORLD.acceptedScalars?.forEach((scalar) => {
      const limit = limits[scalar];
      expect(limit, scalar).toBeDefined();
      if (!limit) return;
      expect(limit.min, scalar).toBeLessThanOrEqual(limit.max);
    });
  });

  it("requires the full Tone World artwork-control scalar set", () => {
    const audioLayer = [
      "onset_tick",
      "duration_tick",
      "pitch_midi",
      "velocity_midi",
      "tone_sample_set",
      "tone_sample_index",
    ];
    const visualLayer = [
      "tone_visual_variant",
      "tone_color_r",
      "tone_color_g",
      "tone_color_b",
      "tone_shape_sides",
      "tone_reactivity",
    ];
    expect(TONE_WORLD.requiredScalars).toEqual([...audioLayer, ...visualLayer]);
    expect(TONE_WORLD.requiredScalarSets).toEqual([
      {
        id: "tone-world-full",
        label: "Audio + visual layer",
        scalars: [...audioLayer, ...visualLayer],
      },
      { id: "tone-world-audio", label: "Audio layer", scalars: audioLayer },
      { id: "tone-world-visual", label: "Visual layer", scalars: visualLayer },
    ]);
    expect(TONE_WORLD.acceptedScalars).toEqual(
      expect.arrayContaining(TONE_WORLD.requiredScalars ?? []),
    );
  });
});
