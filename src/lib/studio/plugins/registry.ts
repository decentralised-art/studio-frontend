import { normalizeFormatHash } from "$lib/chain/registryApi";
import { MUSIC_SCORE_PLUGIN_ID, MUSIC_SCORE_PLUGIN_NAME } from "$lib/score/codebook";
import type { WorldAcceptedConnectorSet, WorldDescriptor } from "$lib/worlds/types";

export type StudioPluginDescriptor = {
  id: string;
  name: string;
  summary: string;
  supportedFormatHashes: string[];
  acceptedConnectorSets?: WorldAcceptedConnectorSet[];
  status: "alpha" | "planned" | "active" | "deleted";
  source?: "builtin" | "backend-world";
  worldDescriptor?: WorldDescriptor;
};

export const MIDI_CLIP_PLUGIN_ID = "midi-clip-export-v1";
export const TONE_WORLD_PLUGIN_ID = "tone-world-v1";
export const MIDI_QUAD_FORMAT_HASH = normalizeFormatHash(
  "0xfb01a34414c7cfd27fe4658f53b5b39361da407b46848efac553fd2d8ad9b411",
);
export const MUSIC_SCORE_FORMAT_HASHES: string[] = [].map((hash) => normalizeFormatHash(hash));
export const MUSIC_SCORE_PLUGIN_FORMAT_HASHES = MUSIC_SCORE_FORMAT_HASHES;

const BUILTIN_STUDIO_PLUGINS: StudioPluginDescriptor[] = [
  {
    id: MIDI_CLIP_PLUGIN_ID,
    name: "MIDI Clip Export",
    summary:
      "Generates MIDI clips from pitch/time/duration/velocity connector streams and supports file export.",
    supportedFormatHashes: [MIDI_QUAD_FORMAT_HASH],
    status: "alpha",
    source: "builtin",
  },
  {
    id: MUSIC_SCORE_PLUGIN_ID,
    name: MUSIC_SCORE_PLUGIN_NAME,
    summary:
      "Renders compatible connector/RIs output as MusicXML 4.0 notation in a sandboxed world.",
    supportedFormatHashes: MUSIC_SCORE_PLUGIN_FORMAT_HASHES,
    status: "alpha",
    source: "builtin",
  },
  {
    id: TONE_WORLD_PLUGIN_ID,
    name: "Tone World",
    summary: "Runs compatible connector/RIs output inside the Tone World audiovisual runtime.",
    supportedFormatHashes: [],
    status: "alpha",
    source: "builtin",
  },
];

export const BACKEND_WORLD_PLUGIN_ID_PREFIX = "world:";

export const studioPluginIdForWorld = (world: Pick<WorldDescriptor, "id">): string =>
  `${BACKEND_WORLD_PLUGIN_ID_PREFIX}${world.id}`;

const normalizeSupportedFormatHashes = (hashes: readonly string[] | null | undefined): string[] =>
  (hashes ?? []).flatMap((hash) => {
    try {
      return [normalizeFormatHash(hash)];
    } catch {
      return [];
    }
  });

export const studioPluginFromWorldDescriptor = (
  world: WorldDescriptor,
): StudioPluginDescriptor => ({
  id: studioPluginIdForWorld(world),
  name: world.name,
  summary: world.shortDescription ?? world.description,
  supportedFormatHashes: normalizeSupportedFormatHashes(world.acceptedFormatHashes),
  acceptedConnectorSets: world.acceptedConnectorSets?.map((connectorSet) => ({
    connectors: [...connectorSet.connectors],
    optionalConnectors: [...connectorSet.optionalConnectors],
  })),
  status: world.backend?.status ?? "active",
  source: "backend-world",
  worldDescriptor: world,
});

export const listStudioWorldPlugins = (
  worlds: readonly WorldDescriptor[],
): StudioPluginDescriptor[] =>
  worlds
    .filter((world) => world.source === "backend")
    .filter((world) => world.surfaces.includes("studio-plugin"))
    .map(studioPluginFromWorldDescriptor);

export const listStudioPlugins = (): StudioPluginDescriptor[] => [...BUILTIN_STUDIO_PLUGINS];

export const listCompatibleStudioPlugins = (
  formatHash: string | null | undefined,
): StudioPluginDescriptor[] => {
  if (!formatHash) return [];
  let normalized = "";
  try {
    normalized = normalizeFormatHash(formatHash);
  } catch {
    return [];
  }
  return BUILTIN_STUDIO_PLUGINS.filter((plugin) =>
    plugin.supportedFormatHashes.includes(normalized),
  );
};
