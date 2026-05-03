import { describe, expect, it } from "vitest";

import { MUSIC_SCORE_PLUGIN_ID } from "../src/lib/score/codebook";
import {
  listStudioPluginTemplates,
  listStudioPluginTemplatesForPlugin,
} from "../src/lib/studio/plugins/templates";

describe("studio plugin templates", () => {
  it("registers score templates under the Music Score plugin", () => {
    const templates = listStudioPluginTemplatesForPlugin(MUSIC_SCORE_PLUGIN_ID);

    expect(templates.map((template) => template.id)).toEqual([
      "score-notes-v1",
      "score-articulations-v1",
      "score-slurs-v1",
    ]);
    expect(templates.every((template) => template.pluginId === MUSIC_SCORE_PLUGIN_ID)).toBe(true);
  });

  it("defines the notes semantic slot collector shape", () => {
    const notes = listStudioPluginTemplates().find((template) => template.id === "score-notes-v1");

    expect(notes?.archetypeConnectors).toEqual(["score_notes_v1"]);
    expect(notes?.slotConnectors).toEqual([
      "score_event_id",
      "score_measure",
      "score_onset",
      "score_duration",
      "score_pitch",
      "score_dynamic_code",
      "score_part",
      "score_staff",
      "score_voice",
    ]);
  });

  it("does not expose templates for plugins without registered templates", () => {
    expect(listStudioPluginTemplatesForPlugin("midi-clip-export-v1")).toEqual([]);
    expect(listStudioPluginTemplatesForPlugin(null)).toEqual([]);
  });
});
