import {
  TONE_WORLD_PART_COUNT,
  TONE_WORLD_ROW_SIZE,
  type ToneAddress,
  type ToneWorldComposition,
  type ToneWorldNote,
} from "./types";

const circularSlice = <T>(array: readonly T[], start: number, count: number): T[] =>
  Array.from({ length: count }, (_, index) => array[(start + index) % array.length]);

const buildPermutedPitchRow = (source: readonly number[], address: ToneAddress): number[] =>
  Array.from({ length: TONE_WORLD_ROW_SIZE }, (_, index) => {
    const permutationIndex = address.pitchPermutation[index] ?? index;
    const sourceIndex = permutationIndex % source.length;
    const frequency = source[sourceIndex] ?? source[0] ?? 55;
    return Math.min(16_000, Math.max(8, frequency));
  });

const buildMaterialPitchRow = (address: ToneAddress, poolIndex = 0): number[] => {
  const source =
    address.pitchPoolsHz[poolIndex % address.pitchPoolsHz.length] ?? address.pitchPoolHz;
  return source.length > 0 ? buildPermutedPitchRow(source, address) : [];
};

export const buildToneWorldPitchRow = (address: ToneAddress, poolIndex = 0): number[] =>
  buildMaterialPitchRow(address, poolIndex);

const buildBaseRow = (address: ToneAddress, poolIndex = 0): ToneWorldNote[] => {
  const frequencies = buildToneWorldPitchRow(address, poolIndex);
  if (frequencies.length === 0) return [];
  const durations =
    address.durationPools[poolIndex % address.durationPools.length] ?? address.durationBag;
  const sampleSet = address.sampleSets[poolIndex % address.sampleSets.length] ?? address.sampleSet;
  let time = 0;
  return Array.from({ length: TONE_WORLD_ROW_SIZE }, (_, index) => {
    const rowPosition = index;
    const durationIndex = address.durationOrder[rowPosition] ?? rowPosition;
    const duration = durations[durationIndex % durations.length] ?? 1;
    const note: ToneWorldNote = {
      time,
      duration,
      frequency: frequencies[rowPosition % frequencies.length] ?? frequencies[0] ?? 55,
      sample:
        address.samplePermutation[rowPosition % address.samplePermutation.length] ??
        (rowPosition % TONE_WORLD_ROW_SIZE) + 1,
      sampleSet,
      velocity: Math.min(1, Math.max(0.05, address.loudnessBag[rowPosition] ?? 0.7)),
      rowPosition,
      part: 1,
      voice: 1,
    };
    time += duration;
    return note;
  });
};

const renormalizeVoice = (
  row: readonly ToneWorldNote[],
  start: number,
  count: number,
  part: number,
  voice: number,
): ToneWorldNote[] => {
  let time = 0;
  return circularSlice(row, start, count).map((note) => {
    const next = { ...note, time, part, voice };
    time += note.duration;
    return next;
  });
};

const stretchNotesToMacroDuration = (
  notes: readonly ToneWorldNote[],
  currentDuration: number,
  targetDuration: number | null,
): { notes: ToneWorldNote[]; duration: number } => {
  if (!targetDuration || currentDuration <= 0 || !Number.isFinite(currentDuration)) {
    return { notes: [...notes], duration: currentDuration };
  }

  const scale = targetDuration / currentDuration;
  return {
    notes: notes.map((note) => ({
      ...note,
      time: note.time * scale,
      duration: note.duration * scale,
    })),
    duration: targetDuration,
  };
};

export const composeToneWorld = (address: ToneAddress): ToneWorldComposition => {
  const notes: ToneWorldNote[] = [];
  let partOffset = 0;
  let voiceCursor = 0;

  for (let partIndex = 0; partIndex < TONE_WORLD_PART_COUNT; partIndex += 1) {
    const baseRow = buildBaseRow(address, partIndex);
    if (baseRow.length === 0) continue;
    const voiceCount = address.partVoiceCounts[partIndex] ?? 1;
    const partNotes: ToneWorldNote[] = [];
    for (let localVoice = 0; localVoice < voiceCount; localVoice += 1) {
      const voiceIndex = voiceCursor % address.voiceStarts.length;
      const voice = renormalizeVoice(
        baseRow,
        address.voiceStarts[voiceIndex] ?? 0,
        address.voiceLengths[voiceIndex] ?? TONE_WORLD_ROW_SIZE,
        partIndex + 1,
        localVoice + 1,
      );
      partNotes.push(...voice);
      voiceCursor += 1;
    }

    partNotes.forEach((note) => {
      notes.push({ ...note, time: note.time + partOffset });
    });
    notes.sort((a, b) => a.time - b.time || a.part - b.part || a.voice - b.voice);
    partOffset = notes.at(-1)?.time ?? partOffset;
  }

  const sortedNotes = notes.sort((a, b) => a.time - b.time || a.part - b.part || a.voice - b.voice);
  const unscaledDuration = sortedNotes.reduce(
    (max, note) => Math.max(max, note.time + note.duration),
    0,
  );
  const stretchedComposition = stretchNotesToMacroDuration(
    sortedNotes,
    unscaledDuration,
    address.macroDurationSeconds,
  );
  const rowFrequencyGroups = Array.from({ length: TONE_WORLD_PART_COUNT }, (_, index) =>
    buildToneWorldPitchRow(address, index),
  );
  const rowFrequencies = rowFrequencyGroups[0] ?? [];

  return {
    notes: stretchedComposition.notes,
    duration: stretchedComposition.duration,
    rowFrequencies,
    rowFrequencyGroups,
    statsText: `${stretchedComposition.notes.length} events | pitch_midi | set ${
      address.sampleSet
    } | ${stretchedComposition.duration.toFixed(1)}s`,
  };
};
