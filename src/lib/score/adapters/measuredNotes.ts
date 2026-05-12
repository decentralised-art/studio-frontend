import type { PtOutputFeature } from "$lib/particles/ptMidiAdapter";
import { buildScoreFromNoteEvents } from "$lib/score/adapters/noteEvents";
import {
  resolveArticulationElementName,
  resolveClefSign,
  resolveKeyMode,
  resolvePlacement,
  resolveSlurType,
} from "$lib/score/codebook";
import { scoreDiagnostic } from "$lib/score/diagnostics";
import type {
  ScoreArticulationEvent,
  ScoreBuildResult,
  ScoreClefEvent,
  ScoreKeyEvent,
  ScoreMeterEvent,
  ScoreNoteEvent,
  ScorePartEvent,
  ScoreSlurEvent,
  ScoreTempoEvent,
} from "$lib/score/types";
import { normalizePluginPathSegmentName } from "$lib/studio/plugins/runtime";

export const SCORE_MEASURED_NOTES_ADAPTER_ID = "music-measured-notes-v1";

export const SCORE_TICKS_PER_QUARTER = 2520;

type MeasuredNoteField =
  | "eventId"
  | "time"
  | "timeTick"
  | "durationTick"
  | "measure"
  | "onset"
  | "duration"
  | "pitch"
  | "velocity"
  | "dynamicCode"
  | "voice"
  | "staff"
  | "part";

type ScoreDecorationField =
  | "eventId"
  | "articulationCode"
  | "placement"
  | "slurNumber"
  | "slurType";

type ScoreLayerField =
  | "meterTimeTick"
  | "beats"
  | "beatType"
  | "staffCount"
  | "clefTimeTick"
  | "clefSignCode"
  | "clefLine"
  | "tempoTimeTick"
  | "tempoBpm"
  | "keyTimeTick"
  | "keyFifths"
  | "keyModeCode"
  | "part"
  | "staff";

type MeasuredNoteGroup = Partial<Record<MeasuredNoteField, PtOutputFeature>> & {
  groupPath: string;
};

type ScoreArticulationGroup = Partial<
  Record<"eventId" | "articulationCode" | "placement", PtOutputFeature>
> & {
  groupPath: string;
};

type ScoreSlurGroup = Partial<
  Record<"eventId" | "slurNumber" | "slurType" | "placement", PtOutputFeature>
> & {
  groupPath: string;
};

type ScoreMeterGroup = Partial<Record<"meterTimeTick" | "beats" | "beatType", PtOutputFeature>> & {
  groupPath: string;
};

type ScorePartGroup = Partial<Record<"part" | "staffCount", PtOutputFeature>> & {
  groupPath: string;
};

type ScoreClefGroup = Partial<
  Record<"clefTimeTick" | "part" | "staff" | "clefSignCode" | "clefLine", PtOutputFeature>
> & {
  groupPath: string;
};

type ScoreTempoGroup = Partial<Record<"tempoTimeTick" | "tempoBpm", PtOutputFeature>> & {
  groupPath: string;
};

type ScoreKeyGroup = Partial<
  Record<"keyTimeTick" | "keyFifths" | "keyModeCode" | "part", PtOutputFeature>
> & {
  groupPath: string;
};

type ScoreCollectorKind =
  | "notes"
  | "meter"
  | "parts"
  | "clefs"
  | "tempo"
  | "key"
  | "articulations"
  | "slurs";

type ScoreField = MeasuredNoteField | ScoreDecorationField | ScoreLayerField;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const SUPPORTED_SCORE_BEAT_TYPES = new Set([1, 2, 4, 8, 16, 32, 64, 128]);
const RENDERABLE_KEY_MODES = new Set(["major", "minor", "none"]);

const normalizeRenderableClef = (
  sign: string,
  line: number,
): { sign: string; line: number; normalized: boolean } | null => {
  const roundedLine = Math.round(line);
  if (sign === "G") return { sign, line: 2, normalized: roundedLine !== 2 };
  if (sign === "F") return { sign, line: 4, normalized: roundedLine !== 4 };
  if (sign === "C") {
    const normalizedLine = roundedLine <= 3 ? 3 : 4;
    return { sign, line: normalizedLine, normalized: roundedLine !== normalizedLine };
  }
  if (sign === "percussion") return { sign, line: 2, normalized: roundedLine !== 2 };
  return null;
};

const normalizeRenderableKeyMode = (mode: string | null): string | null => {
  if (!mode) return null;
  return RENDERABLE_KEY_MODES.has(mode) ? mode : null;
};

const parsePathSegments = (path: string): string[] =>
  path
    .trim()
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

const parseScoreField = (path: string): ScoreField | null => {
  const segments = parsePathSegments(path);
  const normalizedSegments = segments.map((segment) => normalizePluginPathSegmentName(segment));
  for (const [fieldName, field] of [
    ["meter_time_tick", "meterTimeTick"],
    ["clef_time_tick", "clefTimeTick"],
    ["tempo_time_tick", "tempoTimeTick"],
    ["key_time_tick", "keyTimeTick"],
    ["onset_tick", "timeTick"],
    ["duration_tick", "durationTick"],
    ["pitch_midi", "pitch"],
    ["velocity_midi", "velocity"],
  ] as const) {
    if (normalizedSegments.includes(fieldName)) return field;
  }
  const leaf = normalizePluginPathSegmentName(segments[segments.length - 1] ?? "");
  if (leaf === "event_id" || leaf === "eventid") return "eventId";
  if (leaf === "onset_tick") return "timeTick";
  if (leaf === "duration_tick") return "durationTick";
  if (leaf === "pitch_midi") return "pitch";
  if (leaf === "velocity_midi") return "velocity";
  if (leaf === "dynamic_code" || leaf === "dynamic") return "dynamicCode";
  if (leaf === "voice") return "voice";
  if (leaf === "staff" || leaf === "clef_staff") return "staff";
  if (leaf === "part" || leaf === "clef_part" || leaf === "key_part") return "part";
  if (leaf === "articulation_code" || leaf === "articulation") return "articulationCode";
  if (leaf === "placement") return "placement";
  if (leaf === "slur_number" || leaf === "slur") return "slurNumber";
  if (leaf === "slur_type" || leaf === "type") return "slurType";
  if (leaf === "meter_time_tick") return "meterTimeTick";
  if (leaf === "beats" || leaf === "meter_beats") return "beats";
  if (leaf === "beat_type" || leaf === "meter_beat_type") return "beatType";
  if (leaf === "staff_count") return "staffCount";
  if (leaf === "clef_time_tick") return "clefTimeTick";
  if (leaf === "clef_sign_code" || leaf === "clef_sign") return "clefSignCode";
  if (leaf === "clef_line") return "clefLine";
  if (leaf === "tempo_time_tick") return "tempoTimeTick";
  if (leaf === "tempo_bpm" || leaf === "bpm") return "tempoBpm";
  if (leaf === "key_time_tick") return "keyTimeTick";
  if (leaf === "key_fifths" || leaf === "fifths") return "keyFifths";
  if (leaf === "key_mode_code" || leaf === "mode_code") return "keyModeCode";
  return null;
};

const NOTE_FIELDS = new Set<MeasuredNoteField>([
  "eventId",
  "time",
  "timeTick",
  "durationTick",
  "measure",
  "onset",
  "duration",
  "pitch",
  "velocity",
  "dynamicCode",
  "voice",
  "staff",
  "part",
]);

const ARTICULATION_FIELDS = new Set<ScoreDecorationField>([
  "eventId",
  "articulationCode",
  "placement",
]);

const SLUR_FIELDS = new Set<ScoreDecorationField>([
  "eventId",
  "slurNumber",
  "slurType",
  "placement",
]);

const METER_FIELDS = new Set<ScoreLayerField>(["meterTimeTick", "beats", "beatType"]);
const PART_FIELDS = new Set<ScoreLayerField>(["part", "staffCount"]);
const CLEF_FIELDS = new Set<ScoreLayerField>([
  "clefTimeTick",
  "part",
  "staff",
  "clefSignCode",
  "clefLine",
]);
const TEMPO_FIELDS = new Set<ScoreLayerField>(["tempoTimeTick", "tempoBpm"]);
const KEY_FIELDS = new Set<ScoreLayerField>(["keyTimeTick", "keyFifths", "keyModeCode", "part"]);

const NOTE_COLLECTOR_NAMES = new Set([
  "score_notes_v2",
  "score_notes_v1",
  "score_notes",
  "score_note",
  "notes",
  "note",
]);
const METER_COLLECTOR_NAMES = new Set([
  "score_meter_v3",
  "score_meter_v2",
  "score_meter_v1",
  "score_meter",
  "meter",
]);
const PART_COLLECTOR_NAMES = new Set([
  "score_parts_v3",
  "score_parts_v2",
  "score_parts_v1",
  "score_parts",
  "parts",
  "part",
]);
const CLEF_COLLECTOR_NAMES = new Set([
  "score_clefs_v3",
  "score_clefs_v2",
  "score_clefs_v1",
  "score_clefs",
  "clefs",
  "clef",
]);
const TEMPO_COLLECTOR_NAMES = new Set([
  "score_tempo_v3",
  "score_tempo_v2",
  "score_tempo_v1",
  "score_tempo",
  "tempo",
]);
const KEY_COLLECTOR_NAMES = new Set([
  "score_key_v3",
  "score_key_v2",
  "score_key_v1",
  "score_key",
  "key",
]);
const ARTICULATION_COLLECTOR_NAMES = new Set([
  "score_articulations_v2",
  "score_articulations_v1",
  "score_articulations",
  "articulations",
  "articulation",
]);
const SLUR_COLLECTOR_NAMES = new Set([
  "score_slurs_v2",
  "score_slurs_v1",
  "score_slurs",
  "slurs",
  "slur",
]);

const collectorKindForSegment = (segment: string): ScoreCollectorKind | null => {
  const name = normalizePluginPathSegmentName(segment);
  if (NOTE_COLLECTOR_NAMES.has(name)) return "notes";
  if (METER_COLLECTOR_NAMES.has(name)) return "meter";
  if (PART_COLLECTOR_NAMES.has(name)) return "parts";
  if (CLEF_COLLECTOR_NAMES.has(name)) return "clefs";
  if (TEMPO_COLLECTOR_NAMES.has(name)) return "tempo";
  if (KEY_COLLECTOR_NAMES.has(name)) return "key";
  if (ARTICULATION_COLLECTOR_NAMES.has(name)) return "articulations";
  if (SLUR_COLLECTOR_NAMES.has(name)) return "slurs";
  return null;
};

const buildCollectorGroupPath = (segments: string[], collectorIndex: number): string => {
  const collectorName = normalizePluginPathSegmentName(segments[collectorIndex] ?? "");
  const groupSegments = [...segments.slice(0, collectorIndex), collectorName].filter(Boolean);
  return groupSegments.length ? `/${groupSegments.join("/")}` : "/";
};

const parseCollectorContext = (
  path: string,
): { kind: ScoreCollectorKind | null; groupPath: string } => {
  const segments = parsePathSegments(path);
  for (let index = segments.length - 2; index >= 0; index -= 1) {
    const kind = collectorKindForSegment(segments[index] ?? "");
    if (kind) return { kind, groupPath: buildCollectorGroupPath(segments, index) };
  }
  if (segments.length <= 1) return { kind: null, groupPath: "/" };
  return { kind: null, groupPath: `/${segments.slice(0, -1).join("/")}` };
};

const buildAncestorGroupPaths = (path: string): string[] => {
  const segments = parsePathSegments(path);
  if (segments.length <= 1) return ["/"];
  const paths: string[] = [];
  const seen = new Set<string>();
  const pushPath = (pathValue: string) => {
    if (seen.has(pathValue)) return;
    seen.add(pathValue);
    paths.push(pathValue);
  };
  segments.slice(0, -1).forEach((_, index) => {
    const prefix = segments.slice(0, index + 1);
    pushPath(`/${prefix.join("/")}`);

    const lastSegment = prefix[prefix.length - 1] ?? "";
    const normalizedLastSegment = normalizePluginPathSegmentName(lastSegment);
    if (normalizedLastSegment && normalizedLastSegment !== lastSegment) {
      pushPath(`/${[...prefix.slice(0, -1), normalizedLastSegment].join("/")}`);
    }
  });
  return paths;
};

const isCompleteMeasuredNoteFieldSet = (fields: Set<MeasuredNoteField>): boolean =>
  fields.has("pitch") && fields.has("timeTick") && fields.has("durationTick");

const collectSemanticLayerGroups = <
  TField extends ScoreLayerField,
  TGroup extends { groupPath: string },
>(
  streams: readonly PtOutputFeature[],
  fields: ReadonlySet<ScoreLayerField>,
  expectedKind: ScoreCollectorKind,
  requiredFields: readonly TField[],
): TGroup[] => {
  const assignGroupField = (group: TGroup, field: TField, stream: PtOutputFeature) => {
    (group as unknown as Record<string, PtOutputFeature | string>)[field] = stream;
  };
  const groups = new Map<string, TGroup>();
  const uncollectedEntries: Array<{
    field: TField;
    stream: PtOutputFeature;
    ancestorPaths: string[];
  }> = [];
  const ancestorFields = new Map<string, Set<TField>>();

  streams.forEach((stream) => {
    const field = parseScoreField(stream.feature_path);
    if (!field || !fields.has(field as ScoreLayerField)) return;

    const layerField = field as TField;
    const { kind, groupPath } = parseCollectorContext(stream.feature_path);
    if (kind && kind !== expectedKind) return;

    if (!kind) {
      const ancestorPaths = buildAncestorGroupPaths(stream.feature_path);
      uncollectedEntries.push({ field: layerField, stream, ancestorPaths });
      ancestorPaths.forEach((ancestorPath) => {
        const currentFields = ancestorFields.get(ancestorPath) ?? new Set<TField>();
        currentFields.add(layerField);
        ancestorFields.set(ancestorPath, currentFields);
      });
      return;
    }

    const current = groups.get(groupPath) ?? ({ groupPath } as TGroup);
    assignGroupField(current, layerField, stream);
    groups.set(groupPath, current);
  });

  uncollectedEntries.forEach((entry) => {
    const groupPath = [...entry.ancestorPaths].reverse().find((ancestorPath) => {
      const fieldsAtPath = ancestorFields.get(ancestorPath) ?? new Set<TField>();
      return requiredFields.every((requiredField) => fieldsAtPath.has(requiredField));
    });
    if (!groupPath) return;

    const current = groups.get(groupPath) ?? ({ groupPath } as TGroup);
    assignGroupField(current, entry.field, entry.stream);
    groups.set(groupPath, current);
  });

  return [...groups.values()].sort((a, b) => a.groupPath.localeCompare(b.groupPath));
};

export const hasMeasuredNoteStreams = (
  streams: readonly PtOutputFeature[],
  connectorTargets: readonly string[] = [],
): boolean => {
  void connectorTargets;
  const fields = new Set(streams.map((stream) => parseScoreField(stream.feature_path)));
  return fields.has("pitch") && fields.has("timeTick") && fields.has("durationTick");
};

const collectGroups = (
  streams: readonly PtOutputFeature[],
  connectorTargets: readonly string[] = [],
): MeasuredNoteGroup[] => {
  void connectorTargets;
  const groups = new Map<string, MeasuredNoteGroup>();
  const uncollectedEntries: Array<{
    field: MeasuredNoteField;
    stream: PtOutputFeature;
    ancestorPaths: string[];
    fallbackGroupPath: string;
  }> = [];
  const ancestorFields = new Map<string, Set<MeasuredNoteField>>();

  streams.forEach((stream) => {
    const field = parseScoreField(stream.feature_path);
    if (!field || !NOTE_FIELDS.has(field as MeasuredNoteField)) return;
    const { kind, groupPath } = parseCollectorContext(stream.feature_path);
    if (kind && kind !== "notes") return;

    if (!kind) {
      const measuredField = field as MeasuredNoteField;
      const ancestorPaths = buildAncestorGroupPaths(stream.feature_path);
      uncollectedEntries.push({
        field: measuredField,
        stream,
        ancestorPaths,
        fallbackGroupPath: groupPath,
      });
      ancestorPaths.forEach((ancestorPath) => {
        const fields = ancestorFields.get(ancestorPath) ?? new Set<MeasuredNoteField>();
        fields.add(measuredField);
        ancestorFields.set(ancestorPath, fields);
      });
      return;
    }

    const current = groups.get(groupPath) ?? { groupPath };
    current[field as MeasuredNoteField] = stream;
    groups.set(groupPath, current);
  });

  uncollectedEntries.forEach((entry) => {
    const groupPath =
      [...entry.ancestorPaths]
        .reverse()
        .find((ancestorPath) =>
          isCompleteMeasuredNoteFieldSet(ancestorFields.get(ancestorPath) ?? new Set()),
        ) ?? entry.fallbackGroupPath;
    const current = groups.get(groupPath) ?? { groupPath };
    current[entry.field] = entry.stream;
    groups.set(groupPath, current);
  });

  return [...groups.values()].sort((a, b) => a.groupPath.localeCompare(b.groupPath));
};

const collectArticulationGroups = (
  streams: readonly PtOutputFeature[],
  connectorTargets: readonly string[] = [],
): ScoreArticulationGroup[] => {
  void connectorTargets;
  const groups = new Map<string, ScoreArticulationGroup>();
  streams.forEach((stream) => {
    const field = parseScoreField(stream.feature_path);
    if (!field || !ARTICULATION_FIELDS.has(field as ScoreDecorationField)) return;
    const { kind, groupPath } = parseCollectorContext(stream.feature_path);
    if (kind !== "articulations") return;
    const current = groups.get(groupPath) ?? { groupPath };
    current[field as keyof Omit<ScoreArticulationGroup, "groupPath">] = stream;
    groups.set(groupPath, current);
  });
  return [...groups.values()].sort((a, b) => a.groupPath.localeCompare(b.groupPath));
};

const collectSlurGroups = (
  streams: readonly PtOutputFeature[],
  connectorTargets: readonly string[] = [],
): ScoreSlurGroup[] => {
  void connectorTargets;
  const groups = new Map<string, ScoreSlurGroup>();
  streams.forEach((stream) => {
    const field = parseScoreField(stream.feature_path);
    if (!field || !SLUR_FIELDS.has(field as ScoreDecorationField)) return;
    const { kind, groupPath } = parseCollectorContext(stream.feature_path);
    if (kind !== "slurs") return;
    const current = groups.get(groupPath) ?? { groupPath };
    current[field as keyof Omit<ScoreSlurGroup, "groupPath">] = stream;
    groups.set(groupPath, current);
  });
  return [...groups.values()].sort((a, b) => a.groupPath.localeCompare(b.groupPath));
};

const collectMeterGroups = (
  streams: readonly PtOutputFeature[],
  connectorTargets: readonly string[] = [],
): ScoreMeterGroup[] => {
  void connectorTargets;
  return collectSemanticLayerGroups<keyof Omit<ScoreMeterGroup, "groupPath">, ScoreMeterGroup>(
    streams,
    METER_FIELDS,
    "meter",
    ["meterTimeTick", "beats", "beatType"],
  );
};

const collectPartGroups = (
  streams: readonly PtOutputFeature[],
  connectorTargets: readonly string[] = [],
): ScorePartGroup[] => {
  void connectorTargets;
  return collectSemanticLayerGroups<keyof Omit<ScorePartGroup, "groupPath">, ScorePartGroup>(
    streams,
    PART_FIELDS,
    "parts",
    ["part", "staffCount"],
  );
};

const collectClefGroups = (
  streams: readonly PtOutputFeature[],
  connectorTargets: readonly string[] = [],
): ScoreClefGroup[] => {
  void connectorTargets;
  return collectSemanticLayerGroups<keyof Omit<ScoreClefGroup, "groupPath">, ScoreClefGroup>(
    streams,
    CLEF_FIELDS,
    "clefs",
    ["clefTimeTick", "part", "staff", "clefSignCode", "clefLine"],
  );
};

const collectTempoGroups = (
  streams: readonly PtOutputFeature[],
  connectorTargets: readonly string[] = [],
): ScoreTempoGroup[] => {
  void connectorTargets;
  return collectSemanticLayerGroups<keyof Omit<ScoreTempoGroup, "groupPath">, ScoreTempoGroup>(
    streams,
    TEMPO_FIELDS,
    "tempo",
    ["tempoTimeTick", "tempoBpm"],
  );
};

const collectKeyGroups = (
  streams: readonly PtOutputFeature[],
  connectorTargets: readonly string[] = [],
): ScoreKeyGroup[] => {
  void connectorTargets;
  return collectSemanticLayerGroups<keyof Omit<ScoreKeyGroup, "groupPath">, ScoreKeyGroup>(
    streams,
    KEY_FIELDS,
    "key",
    ["keyTimeTick", "keyFifths"],
  );
};

const groupValueCount = (group: MeasuredNoteGroup): number =>
  Math.max(
    group.measure?.data.length ?? 0,
    group.eventId?.data.length ?? 0,
    group.time?.data.length ?? 0,
    group.timeTick?.data.length ?? 0,
    group.onset?.data.length ?? 0,
    group.duration?.data.length ?? 0,
    group.durationTick?.data.length ?? 0,
    group.pitch?.data.length ?? 0,
    group.velocity?.data.length ?? 0,
    group.dynamicCode?.data.length ?? 0,
    group.voice?.data.length ?? 0,
    group.staff?.data.length ?? 0,
    group.part?.data.length ?? 0,
  );

const eventKey = (value: unknown): string | null =>
  isFiniteNumber(value) ? String(Math.round(value)) : null;

const collectArticulationsByEvent = (
  streams: readonly PtOutputFeature[],
  diagnostics: ScoreBuildResult["diagnostics"],
  connectorTargets: readonly string[] = [],
): Map<string, ScoreArticulationEvent[]> => {
  const byEvent = new Map<string, ScoreArticulationEvent[]>();
  collectArticulationGroups(streams, connectorTargets).forEach((group) => {
    const count = Math.max(
      group.eventId?.data.length ?? 0,
      group.articulationCode?.data.length ?? 0,
      group.placement?.data.length ?? 0,
    );
    for (let index = 0; index < count; index += 1) {
      const key = eventKey(group.eventId?.data[index]);
      const articulationCode = group.articulationCode?.data[index];
      if (!key || !isFiniteNumber(articulationCode)) {
        diagnostics.push(
          scoreDiagnostic(
            "warning",
            "invalid-score-articulation-row",
            `${group.groupPath}: skipped articulation row ${index} because event_id or articulation_code is missing.`,
            group.groupPath,
          ),
        );
        continue;
      }
      const element = resolveArticulationElementName(articulationCode);
      if (!element) {
        diagnostics.push(
          scoreDiagnostic(
            "warning",
            "invalid-score-articulation-code",
            `${group.groupPath}: skipped articulation row ${index} because articulation_code is unsupported.`,
            group.groupPath,
          ),
        );
        continue;
      }
      const placementValue = group.placement?.data[index];
      const articulation: ScoreArticulationEvent = {
        element,
        ...(isFiniteNumber(placementValue)
          ? { placement: resolvePlacement(placementValue) ?? undefined }
          : {}),
        sourcePath: group.articulationCode?.feature_path,
      };
      byEvent.set(key, [...(byEvent.get(key) ?? []), articulation]);
    }
  });
  return byEvent;
};

const collectSlursByEvent = (
  streams: readonly PtOutputFeature[],
  diagnostics: ScoreBuildResult["diagnostics"],
  connectorTargets: readonly string[] = [],
): Map<string, ScoreSlurEvent[]> => {
  const byEvent = new Map<string, ScoreSlurEvent[]>();
  collectSlurGroups(streams, connectorTargets).forEach((group) => {
    const count = Math.max(
      group.eventId?.data.length ?? 0,
      group.slurNumber?.data.length ?? 0,
      group.slurType?.data.length ?? 0,
      group.placement?.data.length ?? 0,
    );
    for (let index = 0; index < count; index += 1) {
      const key = eventKey(group.eventId?.data[index]);
      const slurNumber = group.slurNumber?.data[index];
      const slurType = group.slurType?.data[index];
      if (!key || !isFiniteNumber(slurNumber) || !isFiniteNumber(slurType)) {
        diagnostics.push(
          scoreDiagnostic(
            "warning",
            "invalid-score-slur-row",
            `${group.groupPath}: skipped slur row ${index} because event_id, slur_number, or slur_type is missing.`,
            group.groupPath,
          ),
        );
        continue;
      }
      const type = resolveSlurType(slurType);
      if (!type) {
        diagnostics.push(
          scoreDiagnostic(
            "warning",
            "invalid-score-slur-type",
            `${group.groupPath}: skipped slur row ${index} because slur_type is unsupported.`,
            group.groupPath,
          ),
        );
        continue;
      }
      const placementValue = group.placement?.data[index];
      const slur: ScoreSlurEvent = {
        number: Math.max(1, Math.round(slurNumber)),
        type,
        ...(isFiniteNumber(placementValue)
          ? { placement: resolvePlacement(placementValue) ?? undefined }
          : {}),
        sourcePath: group.slurType?.feature_path,
      };
      byEvent.set(key, [...(byEvent.get(key) ?? []), slur]);
    }
  });
  return byEvent;
};

const maxLayerValueCount = (...streams: Array<PtOutputFeature | undefined>): number =>
  Math.max(...streams.map((stream) => stream?.data.length ?? 0), 0);

const ticksToBeats = (ticks: number): number => ticks / SCORE_TICKS_PER_QUARTER;

const collectMeters = (
  streams: readonly PtOutputFeature[],
  diagnostics: ScoreBuildResult["diagnostics"],
  connectorTargets: readonly string[] = [],
): ScoreMeterEvent[] => {
  const meters: ScoreMeterEvent[] = [];
  collectMeterGroups(streams, connectorTargets).forEach((group) => {
    const count = maxLayerValueCount(group.meterTimeTick, group.beats, group.beatType);
    for (let index = 0; index < count; index += 1) {
      const timeTick = group.meterTimeTick?.data[index];
      const beats = group.beats?.data[index];
      const beatType = group.beatType?.data[index];
      const normalizedBeats = isFiniteNumber(beats) ? Math.round(beats) : Number.NaN;
      const normalizedBeatType = isFiniteNumber(beatType) ? Math.round(beatType) : Number.NaN;
      if (
        !isFiniteNumber(timeTick) ||
        !isFiniteNumber(beats) ||
        normalizedBeats <= 0 ||
        !isFiniteNumber(beatType) ||
        !SUPPORTED_SCORE_BEAT_TYPES.has(normalizedBeatType)
      ) {
        diagnostics.push(
          scoreDiagnostic(
            "warning",
            "invalid-score-meter-row",
            `${group.groupPath}: skipped meter row ${index} because time_tick, beats, or beat_type is missing or unsupported.`,
            group.groupPath,
          ),
        );
        continue;
      }
      meters.push({
        time: ticksToBeats(timeTick),
        beats: normalizedBeats,
        beatType: normalizedBeatType,
        sourcePath: group.meterTimeTick?.feature_path,
      });
    }
  });
  return meters;
};

const collectParts = (
  streams: readonly PtOutputFeature[],
  diagnostics: ScoreBuildResult["diagnostics"],
  connectorTargets: readonly string[] = [],
): ScorePartEvent[] => {
  const parts: ScorePartEvent[] = [];
  collectPartGroups(streams, connectorTargets).forEach((group) => {
    const count = maxLayerValueCount(group.part, group.staffCount);
    for (let index = 0; index < count; index += 1) {
      const part = group.part?.data[index];
      if (!isFiniteNumber(part)) {
        diagnostics.push(
          scoreDiagnostic(
            "warning",
            "invalid-score-part-row",
            `${group.groupPath}: skipped part row ${index} because part is missing.`,
            group.groupPath,
          ),
        );
        continue;
      }
      const staffCount = group.staffCount?.data[index];
      parts.push({
        part: Math.max(1, Math.round(part)),
        ...(isFiniteNumber(staffCount) ? { staffCount: Math.max(1, Math.round(staffCount)) } : {}),
        sourcePath: group.part?.feature_path,
      });
    }
  });
  return parts;
};

const collectClefs = (
  streams: readonly PtOutputFeature[],
  diagnostics: ScoreBuildResult["diagnostics"],
  connectorTargets: readonly string[] = [],
): ScoreClefEvent[] => {
  const clefs: ScoreClefEvent[] = [];
  collectClefGroups(streams, connectorTargets).forEach((group) => {
    const count = maxLayerValueCount(
      group.clefTimeTick,
      group.part,
      group.staff,
      group.clefSignCode,
      group.clefLine,
    );
    for (let index = 0; index < count; index += 1) {
      const timeTick = group.clefTimeTick?.data[index];
      const part = group.part?.data[index];
      const staff = group.staff?.data[index];
      const signCode = group.clefSignCode?.data[index];
      const line = group.clefLine?.data[index];
      const sign = isFiniteNumber(signCode) ? resolveClefSign(signCode) : null;
      const clef = sign && isFiniteNumber(line) ? normalizeRenderableClef(sign, line) : null;
      if (!isFiniteNumber(timeTick) || !isFiniteNumber(part) || !isFiniteNumber(staff) || !clef) {
        diagnostics.push(
          scoreDiagnostic(
            "warning",
            "invalid-score-clef-row",
            `${group.groupPath}: skipped clef row ${index} because time_tick, part, staff, clef_sign_code, or clef_line is missing or unsupported.`,
            group.groupPath,
          ),
        );
        continue;
      }
      if (clef.normalized) {
        diagnostics.push(
          scoreDiagnostic(
            "warning",
            "normalized-score-clef-row",
            `${group.groupPath}: normalized clef row ${index} to ${clef.sign}${clef.line} because the requested clef is not supported by the score renderer.`,
            group.groupPath,
          ),
        );
      }
      clefs.push({
        time: ticksToBeats(timeTick),
        part: Math.max(1, Math.round(part)),
        staff: Math.max(1, Math.round(staff)),
        sign: clef.sign,
        line: clef.line,
        sourcePath: group.clefTimeTick?.feature_path,
      });
    }
  });
  return clefs;
};

const collectTempos = (
  streams: readonly PtOutputFeature[],
  diagnostics: ScoreBuildResult["diagnostics"],
  connectorTargets: readonly string[] = [],
): ScoreTempoEvent[] => {
  const tempos: ScoreTempoEvent[] = [];
  collectTempoGroups(streams, connectorTargets).forEach((group) => {
    const count = maxLayerValueCount(group.tempoTimeTick, group.tempoBpm);
    for (let index = 0; index < count; index += 1) {
      const timeTick = group.tempoTimeTick?.data[index];
      const bpm = group.tempoBpm?.data[index];
      if (!isFiniteNumber(timeTick) || !isFiniteNumber(bpm)) {
        diagnostics.push(
          scoreDiagnostic(
            "warning",
            "invalid-score-tempo-row",
            `${group.groupPath}: skipped tempo row ${index} because time_tick or bpm is missing.`,
            group.groupPath,
          ),
        );
        continue;
      }
      tempos.push({ time: ticksToBeats(timeTick), bpm, sourcePath: group.tempoBpm?.feature_path });
    }
  });
  return tempos;
};

const collectKeys = (
  streams: readonly PtOutputFeature[],
  diagnostics: ScoreBuildResult["diagnostics"],
  connectorTargets: readonly string[] = [],
): ScoreKeyEvent[] => {
  const keys: ScoreKeyEvent[] = [];
  collectKeyGroups(streams, connectorTargets).forEach((group) => {
    const count = maxLayerValueCount(
      group.keyTimeTick,
      group.keyFifths,
      group.keyModeCode,
      group.part,
    );
    for (let index = 0; index < count; index += 1) {
      const timeTick = group.keyTimeTick?.data[index];
      const fifths = group.keyFifths?.data[index];
      const normalizedFifths = isFiniteNumber(fifths) ? Math.round(fifths) : Number.NaN;
      if (
        !isFiniteNumber(timeTick) ||
        !isFiniteNumber(fifths) ||
        normalizedFifths < -7 ||
        normalizedFifths > 7
      ) {
        diagnostics.push(
          scoreDiagnostic(
            "warning",
            "invalid-score-key-row",
            `${group.groupPath}: skipped key row ${index} because time_tick or fifths is missing or unsupported.`,
            group.groupPath,
          ),
        );
        continue;
      }
      const modeCode = group.keyModeCode?.data[index];
      const resolvedMode = isFiniteNumber(modeCode) ? resolveKeyMode(modeCode) : null;
      const mode = normalizeRenderableKeyMode(resolvedMode);
      if (resolvedMode && !mode) {
        diagnostics.push(
          scoreDiagnostic(
            "warning",
            "unsupported-score-key-mode",
            `${group.groupPath}: omitted key mode '${resolvedMode}' at row ${index} because the score renderer does not support it reliably.`,
            group.groupPath,
          ),
        );
      }
      const part = group.part?.data[index];
      keys.push({
        time: ticksToBeats(timeTick),
        fifths: normalizedFifths,
        ...(mode ? { mode } : {}),
        ...(isFiniteNumber(part) ? { part: Math.max(1, Math.round(part)) } : {}),
        sourcePath: group.keyTimeTick?.feature_path,
      });
    }
  });
  return keys;
};

export const buildScoreFromMeasuredNoteStreams = (
  streams: readonly PtOutputFeature[],
  connectorTargets: readonly string[] = [],
): ScoreBuildResult | null => {
  if (!hasMeasuredNoteStreams(streams, connectorTargets)) return null;

  const diagnostics: ScoreBuildResult["diagnostics"] = [];
  const events: ScoreNoteEvent[] = [];
  const groups = collectGroups(streams, connectorTargets);
  const articulationsByEvent = collectArticulationsByEvent(streams, diagnostics, connectorTargets);
  const slursByEvent = collectSlursByEvent(streams, diagnostics, connectorTargets);
  const meters = collectMeters(streams, diagnostics, connectorTargets);
  const parts = collectParts(streams, diagnostics, connectorTargets);
  const clefs = collectClefs(streams, diagnostics, connectorTargets);
  const tempos = collectTempos(streams, diagnostics, connectorTargets);
  const keys = collectKeys(streams, diagnostics, connectorTargets);

  groups.forEach((group) => {
    const hasTickTime = Boolean(group.timeTick && group.durationTick);
    const missing = [
      ...(!hasTickTime ? ["onset_tick + duration_tick"] : []),
      ...(!group.pitch ? ["pitch_midi"] : []),
    ];
    if (missing.length > 0) {
      diagnostics.push(
        scoreDiagnostic(
          "warning",
          "missing-measured-note-stream",
          `${group.groupPath}: missing ${missing.join(", ")}.`,
          group.groupPath,
        ),
      );
      return;
    }

    for (let index = 0; index < groupValueCount(group); index += 1) {
      const timeTick = group.timeTick?.data[index];
      const durationTick = group.durationTick?.data[index];
      const pitch = group.pitch?.data[index];
      const key = eventKey(group.eventId?.data[index]);
      let noteTime: number | null = null;
      let noteDuration: number | null = null;

      if (isFiniteNumber(timeTick) && isFiniteNumber(durationTick)) {
        noteTime = ticksToBeats(timeTick);
        noteDuration = ticksToBeats(durationTick);
      }

      if (!isFiniteNumber(noteTime) || !isFiniteNumber(noteDuration) || !isFiniteNumber(pitch)) {
        diagnostics.push(
          scoreDiagnostic(
            "warning",
            "missing-measured-note-value",
            `${group.groupPath}: skipped row ${index} because a required value is missing.`,
            group.groupPath,
          ),
        );
        continue;
      }

      if (noteTime < 0 || noteDuration <= 0) {
        diagnostics.push(
          scoreDiagnostic(
            "warning",
            "invalid-measured-note-value",
            `${group.groupPath}: skipped row ${index} because time/duration is invalid.`,
            group.groupPath,
          ),
        );
        continue;
      }

      const velocity = group.velocity?.data[index];
      const dynamicCode = group.dynamicCode?.data[index];
      const voice = group.voice?.data[index];
      const staff = group.staff?.data[index];
      const part = group.part?.data[index];

      events.push({
        pitch,
        ...(key ? { eventId: Number(key) } : {}),
        time: noteTime,
        duration: noteDuration,
        ...(isFiniteNumber(velocity) ? { velocity } : {}),
        ...(isFiniteNumber(dynamicCode) ? { dynamicCode } : {}),
        ...(isFiniteNumber(voice) ? { voice } : {}),
        ...(isFiniteNumber(staff) ? { staff } : {}),
        ...(isFiniteNumber(part) ? { part } : {}),
        ...(key && articulationsByEvent.has(key)
          ? { articulations: articulationsByEvent.get(key) }
          : {}),
        ...(key && slursByEvent.has(key) ? { slurs: slursByEvent.get(key) } : {}),
        sourcePaths: [
          group.eventId?.feature_path,
          group.timeTick?.feature_path,
          group.durationTick?.feature_path,
          group.time?.feature_path,
          group.measure?.feature_path,
          group.onset?.feature_path,
          group.duration?.feature_path,
          group.pitch?.feature_path,
          group.velocity?.feature_path,
          group.dynamicCode?.feature_path,
          group.voice?.feature_path,
          group.staff?.feature_path,
          group.part?.feature_path,
        ].filter((path): path is string => Boolean(path)),
      });
    }
  });

  const result = buildScoreFromNoteEvents(events, {
    adapterId: SCORE_MEASURED_NOTES_ADAPTER_ID,
    streamCount: streams.length,
    divisions: SCORE_TICKS_PER_QUARTER,
    meters,
    parts,
    clefs,
    tempos,
    keys,
  });

  return {
    ...result,
    diagnostics: [...diagnostics, ...result.diagnostics],
  };
};
