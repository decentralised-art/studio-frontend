import {
  clampNumber,
  createDefaultToneAddress,
  createToneWorldRandom,
  midiToToneRowFrequency,
  randomIntInclusive,
  wrapInteger,
} from "./address";
import {
  flattenToneWorldStreams,
  parseToneWorldGroupPath,
  parseToneWorldMaterials,
} from "./materials";
import {
  TONE_WORLD_MAX_MACRO_DURATION_SECONDS,
  TONE_WORLD_MIN_MACRO_DURATION_SECONDS,
  TONE_WORLD_ROW_SIZE,
  type ToneAddress,
  type ToneWorldMaterials,
  type ToneWorldMaterialStream,
  type ToneWorldStream,
} from "./types";

const SCORE_TICKS_PER_QUARTER = 2520;
const DEFAULT_TONE_WORLD_BPM = 120;

const takeCycled = (values: readonly number[], length: number): number[] => {
  if (values.length === 0) return [];
  return Array.from({ length }, (_, index) => values[index % values.length]);
};

const normalizeDurations = (values: readonly number[]) =>
  values
    .map((value) => clampNumber(value, 0.05, 60))
    .filter((value) => Number.isFinite(value) && value > 0);

const normalizePitchMidi = (values: readonly number[]) =>
  values.filter((value) => Number.isFinite(value)).map((value) => midiToToneRowFrequency(value));

const normalizeVelocity = (values: readonly number[]) =>
  values.map((value) => {
    const scaled = value > 1 ? value / 127 : value;
    return clampNumber(scaled, 0.05, 1);
  });

const normalizeTempoBpm = (values: readonly number[]) => {
  const tempo = values.find((value) => Number.isFinite(value) && value > 0);
  return tempo ? clampNumber(tempo, 10, 300) : DEFAULT_TONE_WORLD_BPM;
};

const ticksToSeconds = (ticks: number, tempoBpm: number): number =>
  (ticks / SCORE_TICKS_PER_QUARTER) * (60 / tempoBpm);

const normalizeTickDurations = (values: readonly number[], tempoBpm: number): number[] =>
  normalizeDurations(
    values
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => ticksToSeconds(value, tempoBpm)),
  );

const normalizeOnsetDistances = (values: readonly number[], tempoBpm: number): number[] => {
  let previous = 0;
  const distances: number[] = [];
  values
    .filter((value) => Number.isFinite(value))
    .forEach((value) => {
      const distance = value - previous;
      if (distance > 0) distances.push(distance);
      previous = value;
    });
  return normalizeTickDurations(distances, tempoBpm);
};

const groupStreams = (
  streams: readonly ToneWorldMaterialStream[],
): Array<{ groupPath: string; values: number[] }> => {
  const groups = new Map<string, number[]>();
  streams.forEach((stream) => {
    const groupPath = parseToneWorldGroupPath(stream.path);
    const current = groups.get(groupPath) ?? [];
    current.push(...stream.data);
    groups.set(groupPath, current);
  });
  return [...groups.entries()]
    .map(([groupPath, values]) => ({ groupPath, values }))
    .sort((a, b) => a.groupPath.localeCompare(b.groupPath));
};

const hashDurationPools = (pools: readonly (readonly number[])[]): number =>
  pools.reduce((hash, pool) => {
    const poolHash = pool.reduce((current, value) => {
      const quantized = Math.trunc(value * 1000);
      return Math.imul((current ^ quantized) >>> 0, 16_777_619) >>> 0;
    }, hash);
    return Math.imul((poolHash ^ pool.length) >>> 0, 16_777_619) >>> 0;
  }, 2_166_136_261);

const createMacroDurationSeconds = (
  seed: number,
  pools: readonly (readonly number[])[],
): number => {
  const materialHash = hashDurationPools(pools);
  const random = createToneWorldRandom((Math.trunc(seed) ^ materialHash) >>> 0);
  return randomIntInclusive(
    random,
    TONE_WORLD_MIN_MACRO_DURATION_SECONDS,
    TONE_WORLD_MAX_MACRO_DURATION_SECONDS,
  );
};

const groupedPitchPools = (materials: ToneWorldMaterials): number[][] =>
  groupStreams(materials.pitchMidi)
    .map((group) => normalizePitchMidi(group.values))
    .filter((pool) => pool.length > 0);

const groupedDurationPools = (
  materials: ToneWorldMaterials,
  tempoBpm: number,
): { pools: number[][]; usesScoreTicks: boolean } => {
  const secondsPools = groupStreams([
    ...materials.durationSecond,
    ...materials.rhythmDurationSecond,
    ...materials.rhythmDistanceSecond,
  ])
    .map((group) => normalizeDurations(group.values))
    .filter((pool) => pool.length > 0);
  const durationTickPools = groupStreams(materials.durationTick)
    .map((group) => normalizeTickDurations(group.values, tempoBpm))
    .filter((pool) => pool.length > 0);

  if (durationTickPools.length > 0) {
    return { pools: [...secondsPools, ...durationTickPools], usesScoreTicks: true };
  }

  const onsetDistancePools = groupStreams(materials.onsetTick)
    .map((group) => normalizeOnsetDistances(group.values, tempoBpm))
    .filter((pool) => pool.length > 0);
  return {
    pools: [...secondsPools, ...onsetDistancePools],
    usesScoreTicks: onsetDistancePools.length > 0,
  };
};

const applyExplicitVisualScalars = (address: ToneAddress, materials: ToneWorldMaterials) => {
  const imageIndex = flattenToneWorldStreams(materials.imageIndex);
  if (imageIndex.length > 0) address.imageIndex = wrapInteger(imageIndex[0], 0, 2);

  const visualVariant = flattenToneWorldStreams(materials.visualVariant);
  if (visualVariant.length > 0) address.visualSet = wrapInteger(visualVariant[0], 1, 5);

  const colorR = flattenToneWorldStreams(materials.colorR);
  const colorG = flattenToneWorldStreams(materials.colorG);
  const colorB = flattenToneWorldStreams(materials.colorB);
  address.colors = [
    colorR.length > 0 ? clampNumber(colorR[0], 0, 2.5) : address.colors[0],
    colorG.length > 0 ? clampNumber(colorG[0], 0, 2.5) : address.colors[1],
    colorB.length > 0 ? clampNumber(colorB[0], 0, 2.5) : address.colors[2],
  ];

  const shapeSides = flattenToneWorldStreams(materials.shapeSides);
  if (shapeSides.length > 0) address.visualShape = wrapInteger(shapeSides[0], 3, 9);

  const reactivity = flattenToneWorldStreams(materials.reactivity);
  if (reactivity.length > 0) address.reactivity = clampNumber(reactivity[0], 0, 8);
};

const applyVisualMaterial = (address: ToneAddress, visualValues: readonly number[]) => {
  if (visualValues.length === 0) return;
  const valueAt = (index: number, fallback: number) => visualValues[index] ?? fallback;

  address.imageIndex = wrapInteger(valueAt(0, address.imageIndex), 0, 2);
  address.visualSet = wrapInteger(valueAt(1, address.visualSet), 1, 5);
  address.colors = [
    clampNumber(valueAt(2, address.colors[0]), 0, 2.5),
    clampNumber(valueAt(3, address.colors[1]), 0, 2.5),
    clampNumber(valueAt(4, address.colors[2]), 0, 2.5),
  ];
  address.visualShape = wrapInteger(valueAt(5, address.visualShape), 3, 9);
  address.visualSetting1 = wrapInteger(valueAt(6, address.visualSetting1), 3, 15);
  address.visualSetting2 = wrapInteger(valueAt(7, address.visualSetting2), 1, 30);
  address.visualSetting3 = wrapInteger(valueAt(8, address.visualSetting3), 1, 5);
  address.bigNumber = wrapInteger(valueAt(9, address.bigNumber), 1, 100);
  address.rotate = wrapInteger(valueAt(10, address.rotate), 1, 4);
  address.invert = wrapInteger(valueAt(11, address.invert ? 1 : 0), 0, 1) === 1;
};

const applyControlMaterial = (address: ToneAddress, controlValues: readonly number[]) => {
  if (controlValues.length === 0) return;
  address.controlValues = [...controlValues];
  const average =
    controlValues.reduce((sum, value) => sum + value, 0) / Math.max(1, controlValues.length);
  address.visualVariant = wrapInteger(average, 1, 4);
  address.rotate = wrapInteger(average + address.rotate, 1, 4);
  address.reactivity = clampNumber(Math.abs(average), 0, 8);
};

export const compileToneAddressFromMaterials = (
  materials: ToneWorldMaterials,
  seed?: number,
): ToneAddress => {
  const address = createDefaultToneAddress(seed);
  const tempoBpm = normalizeTempoBpm(flattenToneWorldStreams(materials.tempoBpm));

  const pitchPoolsHz = groupedPitchPools(materials);
  if (pitchPoolsHz.length > 0) {
    address.pitchPoolsHz = pitchPoolsHz;
    address.pitchPoolHz = pitchPoolsHz.flat();
  }

  const durationMaterial = groupedDurationPools(materials, tempoBpm);
  if (durationMaterial.pools.length > 0) {
    address.durationPools = durationMaterial.pools.map((pool) =>
      takeCycled(pool, TONE_WORLD_ROW_SIZE),
    );
    address.durationBag = address.durationPools[0] ?? address.durationBag;
    if (durationMaterial.usesScoreTicks) {
      address.macroDurationSeconds = createMacroDurationSeconds(
        address.seed,
        address.durationPools,
      );
    }
  }

  const sampleSets = flattenToneWorldStreams(materials.sampleSet);
  if (sampleSets.length > 0) {
    address.sampleSets = sampleSets.map((value) => wrapInteger(value, 1, 5));
    address.sampleSet = address.sampleSets[0] ?? address.sampleSet;
  }

  const sampleIndexes = flattenToneWorldStreams(materials.sampleIndex);
  if (sampleIndexes.length > 0) {
    address.samplePermutation = takeCycled(
      sampleIndexes.map((value) => wrapInteger(value, 1, 12)),
      TONE_WORLD_ROW_SIZE,
    );
  }

  const velocities = normalizeVelocity(flattenToneWorldStreams(materials.velocity));
  if (velocities.length > 0) {
    address.loudnessBag = takeCycled(velocities, TONE_WORLD_ROW_SIZE);
  }

  const controlValues = flattenToneWorldStreams(materials.controlValue);
  applyControlMaterial(address, controlValues);
  address.controlTimes = flattenToneWorldStreams(materials.controlTimeSecond)
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.max(0, value));

  applyVisualMaterial(address, flattenToneWorldStreams(materials.visualMaterial));
  applyExplicitVisualScalars(address, materials);

  return address;
};

export const compileToneAddressFromStreams = (
  streams: readonly ToneWorldStream[] = [],
  seed?: number,
): ToneAddress => compileToneAddressFromMaterials(parseToneWorldMaterials(streams), seed);
