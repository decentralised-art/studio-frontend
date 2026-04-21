import { normalizeFormatHash } from "$lib/chain/registryApi";

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

const BUILTIN_STUDIO_PLUGINS: StudioPluginDescriptor[] = [
  {
    id: "midi-clip-export-v1",
    name: "MIDI Clip Export",
    summary:
      "Generates MIDI clips from pitch/time/duration/velocity connector streams and supports file export.",
    supportedFormatHashes: [MIDI_QUAD_FORMAT_HASH],
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
