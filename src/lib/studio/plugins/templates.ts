import { MUSIC_SCORE_PLUGIN_ID } from "$lib/score/codebook";

export type StudioPluginTemplateDescriptor = {
  id: string;
  pluginId: string;
  name: string;
  summary: string;
  archetypeConnectors: string[];
  slotConnectors: string[];
};

const MUSIC_SCORE_TEMPLATES: StudioPluginTemplateDescriptor[] = [
  {
    id: "score-full-v2",
    pluginId: MUSIC_SCORE_PLUGIN_ID,
    name: "Full Score",
    summary:
      "Layered score draft with explicit parts, meter, clef, tempo, key, notes, articulations, and slurs.",
    archetypeConnectors: ["score_full_v2"],
    slotConnectors: [
      "score_parts_v2",
      "score_meter_v2",
      "score_clefs_v2",
      "score_tempo_v2",
      "score_key_v2",
      "score_notes_v1",
      "score_articulations_v1",
      "score_slurs_v1",
    ],
  },
  {
    id: "score-notes-v1",
    pluginId: MUSIC_SCORE_PLUGIN_ID,
    name: "Notes",
    summary:
      "Note events with global tick time, tick duration, pitch, dynamics, part, staff, and voice.",
    archetypeConnectors: ["score_notes_v1"],
    slotConnectors: [
      "score_event_id",
      "score_onset",
      "score_duration",
      "score_pitch",
      "score_dynamic_code",
      "score_part",
      "score_staff",
      "score_voice",
    ],
  },
  {
    id: "score-meter-v2",
    pluginId: MUSIC_SCORE_PLUGIN_ID,
    name: "Meter",
    summary: "Meter map that divides global tick time into notated bars.",
    archetypeConnectors: ["score_meter_v2"],
    slotConnectors: ["score_meter_time_tick", "score_beats", "score_beat_type"],
  },
  {
    id: "score-parts-v2",
    pluginId: MUSIC_SCORE_PLUGIN_ID,
    name: "Parts",
    summary: "Part and staff-count layer for multi-part and multi-staff scores.",
    archetypeConnectors: ["score_parts_v2"],
    slotConnectors: ["score_part", "score_staff_count"],
  },
  {
    id: "score-clefs-v2",
    pluginId: MUSIC_SCORE_PLUGIN_ID,
    name: "Clefs",
    summary: "Clef changes by global tick time, part, and staff.",
    archetypeConnectors: ["score_clefs_v2"],
    slotConnectors: [
      "score_clef_time_tick",
      "score_part",
      "score_staff",
      "score_clef_sign_code",
      "score_clef_line",
    ],
  },
  {
    id: "score-tempo-v2",
    pluginId: MUSIC_SCORE_PLUGIN_ID,
    name: "Tempo",
    summary: "Tempo map by global tick time.",
    archetypeConnectors: ["score_tempo_v2"],
    slotConnectors: ["score_tempo_time_tick", "score_tempo_bpm"],
  },
  {
    id: "score-key-v2",
    pluginId: MUSIC_SCORE_PLUGIN_ID,
    name: "Key",
    summary: "Key signature map by global tick time and optional part.",
    archetypeConnectors: ["score_key_v2"],
    slotConnectors: [
      "score_key_time_tick",
      "score_key_fifths",
      "score_key_mode_code",
      "score_part",
    ],
  },
  {
    id: "score-articulations-v1",
    pluginId: MUSIC_SCORE_PLUGIN_ID,
    name: "Articulations",
    summary: "Per-event articulation codes mapped onto MusicXML notation.",
    archetypeConnectors: ["score_articulations_v1"],
    slotConnectors: ["score_event_id", "score_articulation_code", "score_placement"],
  },
  {
    id: "score-slurs-v1",
    pluginId: MUSIC_SCORE_PLUGIN_ID,
    name: "Slurs",
    summary: "Slur spans keyed by note event and encoded as MusicXML start or stop states.",
    archetypeConnectors: ["score_slurs_v1"],
    slotConnectors: ["score_event_id", "score_slur_number", "score_slur_type", "score_placement"],
  },
];

const BUILTIN_STUDIO_PLUGIN_TEMPLATES: StudioPluginTemplateDescriptor[] = [
  ...MUSIC_SCORE_TEMPLATES,
];

export const listStudioPluginTemplates = (): StudioPluginTemplateDescriptor[] => [
  ...BUILTIN_STUDIO_PLUGIN_TEMPLATES,
];

export const listStudioPluginTemplatesForPlugin = (
  pluginId: string | null | undefined,
): StudioPluginTemplateDescriptor[] => {
  if (!pluginId) return [];
  return BUILTIN_STUDIO_PLUGIN_TEMPLATES.filter((template) => template.pluginId === pluginId);
};
