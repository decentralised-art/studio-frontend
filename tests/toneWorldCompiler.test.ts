import { describe, expect, it } from "vitest";

import {
  compileToneAddressFromStreams,
  composeToneWorld,
  getMissingRequiredToneWorldScalarsFromStreams,
  getToneControlValueAtTime,
  getToneWorldLayerCompatibilityFromStreams,
  hasRequiredToneWorldScalarsFromStreams,
  midiToFrequency,
  parseToneWorldMaterials,
  TONE_ROW_SAMPLE_REGISTER_BASE_MIDI,
  TONE_ROW_SAMPLE_REGISTER_TOP_MIDI,
  TONE_WORLD_MAX_MACRO_DURATION_SECONDS,
  TONE_WORLD_MIN_MACRO_DURATION_SECONDS,
  TONE_WORLD_REQUIRED_SCALARS,
} from "../src/lib/toneWorld";

const isOctaveEquivalent = (frequency: number, base: number) => {
  const octaves = Math.log2(frequency / base);
  return Math.abs(octaves - Math.round(octaves)) < 0.000001;
};

describe("Tone World material compiler", () => {
  it("parses Tone material streams by terminal scalar name", () => {
    const materials = parseToneWorldMaterials([
      { path: "/root/rhythm/tone_duration_second:0", data: [1, 2] },
      { path: "/root/timbre/tone_sample_set:0", data: [2] },
      { path: "/root/ignored/pitch:0", data: [72] },
    ]);

    expect(materials.durationSecond).toHaveLength(1);
    expect(materials.sampleSet).toHaveLength(1);
    expect(materials.pitchMidi).toEqual([]);
  });

  it("parses shared MusicXML-style terminal scalars as Tone material", () => {
    const materials = parseToneWorldMaterials([
      { path: "/score/notes/onset_tick:0", data: [0, 2520, 5040] },
      { path: "/score/notes/duration_tick:0", data: [2520, 1260, 2520] },
      { path: "/score/notes/pitch_midi:0", data: [60, 62, 64] },
      { path: "/score/notes/velocity_midi:0", data: [127, 64, 32] },
      { path: "/score/tempo/tempo_bpm:0", data: [90] },
    ]);

    expect(materials.onsetTick).toHaveLength(1);
    expect(materials.durationTick).toHaveLength(1);
    expect(materials.pitchMidi).toHaveLength(1);
    expect(materials.velocity).toHaveLength(1);
    expect(materials.tempoBpm).toHaveLength(1);
  });

  it("recognizes audio-only, visual-only, and full Tone World connector layers", () => {
    const audioOnly = [
      { path: "/score/notes/onset_tick:0", data: [0, 2520] },
      { path: "/score/notes/duration_tick:0", data: [2520, 2520] },
      { path: "/score/notes/pitch_midi:0", data: [60, 62] },
      { path: "/score/notes/velocity_midi:0", data: [127, 96] },
      { path: "/score/timbre/tone_sample_set:0", data: [2] },
      { path: "/score/timbre/tone_sample_index:0", data: [1, 2] },
    ];
    const visualOnly = [
      { path: "/score/visual/tone_visual_variant:0", data: [1] },
      { path: "/score/visual/tone_color_r:0", data: [1.2] },
      { path: "/score/visual/tone_color_g:0", data: [1.1] },
      { path: "/score/visual/tone_color_b:0", data: [0.5] },
      { path: "/score/visual/tone_shape_sides:0", data: [5] },
      { path: "/score/visual/tone_reactivity:0", data: [2] },
    ];
    const complete = [...audioOnly, ...visualOnly];
    const partial = [{ path: "/score/timbre/tone_sample_set:0", data: [2] }];

    expect(getToneWorldLayerCompatibilityFromStreams(audioOnly)).toMatchObject({
      hasAudioLayer: true,
      hasVisualLayer: false,
      hasAnyLayer: true,
    });
    expect(getToneWorldLayerCompatibilityFromStreams(visualOnly)).toMatchObject({
      hasAudioLayer: false,
      hasVisualLayer: true,
      hasAnyLayer: true,
    });
    expect(getToneWorldLayerCompatibilityFromStreams(complete)).toMatchObject({
      hasAudioLayer: true,
      hasVisualLayer: true,
      hasAnyLayer: true,
    });
    expect(getToneWorldLayerCompatibilityFromStreams(partial).hasAnyLayer).toBe(false);
    expect(hasRequiredToneWorldScalarsFromStreams(complete)).toBe(true);
    expect(hasRequiredToneWorldScalarsFromStreams(audioOnly)).toBe(false);
    expect(hasRequiredToneWorldScalarsFromStreams(visualOnly)).toBe(false);
    expect(hasRequiredToneWorldScalarsFromStreams(partial)).toBe(false);
    expect(getMissingRequiredToneWorldScalarsFromStreams(partial)).toEqual(
      TONE_WORLD_REQUIRED_SCALARS.filter((scalar) => scalar !== "tone_sample_set"),
    );
  });

  it("uses user-supplied pitch material as the composition pitch world", () => {
    const address = compileToneAddressFromStreams(
      [{ path: "/root/scale/pitch_midi:0", data: [60, 64, 67] }],
      1234,
    );
    const composition = composeToneWorld(address);

    const sourceFrequencies = [midiToFrequency(60), midiToFrequency(64), midiToFrequency(67)];

    expect(
      composition.rowFrequencies.every((frequency) =>
        sourceFrequencies.some((source) => isOctaveEquivalent(frequency, source)),
      ),
    ).toBe(true);
    expect(composition.notes.length).toBeGreaterThan(0);
  });

  it("folds MIDI pitch material into the original Tone Row sample register", () => {
    const address = compileToneAddressFromStreams(
      [{ path: "/root/scale/pitch_midi:0", data: [96] }],
      1234,
    );
    const composition = composeToneWorld(address);
    const lowestToneRowFrequency = midiToFrequency(TONE_ROW_SAMPLE_REGISTER_BASE_MIDI);
    const topToneRowFrequency = midiToFrequency(TONE_ROW_SAMPLE_REGISTER_TOP_MIDI);

    expect(Math.min(...composition.rowFrequencies)).toBeGreaterThanOrEqual(lowestToneRowFrequency);
    expect(Math.max(...composition.rowFrequencies)).toBeLessThan(topToneRowFrequency);
    expect(new Set(composition.rowFrequencies.map((frequency) => frequency.toFixed(6)))).toEqual(
      new Set([lowestToneRowFrequency.toFixed(6)]),
    );
  });

  it("uses separate pitch material groups as part-scale sources", () => {
    const address = compileToneAddressFromStreams(
      [
        { path: "/root/scale_a/pitch_midi:0", data: [60, 62, 64, 65, 67, 69, 71] },
        { path: "/root/scale_b/pitch_midi:0", data: [72, 74, 76, 77, 79, 81, 83] },
      ],
      1234,
    );
    const composition = composeToneWorld(address);
    const firstScale = [60, 62, 64, 65, 67, 69, 71].map(midiToFrequency);
    const secondScale = [72, 74, 76, 77, 79, 81, 83].map(midiToFrequency);

    expect(address.pitchPoolsHz).toHaveLength(2);
    expect(
      composition.rowFrequencyGroups[0]?.every((frequency) =>
        firstScale.some((source) => isOctaveEquivalent(frequency, source)),
      ),
    ).toBe(true);
    expect(
      composition.rowFrequencyGroups[1]?.every((frequency) =>
        secondScale.some((source) => isOctaveEquivalent(frequency, source)),
      ),
    ).toBe(true);
  });

  it("cycles short rhythm material into the 12-position duration bag", () => {
    const address = compileToneAddressFromStreams(
      [{ path: "/root/rhythm/tone_duration_second:0", data: [1, 2, 3] }],
      7,
    );

    expect(address.durationBag).toEqual([1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3]);
  });

  it("converts shared score ticks to Tone World seconds", () => {
    const address = compileToneAddressFromStreams(
      [
        { path: "/score/notes/pitch_midi:0", data: [60, 64] },
        { path: "/score/notes/duration_tick:0", data: [2520, 1260] },
        { path: "/score/tempo/tempo_bpm:0", data: [120] },
      ],
      7,
    );

    expect(address.durationBag.slice(0, 4)).toEqual([0.5, 0.25, 0.5, 0.25]);
  });

  it("stretches score-tick rhythm material into the original Tone Row duration range", () => {
    const address = compileToneAddressFromStreams(
      [
        { path: "/score/notes/pitch_midi:0", data: [60, 64] },
        { path: "/score/notes/duration_tick:0", data: [2520, 1260] },
        { path: "/score/tempo/tempo_bpm:0", data: [120] },
      ],
      7,
    );
    const composition = composeToneWorld(address);

    expect(address.macroDurationSeconds).toBeGreaterThanOrEqual(
      TONE_WORLD_MIN_MACRO_DURATION_SECONDS,
    );
    expect(address.macroDurationSeconds).toBeLessThanOrEqual(TONE_WORLD_MAX_MACRO_DURATION_SECONDS);
    expect(composition.duration).toBe(address.macroDurationSeconds);
    expect(composition.notes[0]?.duration).toBeGreaterThan(address.durationBag[0]);
  });

  it("does not stretch explicit second-based duration material", () => {
    const address = compileToneAddressFromStreams(
      [
        { path: "/root/scale/pitch_midi:0", data: [60] },
        { path: "/root/rhythm/tone_duration_second:0", data: [0.1] },
      ],
      7,
    );
    const composition = composeToneWorld(address);

    expect(address.macroDurationSeconds).toBeNull();
    expect(composition.duration).toBeLessThan(TONE_WORLD_MIN_MACRO_DURATION_SECONDS);
  });

  it("uses onset ticks as rhythm distances when explicit durations are absent", () => {
    const address = compileToneAddressFromStreams(
      [
        { path: "/score/notes/onset_tick:0", data: [0, 2520, 5040, 7560] },
        { path: "/score/tempo/tempo_bpm:0", data: [60] },
      ],
      7,
    );

    expect(address.durationBag.slice(0, 3)).toEqual([1, 1, 1]);
  });

  it("wraps stable sample-set selectors into the available sample banks", () => {
    const address = compileToneAddressFromStreams(
      [{ path: "/root/timbre/tone_sample_set:0", data: [8] }],
      7,
    );

    expect(address.sampleSet).toBe(3);
  });

  it("maps time-changing sample-set selectors onto composed parts", () => {
    const address = compileToneAddressFromStreams(
      [
        { path: "/root/scale/pitch_midi:0", data: [60, 64, 67] },
        { path: "/root/timbre/tone_sample_set:0", data: [1, 3, 5] },
      ],
      7,
    );
    const composition = composeToneWorld(address);

    expect(address.sampleSets).toEqual([1, 3, 5]);
    expect(new Set(composition.notes.map((note) => note.sampleSet))).toEqual(new Set([1, 3, 5]));
  });

  it("uses visual variant as the original Tone Row visual family selector", () => {
    const address = compileToneAddressFromStreams(
      [
        { path: "/root/timbre/tone_sample_set:0", data: [1] },
        { path: "/root/visual/tone_visual_variant:0", data: [5] },
      ],
      7,
    );

    expect(address.sampleSet).toBe(1);
    expect(address.visualSet).toBe(5);
  });

  it("accepts explicit sample and velocity materials without making final notes literal", () => {
    const address = compileToneAddressFromStreams(
      [
        { path: "/root/timbre/tone_sample_index:0", data: [12, 1] },
        { path: "/root/dynamics/tone_velocity:0", data: [127, 32] },
      ],
      7,
    );

    expect(address.samplePermutation.slice(0, 4)).toEqual([12, 1, 12, 1]);
    expect(address.loudnessBag.slice(0, 4)).toEqual([1, 32 / 127, 1, 32 / 127]);
  });

  it("interprets stable and changing control connectors over linear time", () => {
    const stable = compileToneAddressFromStreams(
      [{ path: "/root/control/tone_control_value:0", data: [4, 4, 4] }],
      99,
    );
    const changing = compileToneAddressFromStreams(
      [
        { path: "/root/control/tone_control_time_second:0", data: [0, 10, 20] },
        { path: "/root/control/tone_control_value:0", data: [1, 5, 9] },
      ],
      99,
    );

    expect(getToneControlValueAtTime(stable, 100, 0)).toBe(4);
    expect(getToneControlValueAtTime(changing, 15, 0)).toBe(5);
    expect(getToneControlValueAtTime(changing, 15, 0, "linear")).toBe(7);
  });

  it("does not compose fallback audio without pitch_midi material", () => {
    const first = composeToneWorld(compileToneAddressFromStreams([], 99));
    const second = composeToneWorld(compileToneAddressFromStreams([], 99));

    expect(first.notes).toEqual([]);
    expect(first.duration).toBe(0);
    expect(first.rowFrequencies).toEqual([]);
    expect(first.notes).toEqual(second.notes);
    expect(first.statsText).toEqual(second.statsText);
  });
});
