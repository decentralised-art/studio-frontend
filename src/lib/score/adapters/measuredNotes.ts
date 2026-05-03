import type { PtOutputFeature } from "$lib/particles/ptMidiAdapter";
import { buildScoreFromNoteEvents } from "$lib/score/adapters/noteEvents";
import {
  resolveArticulationElementName,
  resolvePlacement,
  resolveSlurType,
} from "$lib/score/codebook";
import { scoreDiagnostic } from "$lib/score/diagnostics";
import type {
  ScoreArticulationEvent,
  ScoreBuildResult,
  ScoreNoteEvent,
  ScoreSlurEvent,
} from "$lib/score/types";
import { normalizePluginPathSegmentName } from "$lib/studio/plugins/runtime";

export const SCORE_MEASURED_NOTES_ADAPTER_ID = "music-measured-notes-v1";

const BEATS_PER_MEASURE = 4;

type MeasuredNoteField =
  | "eventId"
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

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const parsePathSegments = (path: string): string[] =>
  path
    .trim()
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

const normalizeMeasuredFieldLeaf = (leaf: string): string =>
  leaf.startsWith("score_") ? leaf.slice("score_".length) : leaf;

const parseScoreField = (path: string): MeasuredNoteField | ScoreDecorationField | null => {
  const segments = parsePathSegments(path);
  const leaf = normalizeMeasuredFieldLeaf(
    normalizePluginPathSegmentName(segments[segments.length - 1] ?? ""),
  );
  if (leaf === "event_id" || leaf === "eventid") return "eventId";
  if (leaf === "measure" || leaf === "bar") return "measure";
  if (leaf === "onset" || leaf === "beat" || leaf === "time_in_measure") return "onset";
  if (leaf === "duration" || leaf === "durationv2") return "duration";
  if (leaf === "pitch") return "pitch";
  if (leaf === "velocity") return "velocity";
  if (leaf === "dynamic_code" || leaf === "dynamic") return "dynamicCode";
  if (leaf === "voice") return "voice";
  if (leaf === "staff") return "staff";
  if (leaf === "part") return "part";
  if (leaf === "articulation_code" || leaf === "articulation") return "articulationCode";
  if (leaf === "placement") return "placement";
  if (leaf === "slur_number" || leaf === "slur") return "slurNumber";
  if (leaf === "slur_type" || leaf === "type") return "slurType";
  return null;
};

const NOTE_FIELDS = new Set<MeasuredNoteField>([
  "eventId",
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

const NOTE_COLLECTOR_NAMES = new Set([
  "score_notes_v1",
  "score_notes",
  "score_note",
  "notes",
  "note",
]);
const ARTICULATION_COLLECTOR_NAMES = new Set([
  "score_articulations_v1",
  "score_articulations",
  "articulations",
  "articulation",
]);
const SLUR_COLLECTOR_NAMES = new Set(["score_slurs_v1", "score_slurs", "slurs", "slur"]);

type ScoreCollectorKind = "notes" | "articulations" | "slurs";

const collectorKindForSegment = (segment: string): ScoreCollectorKind | null => {
  const name = normalizePluginPathSegmentName(segment);
  if (NOTE_COLLECTOR_NAMES.has(name)) return "notes";
  if (ARTICULATION_COLLECTOR_NAMES.has(name)) return "articulations";
  if (SLUR_COLLECTOR_NAMES.has(name)) return "slurs";
  return null;
};

const parseCollectorContext = (
  path: string,
): { kind: ScoreCollectorKind | null; groupPath: string } => {
  const segments = parsePathSegments(path);
  const fieldIndex = segments.length - 1;
  for (let index = fieldIndex - 1; index >= 0; index -= 1) {
    const kind = collectorKindForSegment(segments[index] ?? "");
    if (kind) return { kind, groupPath: `/${segments.slice(0, index + 1).join("/")}` };
  }
  if (segments.length <= 1) return { kind: null, groupPath: "/" };
  return { kind: null, groupPath: `/${segments.slice(0, -1).join("/")}` };
};

export const hasMeasuredNoteStreams = (streams: readonly PtOutputFeature[]): boolean => {
  const fields = new Set(streams.map((stream) => parseScoreField(stream.feature_path)));
  return (
    fields.has("measure") && fields.has("onset") && fields.has("duration") && fields.has("pitch")
  );
};

const collectGroups = (streams: readonly PtOutputFeature[]): MeasuredNoteGroup[] => {
  const groups = new Map<string, MeasuredNoteGroup>();
  streams.forEach((stream) => {
    const field = parseScoreField(stream.feature_path);
    if (!field || !NOTE_FIELDS.has(field as MeasuredNoteField)) return;
    const { kind, groupPath } = parseCollectorContext(stream.feature_path);
    if (kind && kind !== "notes") return;
    const current = groups.get(groupPath) ?? { groupPath };
    current[field as MeasuredNoteField] = stream;
    groups.set(groupPath, current);
  });
  return [...groups.values()].sort((a, b) => a.groupPath.localeCompare(b.groupPath));
};

const collectArticulationGroups = (
  streams: readonly PtOutputFeature[],
): ScoreArticulationGroup[] => {
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

const collectSlurGroups = (streams: readonly PtOutputFeature[]): ScoreSlurGroup[] => {
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

const groupValueCount = (group: MeasuredNoteGroup): number =>
  Math.max(
    group.measure?.data.length ?? 0,
    group.eventId?.data.length ?? 0,
    group.onset?.data.length ?? 0,
    group.duration?.data.length ?? 0,
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
): Map<string, ScoreArticulationEvent[]> => {
  const byEvent = new Map<string, ScoreArticulationEvent[]>();
  collectArticulationGroups(streams).forEach((group) => {
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
): Map<string, ScoreSlurEvent[]> => {
  const byEvent = new Map<string, ScoreSlurEvent[]>();
  collectSlurGroups(streams).forEach((group) => {
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

export const buildScoreFromMeasuredNoteStreams = (
  streams: readonly PtOutputFeature[],
): ScoreBuildResult | null => {
  if (!hasMeasuredNoteStreams(streams)) return null;

  const diagnostics: ScoreBuildResult["diagnostics"] = [];
  const events: ScoreNoteEvent[] = [];
  const groups = collectGroups(streams);
  const articulationsByEvent = collectArticulationsByEvent(streams, diagnostics);
  const slursByEvent = collectSlursByEvent(streams, diagnostics);

  groups.forEach((group) => {
    const missing = (["measure", "onset", "duration", "pitch"] as const).filter(
      (field) => !group[field],
    );
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
      const measure = group.measure?.data[index];
      const onset = group.onset?.data[index];
      const duration = group.duration?.data[index];
      const pitch = group.pitch?.data[index];
      const key = eventKey(group.eventId?.data[index]);

      if (
        !isFiniteNumber(measure) ||
        !isFiniteNumber(onset) ||
        !isFiniteNumber(duration) ||
        !isFiniteNumber(pitch)
      ) {
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

      if (measure < 1 || onset < 0 || duration <= 0) {
        diagnostics.push(
          scoreDiagnostic(
            "warning",
            "invalid-measured-note-value",
            `${group.groupPath}: skipped row ${index} because measure/onset/duration is invalid.`,
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
        time: (Math.round(measure) - 1) * BEATS_PER_MEASURE + onset,
        duration,
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
          group.measure?.feature_path,
          group.onset?.feature_path,
          group.duration?.feature_path,
          group.pitch?.feature_path,
        ].filter((path): path is string => Boolean(path)),
      });
    }
  });

  const result = buildScoreFromNoteEvents(events, {
    adapterId: SCORE_MEASURED_NOTES_ADAPTER_ID,
    streamCount: streams.length,
  });

  return {
    ...result,
    diagnostics: [...diagnostics, ...result.diagnostics],
  };
};
