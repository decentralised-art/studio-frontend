import { normalizeFormatHash } from "$lib/chain/registryApi";
import { MUSIC_SCORE_PLUGIN_ID, MUSIC_SCORE_PLUGIN_NAME } from "$lib/score/codebook";

export type StudioPluginDescriptor = {
  id: string;
  name: string;
  summary: string;
  supportedFormatHashes: string[];
  status: "alpha" | "planned";
};

export const MIDI_CLIP_PLUGIN_ID = "midi-clip-export-v1";
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
  },
  {
    id: MUSIC_SCORE_PLUGIN_ID,
    name: MUSIC_SCORE_PLUGIN_NAME,
    summary:
      "Renders compatible connector/RIs output as MusicXML 4.0 notation in a sandboxed world.",
    supportedFormatHashes: MUSIC_SCORE_PLUGIN_FORMAT_HASHES,
    status: "alpha",
  },
];

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
