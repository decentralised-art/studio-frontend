import {
  TONE_WORLD_ACCEPTED_SCALARS,
  TONE_WORLD_AUDIO_REQUIRED_SCALARS,
  TONE_WORLD_REQUIRED_SCALARS,
  TONE_WORLD_VISUAL_REQUIRED_SCALARS,
  type ToneWorldMaterials,
  type ToneWorldMaterialStream,
  type ToneWorldScalar,
  type ToneWorldStream,
} from "./types";

const SCALAR_SET = new Set<string>(TONE_WORLD_ACCEPTED_SCALARS);

const parsePathSegments = (path: string): string[] =>
  path
    .trim()
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

export const normalizeToneWorldPathSegmentName = (segment: string): string =>
  segment.split(":")[0]?.trim().toLowerCase() ?? "";

export const parseToneWorldGroupPath = (path: string): string => {
  const segments = parsePathSegments(path);
  if (segments.length <= 1) return "/";
  return `/${segments.slice(0, -1).join("/")}`;
};

export const parseToneWorldScalar = (path: string): ToneWorldScalar | null => {
  const segments = parsePathSegments(path);
  const leaf = normalizeToneWorldPathSegmentName(segments.at(-1) ?? "");
  return SCALAR_SET.has(leaf) ? (leaf as ToneWorldScalar) : null;
};

const createEmptyMaterials = (): ToneWorldMaterials => ({
  onsetTick: [],
  durationTick: [],
  pitchMidi: [],
  durationSecond: [],
  rhythmDurationSecond: [],
  rhythmDistanceSecond: [],
  sampleSet: [],
  sampleIndex: [],
  velocity: [],
  tempoBpm: [],
  controlValue: [],
  controlTimeSecond: [],
  visualMaterial: [],
  imageIndex: [],
  visualVariant: [],
  colorR: [],
  colorG: [],
  colorB: [],
  shapeSides: [],
  reactivity: [],
});

const appendMaterial = (materials: ToneWorldMaterials, stream: ToneWorldMaterialStream) => {
  if (stream.scalar === "onset_tick") materials.onsetTick.push(stream);
  if (stream.scalar === "duration_tick") materials.durationTick.push(stream);
  if (stream.scalar === "pitch_midi") materials.pitchMidi.push(stream);
  if (stream.scalar === "velocity_midi") materials.velocity.push(stream);
  if (stream.scalar === "tempo_bpm") materials.tempoBpm.push(stream);
  if (stream.scalar === "tone_duration_second") materials.durationSecond.push(stream);
  if (stream.scalar === "tone_rhythm_duration_second") materials.rhythmDurationSecond.push(stream);
  if (stream.scalar === "tone_rhythm_distance_second") materials.rhythmDistanceSecond.push(stream);
  if (stream.scalar === "tone_sample_set") materials.sampleSet.push(stream);
  if (stream.scalar === "tone_sample_index") materials.sampleIndex.push(stream);
  if (stream.scalar === "tone_velocity") materials.velocity.push(stream);
  if (stream.scalar === "tone_control_value") materials.controlValue.push(stream);
  if (stream.scalar === "tone_control_time_second") materials.controlTimeSecond.push(stream);
  if (stream.scalar === "tone_visual_material") materials.visualMaterial.push(stream);
  if (stream.scalar === "tone_image_index") materials.imageIndex.push(stream);
  if (stream.scalar === "tone_visual_variant") materials.visualVariant.push(stream);
  if (stream.scalar === "tone_color_r") materials.colorR.push(stream);
  if (stream.scalar === "tone_color_g") materials.colorG.push(stream);
  if (stream.scalar === "tone_color_b") materials.colorB.push(stream);
  if (stream.scalar === "tone_shape_sides") materials.shapeSides.push(stream);
  if (stream.scalar === "tone_reactivity") materials.reactivity.push(stream);
};

export const parseToneWorldMaterials = (
  streams: readonly ToneWorldStream[] = [],
): ToneWorldMaterials => {
  const materials = createEmptyMaterials();
  streams.forEach((stream) => {
    const scalar = parseToneWorldScalar(stream.path);
    if (!scalar) return;
    appendMaterial(materials, {
      path: stream.path,
      data: stream.data.filter((value) => Number.isFinite(value)),
      scalar,
    });
  });
  return materials;
};

export const flattenToneWorldStreams = (streams: readonly ToneWorldMaterialStream[]): number[] =>
  streams.flatMap((stream) => stream.data).filter((value) => Number.isFinite(value));

export const countToneWorldMaterialValues = (materials: ToneWorldMaterials): number =>
  Object.values(materials).reduce(
    (count, streams) =>
      count + streams.reduce((streamCount, stream) => streamCount + stream.data.length, 0),
    0,
  );

const collectPresentToneWorldScalarsFromStreams = (
  streams: readonly ToneWorldStream[] = [],
): Set<ToneWorldScalar> => {
  const presentScalars = new Set<ToneWorldScalar>();
  streams.forEach((stream) => {
    if (stream.data.length === 0) return;
    const scalar = parseToneWorldScalar(stream.path);
    if (scalar) presentScalars.add(scalar);
  });
  return presentScalars;
};

const getMissingToneWorldScalars = (
  presentScalars: ReadonlySet<ToneWorldScalar>,
  requiredScalars: readonly string[],
): string[] => requiredScalars.filter((scalar) => !presentScalars.has(scalar as ToneWorldScalar));

export type ToneWorldLayerCompatibility = {
  hasAudioLayer: boolean;
  hasVisualLayer: boolean;
  hasAnyLayer: boolean;
  missingAudioScalars: string[];
  missingVisualScalars: string[];
};

export const getToneWorldLayerCompatibilityFromStreams = (
  streams: readonly ToneWorldStream[] = [],
): ToneWorldLayerCompatibility => {
  const presentScalars = collectPresentToneWorldScalarsFromStreams(streams);
  const missingAudioScalars = getMissingToneWorldScalars(
    presentScalars,
    TONE_WORLD_AUDIO_REQUIRED_SCALARS,
  );
  const missingVisualScalars = getMissingToneWorldScalars(
    presentScalars,
    TONE_WORLD_VISUAL_REQUIRED_SCALARS,
  );
  const hasAudioLayer = missingAudioScalars.length === 0;
  const hasVisualLayer = missingVisualScalars.length === 0;
  return {
    hasAudioLayer,
    hasVisualLayer,
    hasAnyLayer: hasAudioLayer || hasVisualLayer,
    missingAudioScalars,
    missingVisualScalars,
  };
};

export const getMissingRequiredToneWorldScalarsFromStreams = (
  streams: readonly ToneWorldStream[] = [],
): string[] => {
  const presentScalars = collectPresentToneWorldScalarsFromStreams(streams);
  return getMissingToneWorldScalars(presentScalars, TONE_WORLD_REQUIRED_SCALARS);
};

export const hasRequiredToneWorldScalarsFromStreams = (
  streams: readonly ToneWorldStream[] = [],
): boolean => getMissingRequiredToneWorldScalarsFromStreams(streams).length === 0;

export const hasRenderableToneWorldLayerFromStreams = (
  streams: readonly ToneWorldStream[] = [],
): boolean => getToneWorldLayerCompatibilityFromStreams(streams).hasAnyLayer;
