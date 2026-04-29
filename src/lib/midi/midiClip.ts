export const MIDI_DEFAULT_TEMPO = 120;
export const MIDI_DEFAULT_PPQ = 480;

export type MidiScalarKey = "pitch" | "time" | "duration" | "velocity";

export type MidiScalarStream = {
  path: string;
  data: number[];
};

export type MidiStreamGroup = {
  groupPath: string;
  pitch?: MidiScalarStream;
  time?: MidiScalarStream;
  duration?: MidiScalarStream;
  velocity?: MidiScalarStream;
};

export type MidiNote = {
  time: number;
  duration: number;
  pitch: number;
  velocity: number;
  channel: number;
  groupPath: string;
};

export type MidiSkippedNoteReason =
  | "missing-value"
  | "invalid-pitch"
  | "invalid-time"
  | "invalid-duration"
  | "invalid-velocity";

export type MidiSkippedNote = {
  groupPath: string;
  index: number;
  reason: MidiSkippedNoteReason;
};

export type MidiGroupDiagnostic = {
  groupPath: string;
  available: MidiScalarKey[];
  missing: MidiScalarKey[];
  valueCount: number;
  noteCount: number;
  skippedCount: number;
  skippedReasons: Partial<Record<MidiSkippedNoteReason, number>>;
};

export type MidiClip = {
  tempo: number;
  ppq: number;
  notes: MidiNote[];
  lengthBeats: number;
  channels: number;
  skippedNotes: number;
  skipped: MidiSkippedNote[];
  diagnostics: MidiGroupDiagnostic[];
};

export type MidiClipOptions = {
  tempo?: number;
  ppq?: number;
};

const REQUIRED_SCALARS: MidiScalarKey[] = ["pitch", "time", "duration", "velocity"];

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isValidMidiByte = (value: number) => value >= 0 && value <= 127;

const normalizeTempo = (value: unknown): number =>
  isFiniteNumber(value) && value > 0 ? Math.max(10, value) : MIDI_DEFAULT_TEMPO;

const normalizePpq = (value: unknown): number =>
  isFiniteNumber(value) && value > 0 ? Math.max(1, Math.round(value)) : MIDI_DEFAULT_PPQ;

const incrementReason = (
  reasons: Partial<Record<MidiSkippedNoteReason, number>>,
  reason: MidiSkippedNoteReason,
) => {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
};

const hasStream = (group: MidiStreamGroup, key: MidiScalarKey) => Boolean(group[key]);

const streamValueCount = (group: MidiStreamGroup) =>
  Math.max(
    group.pitch?.data.length ?? 0,
    group.time?.data.length ?? 0,
    group.duration?.data.length ?? 0,
    group.velocity?.data.length ?? 0,
  );

const makeDiagnostic = (group: MidiStreamGroup): MidiGroupDiagnostic => {
  const available = REQUIRED_SCALARS.filter((key) => hasStream(group, key));
  return {
    groupPath: group.groupPath,
    available,
    missing: REQUIRED_SCALARS.filter((key) => !hasStream(group, key)),
    valueCount: streamValueCount(group),
    noteCount: 0,
    skippedCount: 0,
    skippedReasons: {},
  };
};

const skipNote = (
  skipped: MidiSkippedNote[],
  diagnostic: MidiGroupDiagnostic,
  reason: MidiSkippedNoteReason,
  index: number,
) => {
  skipped.push({ groupPath: diagnostic.groupPath, index, reason });
  diagnostic.skippedCount += 1;
  incrementReason(diagnostic.skippedReasons, reason);
};

export const buildMidiClipFromStreamGroups = (
  groups: MidiStreamGroup[],
  options: MidiClipOptions = {},
): MidiClip => {
  const tempo = normalizeTempo(options.tempo);
  const ppq = normalizePpq(options.ppq);
  const notes: MidiNote[] = [];
  const skipped: MidiSkippedNote[] = [];
  const diagnostics: MidiGroupDiagnostic[] = [];

  groups.forEach((group, groupIndex) => {
    const diagnostic = makeDiagnostic(group);
    diagnostics.push(diagnostic);

    if (diagnostic.missing.length > 0) return;

    const valueCount = diagnostic.valueCount;
    const channel = (groupIndex % 16) + 1;

    for (let index = 0; index < valueCount; index += 1) {
      const pitchValue = group.pitch?.data[index];
      const timeValue = group.time?.data[index];
      const durationValue = group.duration?.data[index];
      const velocityValue = group.velocity?.data[index];

      if (
        !isFiniteNumber(pitchValue) ||
        !isFiniteNumber(timeValue) ||
        !isFiniteNumber(durationValue) ||
        !isFiniteNumber(velocityValue)
      ) {
        skipNote(skipped, diagnostic, "missing-value", index);
        continue;
      }

      const pitch = Math.round(pitchValue);
      if (!isValidMidiByte(pitch)) {
        skipNote(skipped, diagnostic, "invalid-pitch", index);
        continue;
      }

      if (timeValue < 0) {
        skipNote(skipped, diagnostic, "invalid-time", index);
        continue;
      }

      if (durationValue <= 0) {
        skipNote(skipped, diagnostic, "invalid-duration", index);
        continue;
      }

      const velocity = Math.round(velocityValue);
      if (!isValidMidiByte(velocity)) {
        skipNote(skipped, diagnostic, "invalid-velocity", index);
        continue;
      }

      notes.push({
        time: timeValue,
        duration: durationValue,
        pitch,
        velocity,
        channel,
        groupPath: group.groupPath,
      });
      diagnostic.noteCount += 1;
    }
  });

  notes.sort((a, b) =>
    a.time === b.time ? a.pitch - b.pitch || a.channel - b.channel : a.time - b.time,
  );

  const lengthBeats = notes.reduce((max, note) => Math.max(max, note.time + note.duration), 0);
  const channels = Math.max(
    1,
    Math.min(16, diagnostics.filter((item) => item.noteCount > 0).length),
  );

  return {
    tempo,
    ppq,
    notes,
    lengthBeats,
    channels,
    skippedNotes: skipped.length,
    skipped,
    diagnostics,
  };
};

export const midiNoteName = (pitch: number) => {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const cls = names[((pitch % 12) + 12) % 12] ?? "C";
  const octave = Math.floor(pitch / 12) - 1;
  return `${cls}${octave}`;
};

export const midiChannelColor = (channel: number, velocity: number, alpha = 0.88) => {
  const hue = (channel * 41) % 360;
  const light = 42 + Math.round((Math.max(0, Math.min(127, velocity)) / 127) * 18);
  return `hsla(${hue}, 70%, ${light}%, ${alpha})`;
};

export const formatMidiSkippedReason = (reason: MidiSkippedNoteReason) => {
  switch (reason) {
    case "missing-value":
      return "missing values";
    case "invalid-pitch":
      return "pitch outside 0..127";
    case "invalid-time":
      return "negative time";
    case "invalid-duration":
      return "zero or negative duration";
    case "invalid-velocity":
      return "velocity outside 0..127";
  }
};
