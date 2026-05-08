import { MUSIC_SCORE_PLUGIN_ID } from "$lib/score/codebook";
import { MUSIC_SCORE_POSITION_SCHEMA } from "$lib/score/positionSchema";
import type { ScorePluginRuntimeData } from "$lib/score/types";
import { WORLD_PROTOCOL_VERSION, type WorldDescriptor, type WorldRuntimeInput } from "./types";

export const MUSICXML_SCORE_WORLD_ID = "world.musicxml-score";
export const MUSICXML_SCORE_WORLD_SLUG = "musicxml-score";
export const MUSICXML_SCORE_WORLD_ENTRY = "/world-runtimes/musicxml-score";
export const MUSICXML_SCORE_WORLD_DEFAULT_CONNECTOR = "test_score_root_0_version2_6052026";

export const MUSICXML_SCORE_WORLD: WorldDescriptor = {
  id: MUSICXML_SCORE_WORLD_ID,
  slug: MUSICXML_SCORE_WORLD_SLUG,
  name: "MusicXML Score World",
  version: "0.1.0",
  entry: MUSICXML_SCORE_WORLD_ENTRY,
  runtime: "iframe",
  acceptedPluginIds: [MUSIC_SCORE_PLUGIN_ID],
  acceptedFormatHashes: [],
  surfaces: ["world-page", "studio-plugin"],
  description:
    "Renders compatible connector/RIs states as MusicXML notation through a sandboxed OSMD runtime.",
  shortDescription:
    "A notation world for connector output that can be interpreted as MusicXML score material.",
  heroLabel: "MusicXML",
  accentColor: "#67d6ff",
  compatibleConnectorNames: [MUSICXML_SCORE_WORLD_DEFAULT_CONNECTOR],
  positionSchema: MUSIC_SCORE_POSITION_SCHEMA,
  stats: [
    { label: "Runtime", value: "OSMD" },
    { label: "Format", value: "MusicXML 4.0" },
    { label: "Mode", value: "Connector/RIs" },
  ],
};

export const FIRST_PARTY_WORLDS = [MUSICXML_SCORE_WORLD] as const;

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
}: {
  scoreData: ScorePluginRuntimeData;
  label: string;
  surface: WorldRuntimeInput["surface"];
  connectorTargets?: string[];
  particlesCount?: number;
  dynamicRiInput?: WorldRuntimeInput["dynamicRiInput"];
  riCoordinate?: WorldRuntimeInput["riCoordinate"];
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
    artifacts: {
      musicXml: scoreData.musicXml,
      scoreAdapterId: scoreData.adapterId,
      scoreStatsText: `${stats.noteCount} notes | ${stats.measureCount} measures | ${stats.partCount} parts | ${stats.adapterId}`,
    },
  };
};
