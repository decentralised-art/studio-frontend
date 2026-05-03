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
    id: "score-notes-v1",
    pluginId: MUSIC_SCORE_PLUGIN_ID,
    name: "Notes",
    summary: "Event rows with score position, duration, pitch, dynamics, part, staff, and voice.",
    archetypeConnectors: ["score_notes_v1"],
    slotConnectors: [
      "score_event_id",
      "score_measure",
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
