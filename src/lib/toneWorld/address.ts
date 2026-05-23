import {
  TONE_WORLD_MAX_VOICES,
  TONE_WORLD_PART_COUNT,
  TONE_WORLD_ROW_SIZE,
  type ToneAddress,
} from "./types";

export const DEFAULT_TONE_WORLD_SEED = 0x746f_6e65;
export const TONE_ROW_SAMPLE_REGISTER_BASE_MIDI = 24;
export const TONE_ROW_SAMPLE_REGISTER_TOP_MIDI = TONE_ROW_SAMPLE_REGISTER_BASE_MIDI + 12;

const UINT32_RANGE = 4_294_967_296;

export const createToneWorldRandom = (seed = DEFAULT_TONE_WORLD_SEED) => {
  let state = Math.trunc(seed) >>> 0;
  return () => {
    state = (state + 0x6d2b_79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;
  };
};

export const randomIntInclusive = (random: () => number, min: number, max: number): number => {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(random() * (high - low + 1) + low);
};

const makePermutation = (random: () => number, length: number): number[] => {
  const values = Array.from({ length }, (_, index) => index);
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIntInclusive(random, 0, index);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
};

export const wrapInteger = (value: number, min: number, max: number): number => {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  const span = high - low + 1;
  if (span <= 0) return low;
  const normalized = Math.round(value) - low;
  return low + (((normalized % span) + span) % span || 0);
};

export const clampNumber = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
};

export const midiToFrequency = (pitch: number): number => 440 * 2 ** ((pitch - 69) / 12);

export const midiToToneRowFrequency = (pitch: number): number => {
  const clamped = clampNumber(pitch, 0, 127);
  const pitchClass = ((clamped % 12) + 12) % 12;
  return midiToFrequency(TONE_ROW_SAMPLE_REGISTER_BASE_MIDI + pitchClass);
};

export const createDefaultToneAddress = (seed = DEFAULT_TONE_WORLD_SEED): ToneAddress => {
  const random = createToneWorldRandom(seed);
  const sampleSet = randomIntInclusive(random, 1, 5);

  return {
    seed,
    sampleSet,
    pitchPoolHz: [],
    pitchPoolsHz: [],
    durationBag: Array.from({ length: TONE_WORLD_ROW_SIZE }, () =>
      randomIntInclusive(random, 1, 10),
    ),
    durationPools: [],
    macroDurationSeconds: null,
    loudnessBag: Array.from(
      { length: TONE_WORLD_ROW_SIZE },
      () => randomIntInclusive(random, 1, 10) / 10,
    ),
    pitchPermutation: makePermutation(random, TONE_WORLD_ROW_SIZE),
    samplePermutation: makePermutation(random, TONE_WORLD_ROW_SIZE).map((index) => index + 1),
    sampleSets: [sampleSet],
    durationOrder: makePermutation(random, TONE_WORLD_ROW_SIZE),
    partVoiceCounts: Array.from({ length: TONE_WORLD_PART_COUNT }, () =>
      randomIntInclusive(random, 1, 4),
    ),
    voiceStarts: Array.from({ length: TONE_WORLD_MAX_VOICES }, () =>
      randomIntInclusive(random, 0, TONE_WORLD_ROW_SIZE - 1),
    ),
    voiceLengths: Array.from({ length: TONE_WORLD_MAX_VOICES }, () =>
      randomIntInclusive(random, 1, TONE_WORLD_ROW_SIZE),
    ),
    imageIndex: randomIntInclusive(random, 0, 2),
    colors: [
      randomIntInclusive(random, 50, 205) * 0.01,
      randomIntInclusive(random, 50, 205) * 0.01,
      randomIntInclusive(random, 5, 100) * 0.01,
    ],
    visualNumber: randomIntInclusive(random, 1, 50),
    visualShape: randomIntInclusive(random, 3, 9),
    visualSetting1: randomIntInclusive(random, 3, 15),
    visualSetting2: randomIntInclusive(random, 1, 30),
    visualSetting3: randomIntInclusive(random, 1, 5),
    bigNumber: randomIntInclusive(random, 1, 100),
    rotate: randomIntInclusive(random, 1, 4),
    invert: randomIntInclusive(random, 1, 2) === 2,
    visualSet: sampleSet,
    visualVariant: randomIntInclusive(random, 1, 4),
    controlValues: [],
    controlTimes: [],
    reactivity: 1,
  };
};
