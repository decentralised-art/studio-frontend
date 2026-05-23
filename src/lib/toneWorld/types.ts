export const TONE_WORLD_ROW_SIZE = 12;
export const TONE_WORLD_PART_COUNT = 3;
export const TONE_WORLD_MAX_VOICES = 12;
export const TONE_WORLD_MIN_MACRO_DURATION_SECONDS = 60;
export const TONE_WORLD_MAX_MACRO_DURATION_SECONDS = 200;

export const TONE_WORLD_SHARED_ACCEPTED_SCALARS = [
  "onset_tick",
  "duration_tick",
  "pitch_midi",
  "event_id",
  "part",
  "staff",
  "voice",
  "velocity_midi",
  "dynamic_code",
  "note_kind",
  "accidental_code",
  "stem_code",
  "beam_group",
  "meter_time_tick",
  "meter_beats",
  "meter_beat_type",
  "staff_count",
  "part_name_code",
  "instrument_code",
  "clef_time_tick",
  "clef_part",
  "clef_staff",
  "clef_sign_code",
  "clef_line",
  "tempo_time_tick",
  "tempo_bpm",
  "key_time_tick",
  "key_fifths",
  "key_mode_code",
  "key_part",
  "articulation_event_id",
  "articulation_code",
  "articulation_placement",
  "slur_event_id",
  "slur_number",
  "slur_type",
  "slur_placement",
  "spanner_kind",
] as const;

export const TONE_WORLD_AUDIO_REQUIRED_SCALARS = [
  "onset_tick",
  "duration_tick",
  "pitch_midi",
  "velocity_midi",
  "tone_sample_set",
  "tone_sample_index",
] as const;

export const TONE_WORLD_VISUAL_REQUIRED_SCALARS = [
  "tone_visual_variant",
  "tone_color_r",
  "tone_color_g",
  "tone_color_b",
  "tone_shape_sides",
  "tone_reactivity",
] as const;

export const TONE_WORLD_REQUIRED_SCALARS = [
  ...TONE_WORLD_AUDIO_REQUIRED_SCALARS,
  ...TONE_WORLD_VISUAL_REQUIRED_SCALARS,
] as const;

export const TONE_WORLD_REQUIRED_SCALAR_SETS = [
  {
    id: "tone-world-full",
    label: "Audio + visual layer",
    scalars: [...TONE_WORLD_REQUIRED_SCALARS],
  },
  {
    id: "tone-world-audio",
    label: "Audio layer",
    scalars: [...TONE_WORLD_AUDIO_REQUIRED_SCALARS],
  },
  {
    id: "tone-world-visual",
    label: "Visual layer",
    scalars: [...TONE_WORLD_VISUAL_REQUIRED_SCALARS],
  },
] as const;

export const TONE_WORLD_ACCEPTED_SCALARS = [
  ...TONE_WORLD_SHARED_ACCEPTED_SCALARS,
  "tone_duration_second",
  "tone_rhythm_duration_second",
  "tone_rhythm_distance_second",
  "tone_sample_set",
  "tone_sample_index",
  "tone_velocity",
  "tone_control_value",
  "tone_control_time_second",
  "tone_visual_material",
  "tone_image_index",
  "tone_visual_variant",
  "tone_color_r",
  "tone_color_g",
  "tone_color_b",
  "tone_shape_sides",
  "tone_reactivity",
] as const;

export type ToneWorldScalar = (typeof TONE_WORLD_ACCEPTED_SCALARS)[number];

export type ToneWorldStream = {
  path: string;
  data: number[];
};

export type ToneWorldMaterialStream = ToneWorldStream & {
  scalar: ToneWorldScalar;
};

export type ToneWorldMaterials = {
  onsetTick: ToneWorldMaterialStream[];
  durationTick: ToneWorldMaterialStream[];
  pitchMidi: ToneWorldMaterialStream[];
  durationSecond: ToneWorldMaterialStream[];
  rhythmDurationSecond: ToneWorldMaterialStream[];
  rhythmDistanceSecond: ToneWorldMaterialStream[];
  sampleSet: ToneWorldMaterialStream[];
  sampleIndex: ToneWorldMaterialStream[];
  velocity: ToneWorldMaterialStream[];
  tempoBpm: ToneWorldMaterialStream[];
  controlValue: ToneWorldMaterialStream[];
  controlTimeSecond: ToneWorldMaterialStream[];
  visualMaterial: ToneWorldMaterialStream[];
  imageIndex: ToneWorldMaterialStream[];
  visualVariant: ToneWorldMaterialStream[];
  colorR: ToneWorldMaterialStream[];
  colorG: ToneWorldMaterialStream[];
  colorB: ToneWorldMaterialStream[];
  shapeSides: ToneWorldMaterialStream[];
  reactivity: ToneWorldMaterialStream[];
};

export type ToneAddress = {
  seed: number;
  sampleSet: number;
  pitchPoolHz: number[];
  pitchPoolsHz: number[][];
  durationBag: number[];
  durationPools: number[][];
  macroDurationSeconds: number | null;
  loudnessBag: number[];
  pitchPermutation: number[];
  samplePermutation: number[];
  sampleSets: number[];
  durationOrder: number[];
  partVoiceCounts: number[];
  voiceStarts: number[];
  voiceLengths: number[];
  imageIndex: number;
  colors: [number, number, number];
  visualNumber: number;
  visualShape: number;
  visualSetting1: number;
  visualSetting2: number;
  visualSetting3: number;
  bigNumber: number;
  rotate: number;
  invert: boolean;
  visualSet: number;
  visualVariant: number;
  controlValues: number[];
  controlTimes: number[];
  reactivity: number;
};

export type ToneWorldNote = {
  time: number;
  duration: number;
  frequency: number;
  sample: number;
  sampleSet: number;
  velocity: number;
  rowPosition: number;
  part: number;
  voice: number;
};

export type ToneWorldComposition = {
  notes: ToneWorldNote[];
  duration: number;
  rowFrequencies: number[];
  rowFrequencyGroups: number[][];
  statsText: string;
};
