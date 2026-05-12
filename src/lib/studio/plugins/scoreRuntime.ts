import {
  buildScoreFromMeasuredNoteStreams,
  hasMeasuredNoteStreams,
} from "$lib/score/adapters/measuredNotes";
import { buildScoreFromMidiGroups } from "$lib/score/adapters/noteEvents";
import { buildScoreFromTreeStreams, hasScoreTreeStreams } from "$lib/score/adapters/scoreTree";
import { serializeScoreTreeToMusicXml } from "$lib/score/musicXmlSerializer";
import type { ScoreBuildResult, ScorePluginRuntimeData } from "$lib/score/types";
import type { StudioPluginRuntimeData } from "$lib/studio/plugins/runtime";

const emptyMusicXml = "";

const toRuntimeData = (result: ScoreBuildResult): ScorePluginRuntimeData => ({
  adapterId: result.stats.adapterId,
  musicXml: result.tree ? serializeScoreTreeToMusicXml(result.tree) : emptyMusicXml,
  diagnostics: result.diagnostics,
  renderedNotes: result.renderedNotes ?? [],
  stats: result.stats,
});

export const buildScorePluginRuntimeData = (
  runtimeData: StudioPluginRuntimeData,
): ScorePluginRuntimeData => {
  if (hasScoreTreeStreams(runtimeData.streams)) {
    const result = buildScoreFromTreeStreams(runtimeData.streams);
    if (result) return toRuntimeData(result);
  }

  if (hasMeasuredNoteStreams(runtimeData.streams, runtimeData.connectorTargets)) {
    const result = buildScoreFromMeasuredNoteStreams(
      runtimeData.streams,
      runtimeData.connectorTargets,
    );
    if (result) return toRuntimeData(result);
  }

  return toRuntimeData(buildScoreFromMidiGroups([], runtimeData.streams.length));
};
