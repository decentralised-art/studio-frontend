import { MUSIC_SCORE_PLUGIN_ID } from "$lib/score/codebook";
import type { ScorePluginRuntimeData } from "$lib/score/types";
import { MIDI_CLIP_PLUGIN_ID, MIDI_QUAD_FORMAT_HASH } from "$lib/studio/plugins/registry";
import type { StudioPluginRuntimeData } from "$lib/studio/plugins/runtime";
import {
  TONE_WORLD_ACCEPTED_SCALARS,
  TONE_WORLD_REQUIRED_SCALARS,
  TONE_WORLD_REQUIRED_SCALAR_SETS,
} from "$lib/toneWorld";
import { WORLD_PROTOCOL_VERSION, type WorldDescriptor, type WorldRuntimeInput } from "./types";

export const MUSICXML_SCORE_WORLD_ID = "world.musicxml-score";
export const MUSICXML_SCORE_WORLD_SLUG = "musicxml-score";
export const MUSICXML_SCORE_WORLD_ENTRY = "/world-runtimes/musicxml-score";
export const MIDI_CLIP_WORLD_ID = "world.midi-clip";
export const MIDI_CLIP_WORLD_SLUG = "midi-clip";
export const MIDI_CLIP_WORLD_ENTRY = "/world-runtimes/midi-clip";
export const TONE_WORLD_ID = "world.tone-world";
export const TONE_WORLD_SLUG = "tone-world";
export const TONE_WORLD_ENTRY = "/world-runtimes/tone-world";

export const MUSICXML_SCORE_WORLD_REQUIRED_SCALARS = [
  "onset_tick",
  "duration_tick",
  "pitch_midi",
] as const;

export const MUSICXML_SCORE_WORLD_ACCEPTED_SCALARS = [
  ...MUSICXML_SCORE_WORLD_REQUIRED_SCALARS,
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

export const MUSICXML_SCORE_WORLD_VALUE_LIMITS = {
  particlesCount: { min: 1, max: 64 },
  scalarValues: {
    onset_tick: { min: 0, max: 1_000_000 },
    duration_tick: { min: 1, max: 1_000_000 },
    pitch_midi: { min: 0, max: 127 },
    event_id: { min: 0, max: 1_000_000 },
    part: { min: 1, max: 16 },
    staff: { min: 1, max: 8 },
    voice: { min: 1, max: 16 },
    velocity_midi: { min: 0, max: 127 },
    dynamic_code: { min: 0, max: 7 },
    note_kind: { min: 0, max: 8 },
    accidental_code: { min: 0, max: 12 },
    stem_code: { min: 0, max: 2 },
    beam_group: { min: 0, max: 1024 },
    meter_time_tick: { min: 0, max: 1_000_000 },
    meter_beats: { min: 1, max: 32 },
    meter_beat_type: { min: 1, max: 128 },
    staff_count: { min: 1, max: 8 },
    part_name_code: { min: 0, max: 1_000_000 },
    instrument_code: { min: 0, max: 127 },
    clef_time_tick: { min: 0, max: 1_000_000 },
    clef_part: { min: 1, max: 16 },
    clef_staff: { min: 1, max: 8 },
    clef_sign_code: { min: 0, max: 3 },
    clef_line: { min: 1, max: 5 },
    tempo_time_tick: { min: 0, max: 1_000_000 },
    tempo_bpm: { min: 10, max: 300 },
    key_time_tick: { min: 0, max: 1_000_000 },
    key_fifths: { min: -7, max: 7 },
    key_mode_code: { min: 0, max: 9 },
    key_part: { min: 1, max: 16 },
    articulation_event_id: { min: 0, max: 1_000_000 },
    articulation_code: { min: 0, max: 3 },
    articulation_placement: { min: 0, max: 1 },
    slur_event_id: { min: 0, max: 1_000_000 },
    slur_number: { min: 1, max: 16 },
    slur_type: { min: 0, max: 3 },
    slur_placement: { min: 0, max: 1 },
    spanner_kind: { min: 0, max: 16 },
  },
} as const;

export const MUSICXML_SCORE_WORLD: WorldDescriptor = {
  id: MUSICXML_SCORE_WORLD_ID,
  slug: MUSICXML_SCORE_WORLD_SLUG,
  name: "MusicXML Score World",
  version: "0.1.0",
  entry: MUSICXML_SCORE_WORLD_ENTRY,
  runtime: "iframe",
  acceptedPluginIds: [MUSIC_SCORE_PLUGIN_ID],
  acceptedScalars: [...MUSICXML_SCORE_WORLD_ACCEPTED_SCALARS],
  requiredScalars: [...MUSICXML_SCORE_WORLD_REQUIRED_SCALARS],
  surfaces: ["world-page", "studio-plugin"],
  description:
    "Renders compatible connector/RIs states as MusicXML notation through a sandboxed OSMD runtime.",
  shortDescription:
    "A notation world for connector output that can be interpreted as MusicXML score material.",
  heroLabel: "MusicXML",
  accentColor: "#67d6ff",
  valueLimits: MUSICXML_SCORE_WORLD_VALUE_LIMITS,
  stats: [
    { label: "Runtime", value: "OSMD" },
    { label: "Format", value: "MusicXML 4.0" },
    { label: "Mode", value: "Connector/RIs" },
  ],
};

export const MIDI_CLIP_WORLD_REQUIRED_SCALARS = ["pitch", "time", "duration", "velocity"] as const;
export const MIDI_CLIP_WORLD_ACCEPTED_SCALARS = [...MIDI_CLIP_WORLD_REQUIRED_SCALARS] as const;

export const MIDI_CLIP_WORLD_VALUE_LIMITS = {
  particlesCount: { min: 1, max: 64 },
  scalarValues: {
    pitch: { min: 0, max: 127 },
    time: { min: 0, max: 1_000_000 },
    duration: { min: 0.0001, max: 1_000_000 },
    velocity: { min: 0, max: 127 },
  },
} as const;

export const MIDI_CLIP_WORLD: WorldDescriptor = {
  id: MIDI_CLIP_WORLD_ID,
  slug: MIDI_CLIP_WORLD_SLUG,
  name: "MIDI World",
  version: "0.1.0",
  entry: MIDI_CLIP_WORLD_ENTRY,
  runtime: "iframe",
  acceptedPluginIds: [MIDI_CLIP_PLUGIN_ID],
  acceptedFormatHashes: [MIDI_QUAD_FORMAT_HASH],
  acceptedScalars: [...MIDI_CLIP_WORLD_ACCEPTED_SCALARS],
  requiredScalars: [...MIDI_CLIP_WORLD_REQUIRED_SCALARS],
  surfaces: ["world-page", "studio-plugin"],
  description:
    "Renders compatible connector/RIs states as a MIDI piano-roll world with browser-local MIDI export.",
  shortDescription:
    "A MIDI world for connector output that can be interpreted as pitch, time, duration, and velocity streams.",
  heroLabel: "MIDI",
  accentColor: "#34d399",
  valueLimits: MIDI_CLIP_WORLD_VALUE_LIMITS,
  stats: [
    { label: "Runtime", value: "Piano Roll" },
    { label: "Format", value: "MIDI" },
    { label: "Mode", value: "Connector/RIs" },
  ],
};

export const TONE_WORLD_VALUE_LIMITS = {
  particlesCount: { min: 1, max: 96 },
  scalarValues: {
    ...MUSICXML_SCORE_WORLD_VALUE_LIMITS.scalarValues,
    tone_duration_second: { min: 0.05, max: 60 },
    tone_rhythm_duration_second: { min: 0.05, max: 60 },
    tone_rhythm_distance_second: { min: 0.05, max: 60 },
    tone_sample_set: { min: 1, max: 5 },
    tone_sample_index: { min: 1, max: 12 },
    tone_velocity: { min: 0, max: 127 },
    tone_control_value: { min: 0, max: 1_000_000 },
    tone_control_time_second: { min: 0, max: 1_000_000 },
    tone_visual_material: { min: 0, max: 1_000_000 },
    tone_image_index: { min: 0, max: 2 },
    tone_visual_variant: { min: 1, max: 5 },
    tone_color_r: { min: 0, max: 2.5 },
    tone_color_g: { min: 0, max: 2.5 },
    tone_color_b: { min: 0, max: 2.5 },
    tone_shape_sides: { min: 3, max: 9 },
    tone_reactivity: { min: 0, max: 8 },
  },
} as const;

export const TONE_WORLD_EXCLUDED_CONNECTORS = [
  "tone_world_audio_tristan_pulse",
  "tone_world_audio_tristan_pulse_v1",
] as const;

export const TONE_WORLD: WorldDescriptor = {
  id: TONE_WORLD_ID,
  slug: TONE_WORLD_SLUG,
  name: "Tone World",
  version: "0.1.0",
  entry: TONE_WORLD_ENTRY,
  runtime: "iframe",
  acceptedPluginIds: [],
  acceptedScalars: [...TONE_WORLD_ACCEPTED_SCALARS],
  excludedConnectorNames: [...TONE_WORLD_EXCLUDED_CONNECTORS],
  requiredScalars: [...TONE_WORLD_REQUIRED_SCALARS],
  requiredScalarSets: TONE_WORLD_REQUIRED_SCALAR_SETS.map((set) => ({
    id: set.id,
    label: set.label,
    scalars: [...set.scalars],
  })),
  surfaces: ["world-page", "studio-plugin"],
  description:
    "Recomposes Tone Row from connector-supplied pitch, rhythm, timbre, and control materials.",
  shortDescription:
    "A material-driven audiovisual world for scales, rhythms, timbre selectors, and time controls.",
  heroLabel: "Tone",
  accentColor: "#f59e0b",
  valueLimits: TONE_WORLD_VALUE_LIMITS,
  stats: [
    { label: "Runtime", value: "Tone.js" },
    { label: "Format", value: "Tone Material v1" },
    { label: "Mode", value: "Material Composer" },
  ],
};

export const FIRST_PARTY_WORLDS = [MUSICXML_SCORE_WORLD, MIDI_CLIP_WORLD, TONE_WORLD] as const;

export const findFirstPartyWorldBySlug = (slug: string | null | undefined) =>
  FIRST_PARTY_WORLDS.find((world) => world.slug === slug);

export const buildMusicXmlWorldInput = ({
  scoreData,
  label,
  surface,
  connectorTargets = [],
  particlesCount,
  dynamicRiInput,
  riCoordinate,
  selectedConnectorContextNames,
  selectedConnectorContextPathPrefixes,
}: {
  scoreData: ScorePluginRuntimeData;
  label: string;
  surface: WorldRuntimeInput["surface"];
  connectorTargets?: string[];
  particlesCount?: number;
  dynamicRiInput?: WorldRuntimeInput["dynamicRiInput"];
  riCoordinate?: WorldRuntimeInput["riCoordinate"];
  selectedConnectorContextNames?: string[];
  selectedConnectorContextPathPrefixes?: string[];
}): WorldRuntimeInput => {
  const { stats } = scoreData;
  return {
    protocolVersion: WORLD_PROTOCOL_VERSION,
    worldId: MUSICXML_SCORE_WORLD_ID,
    surface,
    label,
    connectorName: connectorTargets.join(" + ") || undefined,
    particlesCount: particlesCount ?? stats.streamCount,
    riCoordinate,
    dynamicRiInput,
    selectedConnectorContextNames,
    selectedConnectorContextPathPrefixes,
    artifacts: {
      musicXml: scoreData.musicXml,
      scoreRenderedNotes: scoreData.renderedNotes,
      scoreAdapterId: scoreData.adapterId,
      scoreStatsText: `${stats.noteCount} notes | ${stats.measureCount} measures | ${stats.partCount} parts | ${stats.adapterId}`,
    },
  };
};

export const buildMidiWorldInput = ({
  runtimeData,
  label,
  surface,
  particlesCount,
  dynamicRiInput,
  riCoordinate,
  statsText,
  selectedConnectorContextNames,
  selectedConnectorContextPathPrefixes,
}: {
  runtimeData: StudioPluginRuntimeData;
  label: string;
  surface: WorldRuntimeInput["surface"];
  particlesCount?: number;
  dynamicRiInput?: WorldRuntimeInput["dynamicRiInput"];
  riCoordinate?: WorldRuntimeInput["riCoordinate"];
  statsText?: string;
  selectedConnectorContextNames?: string[];
  selectedConnectorContextPathPrefixes?: string[];
}): WorldRuntimeInput => ({
  protocolVersion: WORLD_PROTOCOL_VERSION,
  worldId: MIDI_CLIP_WORLD_ID,
  surface,
  label,
  connectorName: runtimeData.connectorTargets.join(" + ") || undefined,
  particlesCount,
  riCoordinate,
  dynamicRiInput,
  selectedConnectorContextNames,
  selectedConnectorContextPathPrefixes,
  executeOutput: runtimeData.streams.map((stream) => ({
    path: stream.feature_path,
    data: [...stream.data],
  })),
  artifacts: {
    midiStatsText: statsText,
  },
});

export const buildToneWorldInput = ({
  streams,
  label,
  surface,
  connectorTargets = [],
  particlesCount,
  dynamicRiInput,
  riCoordinate,
  statsText,
  selectedConnectorContextNames,
  selectedConnectorContextPathPrefixes,
}: {
  streams: Array<{ path: string; data: number[] }>;
  label: string;
  surface: WorldRuntimeInput["surface"];
  connectorTargets?: string[];
  particlesCount?: number;
  dynamicRiInput?: WorldRuntimeInput["dynamicRiInput"];
  riCoordinate?: WorldRuntimeInput["riCoordinate"];
  statsText?: string;
  selectedConnectorContextNames?: string[];
  selectedConnectorContextPathPrefixes?: string[];
}): WorldRuntimeInput => ({
  protocolVersion: WORLD_PROTOCOL_VERSION,
  worldId: TONE_WORLD_ID,
  surface,
  label,
  connectorName: connectorTargets.join(" + ") || undefined,
  particlesCount,
  riCoordinate,
  dynamicRiInput,
  selectedConnectorContextNames,
  selectedConnectorContextPathPrefixes,
  executeOutput: streams.map((stream) => ({
    path: stream.path,
    data: [...stream.data],
  })),
  artifacts: {
    toneStatsText: statsText,
  },
});
