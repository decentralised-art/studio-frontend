import { MUSIC_SCORE_PLUGIN_ID } from "$lib/score/codebook";
import type { ScorePluginRuntimeData } from "$lib/score/types";
import { MIDI_CLIP_PLUGIN_ID, MIDI_QUAD_FORMAT_HASH } from "$lib/studio/plugins/registry";
import type { StudioPluginRuntimeData } from "$lib/studio/plugins/runtime";
import { WORLD_PROTOCOL_VERSION, type WorldDescriptor, type WorldRuntimeInput } from "./types";

export const MUSICXML_SCORE_WORLD_ID = "world.musicxml-score";
export const MUSICXML_SCORE_WORLD_SLUG = "musicxml-score";
export const MUSICXML_SCORE_WORLD_ENTRY = "/world-runtimes/musicxml-score";
export const MIDI_CLIP_WORLD_ID = "world.midi-clip";
export const MIDI_CLIP_WORLD_SLUG = "midi-clip";
export const MIDI_CLIP_WORLD_ENTRY = "/world-runtimes/midi-clip";

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
  stats: [
    { label: "Runtime", value: "OSMD" },
    { label: "Format", value: "MusicXML 4.0" },
    { label: "Mode", value: "Connector/RIs" },
  ],
};

export const MIDI_CLIP_WORLD_REQUIRED_SCALARS = ["pitch", "time", "duration", "velocity"] as const;
export const MIDI_CLIP_WORLD_ACCEPTED_SCALARS = [...MIDI_CLIP_WORLD_REQUIRED_SCALARS] as const;

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
  stats: [
    { label: "Runtime", value: "Piano Roll" },
    { label: "Format", value: "MIDI" },
    { label: "Mode", value: "Connector/RIs" },
  ],
};

export const FIRST_PARTY_WORLDS = [MUSICXML_SCORE_WORLD, MIDI_CLIP_WORLD] as const;

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
