import { normalizeFormatHash } from "$lib/chain/registryApi";
import { MUSIC_SCORE_PLUGIN_ID, MUSIC_SCORE_PLUGIN_NAME } from "$lib/score/codebook";

export type StudioPluginDescriptor = {
  id: string;
  name: string;
  summary: string;
  supportedFormatHashes: string[];
  status: "alpha" | "planned";
};

const MIDI_QUAD_FORMAT_HASH = normalizeFormatHash(
  "0xfb01a34414c7cfd27fe4658f53b5b39361da407b46848efac553fd2d8ad9b411",
);
const MUSIC_SCORE_FORMAT_HASHES = [
  "0x637d49f0ec85ec68c9abfedb750881d641ebab0bbbe046db6341b128edc42dae",
  "0x30bf53a39f0173459fbc426e731a0f93d92b6bab2d8a14f37d2b84f6a427f891",
  "0x9ed0ef3e3aa74c0f4c7cf686947c7d87e98ab96f1829d742d834f568a8649e69",
  "0xb7b53ff86e20bd391efe43a3da33bf1c7c19e00ce93a46a2394def287f1cabb9",
  "0x7c3feb4f8faa57e3e5950ea982e24aeabaab504a774d2ba7e946cb2266e8c6db",
  "0xb5de85796928dc02bacbbd117de5b25f7277d670d37df3a50b5937da2d7343ab",
  "0xc9ea7ced7294c7b4ec0dfe5eebdb36ca1fe082d81ba79a1fc59f244530f99eca",
  "0x4b4ff5b5495d7cec306e7c4a6a423ab1d4ba857ba62886c07d4773ba963885ce",
  "0xefa4f226e9e87d8c40856130ba76cc86ed711baa10deba0f264f88d082d4fd8f",
].map((hash) => normalizeFormatHash(hash));

const BUILTIN_STUDIO_PLUGINS: StudioPluginDescriptor[] = [
  {
    id: "midi-clip-export-v1",
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
    supportedFormatHashes: [MIDI_QUAD_FORMAT_HASH, ...MUSIC_SCORE_FORMAT_HASHES],
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
