import type { StudioConnectorDef } from "$lib/studio/domain/connectorModel";

export type MusicScoreSchemaEntryKind = "layer" | "table" | "field" | "setting" | "advanced";
export type MusicScoreSchemaSlotStatus = "required" | "optional" | "future" | "advanced";

export type MusicScorePositionSchemaEntry = {
  path: Array<number | "*">;
  label: string;
  kind: MusicScoreSchemaEntryKind;
  status?: MusicScoreSchemaSlotStatus;
  defaultValue?: string;
  description?: string;
};

type LayerDef = {
  key: string;
  rootSlot: number;
  label: string;
  kind?: MusicScoreSchemaEntryKind;
  status: MusicScoreSchemaSlotStatus;
  defaultValue: string;
  tableLabel: string;
  fields: Array<{
    slot: number;
    label: string;
    status: MusicScoreSchemaSlotStatus;
    defaultValue?: string;
    description?: string;
  }>;
};

const LAYERS: LayerDef[] = [
  {
    key: "notes",
    rootSlot: 1,
    label: "Notes",
    status: "required",
    defaultValue: "No notation",
    tableLabel: "Note table",
    fields: [
      { slot: 1, label: "Onset tick", status: "required" },
      { slot: 2, label: "Duration tick", status: "required" },
      { slot: 3, label: "Pitch", status: "required" },
      { slot: 4, label: "Event ID", status: "optional", defaultValue: "Row index" },
      { slot: 5, label: "Part", status: "optional", defaultValue: "Default part" },
      { slot: 6, label: "Staff", status: "optional", defaultValue: "Default staff" },
      { slot: 7, label: "Voice", status: "optional", defaultValue: "Voice 1" },
      { slot: 8, label: "Dynamic", status: "optional", defaultValue: "No dynamic marking" },
      { slot: 9, label: "Note kind", status: "future", defaultValue: "Pitched note" },
      { slot: 10, label: "Accidental", status: "future", defaultValue: "Renderer spelling" },
      { slot: 11, label: "Stem", status: "future", defaultValue: "Renderer choice" },
      { slot: 12, label: "Beam group", status: "future", defaultValue: "Renderer grouping" },
    ],
  },
  {
    key: "parts",
    rootSlot: 2,
    label: "Parts",
    status: "optional",
    defaultValue: "One part, one staff",
    tableLabel: "Part table",
    fields: [
      { slot: 1, label: "Part", status: "required" },
      { slot: 2, label: "Staff count", status: "required" },
      { slot: 3, label: "Part name", status: "future", defaultValue: "Generated part name" },
      { slot: 4, label: "Instrument", status: "future", defaultValue: "No playback instrument" },
    ],
  },
  {
    key: "meter",
    rootSlot: 3,
    label: "Meter",
    status: "optional",
    defaultValue: "4/4 preview meter",
    tableLabel: "Meter table",
    fields: [
      { slot: 1, label: "Meter time tick", status: "required" },
      { slot: 2, label: "Beats", status: "required" },
      { slot: 3, label: "Beat type", status: "required" },
    ],
  },
  {
    key: "clefs",
    rootSlot: 4,
    label: "Clefs",
    status: "optional",
    defaultValue: "Treble clef, part 1, staff 1",
    tableLabel: "Clef table",
    fields: [
      { slot: 1, label: "Clef time tick", status: "required" },
      { slot: 2, label: "Part", status: "required" },
      { slot: 3, label: "Staff", status: "required" },
      {
        slot: 4,
        label: "Clef sign",
        status: "required",
        description: "0=G, 1=F, 2=C, 3=percussion",
      },
      {
        slot: 5,
        label: "Clef line",
        status: "required",
        description: "Commonly 2 for G and 4 for F",
      },
    ],
  },
  {
    key: "tempo",
    rootSlot: 5,
    label: "Tempo",
    status: "optional",
    defaultValue: "No tempo marking",
    tableLabel: "Tempo table",
    fields: [
      { slot: 1, label: "Tempo time tick", status: "required" },
      { slot: 2, label: "BPM", status: "required" },
    ],
  },
  {
    key: "key",
    rootSlot: 6,
    label: "Key",
    status: "optional",
    defaultValue: "No key signature / C major display",
    tableLabel: "Key table",
    fields: [
      { slot: 1, label: "Key time tick", status: "required" },
      { slot: 2, label: "Fifths", status: "required" },
      { slot: 3, label: "Mode", status: "optional", defaultValue: "Major" },
      { slot: 4, label: "Part", status: "optional", defaultValue: "All parts" },
    ],
  },
  {
    key: "articulations",
    rootSlot: 7,
    label: "Articulations",
    status: "optional",
    defaultValue: "No articulations",
    tableLabel: "Articulation table",
    fields: [
      { slot: 1, label: "Event ID", status: "required" },
      {
        slot: 2,
        label: "Articulation code",
        status: "required",
        description: "0=accent, 1=staccato, 2=tenuto, 3=strong-accent",
      },
      { slot: 3, label: "Placement", status: "optional", description: "0=above, 1=below" },
    ],
  },
  {
    key: "slurs",
    rootSlot: 8,
    label: "Slurs / spanners",
    status: "optional",
    defaultValue: "No slurs",
    tableLabel: "Slur table",
    fields: [
      { slot: 1, label: "Event ID", status: "required" },
      { slot: 2, label: "Slur number", status: "required" },
      {
        slot: 3,
        label: "Slur type",
        status: "required",
        description: "0=start, 1=stop, 2=continue",
      },
      { slot: 4, label: "Placement", status: "optional", description: "0=above, 1=below" },
      { slot: 5, label: "Spanner kind", status: "future" },
    ],
  },
  {
    key: "directions",
    rootSlot: 9,
    label: "Directions / text",
    status: "future",
    defaultValue: "None",
    tableLabel: "Direction table",
    fields: [
      { slot: 1, label: "Direction time tick", status: "required" },
      { slot: 2, label: "Direction kind", status: "required" },
      { slot: 3, label: "Direction ID", status: "optional" },
      { slot: 4, label: "Part", status: "optional" },
      { slot: 5, label: "Staff", status: "optional" },
      { slot: 6, label: "Placement", status: "optional" },
      { slot: 7, label: "Value code", status: "optional" },
      { slot: 8, label: "Text ID", status: "optional" },
    ],
  },
  {
    key: "barlines",
    rootSlot: 10,
    label: "Barlines / repeats",
    status: "future",
    defaultValue: "Regular barlines",
    tableLabel: "Barline table",
    fields: [
      { slot: 1, label: "Barline time tick", status: "required" },
      { slot: 2, label: "Barline kind", status: "required" },
      { slot: 3, label: "Part", status: "optional" },
      { slot: 4, label: "Repeat code", status: "optional" },
      { slot: 5, label: "Ending code", status: "optional" },
    ],
  },
  {
    key: "settings",
    rootSlot: 11,
    label: "Settings",
    kind: "setting",
    status: "optional",
    defaultValue: "ticks_per_quarter = 2520",
    tableLabel: "Settings table",
    fields: [{ slot: 1, label: "Ticks per quarter", status: "optional", defaultValue: "2520" }],
  },
  {
    key: "raw-musicxml-tree",
    rootSlot: 12,
    label: "Raw MusicXML tree",
    kind: "advanced",
    status: "advanced",
    defaultValue: "None",
    tableLabel: "Raw MusicXML tree table",
    fields: [
      { slot: 1, label: "Score nodes", status: "advanced" },
      { slot: 2, label: "Score attrs", status: "advanced" },
      { slot: 3, label: "Score text", status: "advanced" },
    ],
  },
];

const rootLayerBySlot = new Map(LAYERS.map((layer) => [layer.rootSlot, layer] as const));

const toEntry = (
  path: Array<number | "*">,
  label: string,
  kind: MusicScoreSchemaEntryKind,
  options: Omit<MusicScorePositionSchemaEntry, "path" | "label" | "kind"> = {},
): MusicScorePositionSchemaEntry => ({
  path,
  label,
  kind,
  ...options,
});

export const MUSIC_SCORE_POSITION_SCHEMA = {
  id: "music-score-position-schema-v1",
  name: "Music Score Position Schema",
  entries: LAYERS.flatMap((layer) => [
    toEntry([layer.rootSlot], layer.label, layer.kind ?? "layer", {
      status: layer.status,
      defaultValue: layer.defaultValue,
    }),
    toEntry([layer.rootSlot, "*"], layer.tableLabel, "table"),
    ...layer.fields.flatMap((field) => [
      toEntry([layer.rootSlot, field.slot], field.label, "field", {
        status: field.status,
        ...(field.defaultValue ? { defaultValue: field.defaultValue } : {}),
        ...(field.description ? { description: field.description } : {}),
      }),
      toEntry([layer.rootSlot, "*", field.slot], field.label, "field", {
        status: field.status,
        ...(field.defaultValue ? { defaultValue: field.defaultValue } : {}),
        ...(field.description ? { description: field.description } : {}),
      }),
    ]),
  ]),
} as const;

const matchesPath = (candidate: readonly (number | "*")[], path: readonly number[]): boolean =>
  candidate.length === path.length &&
  candidate.every((segment, index) => segment === "*" || segment === path[index]);

const getFieldEntry = (
  layer: LayerDef,
  path: number[],
  fieldSlot: number,
): MusicScorePositionSchemaEntry | null => {
  const field = layer.fields.find((candidate) => candidate.slot === fieldSlot);
  if (!field) return null;
  return toEntry(path, field.label, "field", {
    status: field.status,
    ...(field.defaultValue ? { defaultValue: field.defaultValue } : {}),
    ...(field.description ? { description: field.description } : {}),
  });
};

const connectorLooksLikeLayerTable = (
  connector: StudioConnectorDef | null | undefined,
  layer: LayerDef,
): boolean => {
  if (!connector) return false;
  const requiredFieldSlots = layer.fields
    .filter((field) => field.status === "required")
    .map((field) => field.slot);
  if (requiredFieldSlots.length === 0) return false;
  return requiredFieldSlots.every((slot) => Boolean(connector.dimensions[slot - 1]));
};

export const resolveMusicScorePositionSchemaEntry = (
  path: readonly number[],
  options: {
    connectors?: Record<string, StudioConnectorDef>;
    connectorNameAtPath?: string;
  } = {},
): MusicScorePositionSchemaEntry | null => {
  if (path.length === 0) return null;
  const rootSlot = path[0];
  const layer = rootLayerBySlot.get(rootSlot);
  if (!layer) return null;

  if (path.length === 1) {
    return toEntry([layer.rootSlot], layer.label, layer.kind ?? "layer", {
      status: layer.status,
      defaultValue: layer.defaultValue,
    });
  }

  if (path.length === 2) {
    const candidateConnector = options.connectorNameAtPath
      ? options.connectors?.[options.connectorNameAtPath]
      : null;
    if (connectorLooksLikeLayerTable(candidateConnector, layer)) {
      return toEntry([layer.rootSlot, "*"], `${layer.tableLabel} ${path[1]}`, "table");
    }
    return getFieldEntry(layer, [...path], path[1]);
  }

  if (path.length === 3) {
    return getFieldEntry(layer, [...path], path[2]);
  }

  return MUSIC_SCORE_POSITION_SCHEMA.entries.find((entry) => matchesPath(entry.path, path)) ?? null;
};
