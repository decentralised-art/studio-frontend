import { describe, expect, it } from "vitest";

import type { BackendWorldDescriptor } from "../src/lib/worlds/contract";
import {
  loadWorldRegistry,
  mergeWorldDescriptors,
  MIDI_CLIP_WORLD,
  MUSICXML_SCORE_WORLD,
  MUSICXML_SCORE_WORLD_SLUG,
  resolveWorldBySlugOrId,
  TONE_WORLD,
} from "../src/lib/worlds/registry";

const backendWorld = (overrides: Partial<BackendWorldDescriptor> = {}): BackendWorldDescriptor => ({
  id: "backend-world-1",
  slug: "backend-world",
  name: "Backend World",
  version: "0.1.0",
  entryUrn: "/world-assets/backend-world-1/index.html",
  runtime: "iframe",
  surfaces: ["world-page"],
  permissions: ["dcn.execute"],
  description: "A backend-hosted world.",
  acceptedFormatHashes: [],
  acceptedConnectorSets: [{ connectors: ["pitch"], optionalConnectors: [] }],
  ownerId: "user-1",
  bundleHash: "a".repeat(64),
  manifestHash: "b".repeat(64),
  entryPath: "index.html",
  status: "active",
  createdAt: "2026-06-17T12:00:00Z",
  updatedAt: "2026-06-17T12:00:00Z",
  ...overrides,
});

describe("world registry", () => {
  it("marks bundled worlds as first-party descriptors", () => {
    expect(MUSICXML_SCORE_WORLD.source).toBe("first-party");
    expect(MIDI_CLIP_WORLD.source).toBe("first-party");
    expect(TONE_WORLD.source).toBe("first-party");
  });

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

  it("merges backend worlds after first-party fallback worlds", () => {
    const merged = mergeWorldDescriptors({
      firstPartyWorlds: [MUSICXML_SCORE_WORLD],
      backendWorlds: [backendWorld()],
    });

    expect(merged.map((world) => world.slug)).toEqual(["musicxml-score", "backend-world"]);
    expect(merged[1]?.source).toBe("backend");
    expect(merged[1]?.entry).toBe("/world-assets/backend-world-1/index.html");
  });

  it("prefers backend worlds when slugs collide with first-party worlds", () => {
    const merged = mergeWorldDescriptors({
      firstPartyWorlds: [MUSICXML_SCORE_WORLD, MIDI_CLIP_WORLD],
      backendWorlds: [
        backendWorld({
          id: "backend-score",
          slug: MUSICXML_SCORE_WORLD_SLUG,
          name: "Backend Score World",
          entryUrn: "/world-assets/backend-score/index.html",
        }),
      ],
    });

    expect(merged).toHaveLength(2);
    expect(merged[0]?.source).toBe("backend");
    expect(merged[0]?.id).toBe("backend-score");
    expect(merged[0]?.name).toBe("Backend Score World");
    expect(merged[1]?.id).toBe(MIDI_CLIP_WORLD.id);
  });

  it("does not keep stale first-party slug aliases after backend id replacements", () => {
    const merged = mergeWorldDescriptors({
      firstPartyWorlds: [MUSICXML_SCORE_WORLD, MIDI_CLIP_WORLD],
      backendWorlds: [
        backendWorld({
          id: MUSICXML_SCORE_WORLD.id,
          slug: "backend-renamed-score",
          name: "Backend Renamed Score",
          entryUrn: "/world-assets/backend-renamed-score/index.html",
        }),
        backendWorld({
          id: "backend-score-by-slug",
          slug: MUSICXML_SCORE_WORLD_SLUG,
          name: "Backend Score By Slug",
          entryUrn: "/world-assets/backend-score-by-slug/index.html",
        }),
      ],
    });

    expect(merged.map((world) => world.slug)).toEqual([
      "backend-renamed-score",
      "midi-clip",
      MUSICXML_SCORE_WORLD_SLUG,
    ]);
    expect(merged.map((world) => world.id)).toEqual([
      MUSICXML_SCORE_WORLD.id,
      MIDI_CLIP_WORLD.id,
      "backend-score-by-slug",
    ]);
  });

  it("resolves worlds by slug or id", () => {
    const merged = mergeWorldDescriptors({
      firstPartyWorlds: [MUSICXML_SCORE_WORLD],
      backendWorlds: [backendWorld()],
    });

    expect(resolveWorldBySlugOrId(merged, "backend-world")?.id).toBe("backend-world-1");
    expect(resolveWorldBySlugOrId(merged, "backend-world-1")?.slug).toBe("backend-world");
    expect(resolveWorldBySlugOrId(merged, "missing")).toBeUndefined();
  });

  it("loads backend worlds through the registry loader", async () => {
    const fetchBackendWorlds = async () => [backendWorld()];

    const result = await loadWorldRegistry({
      firstPartyWorlds: [MUSICXML_SCORE_WORLD],
      fetchBackendWorlds,
      surface: "world-page",
    });

    expect(result.backendError).toBeNull();
    expect(result.usedFirstPartyFallback).toBe(false);
    expect(result.backendWorlds).toHaveLength(1);
    expect(result.worlds.map((world) => world.slug)).toEqual(["musicxml-score", "backend-world"]);
  });

  it("falls back to first-party worlds when backend loading fails", async () => {
    const error = new Error("backend offline");

    const result = await loadWorldRegistry({
      firstPartyWorlds: [MUSICXML_SCORE_WORLD],
      fetchBackendWorlds: async () => {
        throw error;
      },
    });

    expect(result.worlds).toEqual([MUSICXML_SCORE_WORLD]);
    expect(result.backendWorlds).toEqual([]);
    expect(result.backendError).toBe(error);
    expect(result.usedFirstPartyFallback).toBe(true);
  });
});
