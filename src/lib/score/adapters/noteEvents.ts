import { buildMidiClipFromStreamGroups, type MidiScalarStream } from "$lib/midi/midiClip";
import {
  dynamicCodeFromVelocity,
  dynamicSymbolFromCode,
  formatNumericXmlValue,
} from "$lib/score/codebook";
import { scoreDiagnostic } from "$lib/score/diagnostics";
import type {
  ScoreArticulationEvent,
  ScoreBuildResult,
  ScoreNoteEvent,
  ScoreSlurEvent,
  ScoreXmlNode,
} from "$lib/score/types";
import type { StudioPluginMidiStreamGroup } from "$lib/studio/plugins/runtime";

export const SCORE_NOTE_EVENTS_ADAPTER_ID = "music-note-events-v1";

const DEFAULT_DIVISIONS = 480;
const DEFAULT_BEATS_PER_MEASURE = 4;
const EPSILON = 0.000001;

type PitchSpelling = {
  step: string;
  alter?: number;
};

type TimedChord = {
  time: number;
  duration: number;
  part: number;
  voice?: number;
  staff?: number;
  dynamicCode: number;
  notes: ScoreNoteEvent[];
};

type VoiceSegment = {
  startBeat: number;
  duration: number;
  voice: number;
  staff?: number;
  dynamicCode: number;
  tieStart: boolean;
  tieStop: boolean;
  notes: ScoreNoteEvent[];
};

type StaffClef = {
  staff: number;
  sign: string;
  line: string;
};

const PITCH_SPELLINGS: PitchSpelling[] = [
  { step: "C" },
  { step: "C", alter: 1 },
  { step: "D" },
  { step: "D", alter: 1 },
  { step: "E" },
  { step: "F" },
  { step: "F", alter: 1 },
  { step: "G" },
  { step: "G", alter: 1 },
  { step: "A" },
  { step: "A", alter: 1 },
  { step: "B" },
];

const NOTE_TYPE_BEATS: Array<{ beats: number; type: string }> = [
  { beats: 4, type: "whole" },
  { beats: 2, type: "half" },
  { beats: 1, type: "quarter" },
  { beats: 0.5, type: "eighth" },
  { beats: 0.25, type: "16th" },
  { beats: 0.125, type: "32nd" },
  { beats: 0.0625, type: "64th" },
  { beats: 0.03125, type: "128th" },
];

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const clampPositiveInteger = (value: unknown, fallback: number): number => {
  if (!isFiniteNumber(value)) return fallback;
  return Math.max(1, Math.round(value));
};

const durationToDivisions = (beats: number, divisions = DEFAULT_DIVISIONS): string =>
  String(Math.max(1, Math.round(beats * divisions)));

const textNode = (name: string, text: string): ScoreXmlNode => ({ name, text });

const resolveNoteType = (beats: number): { type: string; dots: number } => {
  const exact = NOTE_TYPE_BEATS.find((entry) => Math.abs(entry.beats - beats) < EPSILON);
  if (exact) return { type: exact.type, dots: 0 };

  const dotted = NOTE_TYPE_BEATS.find((entry) => Math.abs(entry.beats * 1.5 - beats) < EPSILON);
  if (dotted) return { type: dotted.type, dots: 1 };

  const closest = NOTE_TYPE_BEATS.reduce(
    (best, entry) => (Math.abs(entry.beats - beats) < Math.abs(best.beats - beats) ? entry : best),
    NOTE_TYPE_BEATS[0] ?? { beats: 1, type: "quarter" },
  );
  return { type: closest.type, dots: 0 };
};

const pitchToNode = (pitch: number): ScoreXmlNode => {
  const pitchClass = ((pitch % 12) + 12) % 12;
  const spelling = PITCH_SPELLINGS[pitchClass] ?? { step: "C" };
  const children = [textNode("step", spelling.step)];
  if (typeof spelling.alter === "number") {
    children.push(textNode("alter", String(spelling.alter)));
  }
  children.push(textNode("octave", String(Math.floor(pitch / 12) - 1)));
  return { name: "pitch", children };
};

const makeDurationTypeNodes = (duration: number): ScoreXmlNode[] => {
  const noteType = resolveNoteType(duration);
  return [
    textNode("type", noteType.type),
    ...Array.from({ length: noteType.dots }, () => ({ name: "dot" })),
  ];
};

const makeRestNote = (duration: number, voice: number, staff?: number): ScoreXmlNode => ({
  name: "note",
  children: [
    { name: "rest" },
    textNode("duration", durationToDivisions(duration)),
    textNode("voice", String(voice)),
    ...makeDurationTypeNodes(duration),
    ...(typeof staff === "number" ? [textNode("staff", String(staff))] : []),
  ],
});

const makeDynamicDirection = (dynamicCode: number): ScoreXmlNode | null => {
  const symbol = dynamicSymbolFromCode(dynamicCode);
  if (!symbol) return null;
  return {
    name: "direction",
    attributes: { placement: "below" },
    children: [
      {
        name: "direction-type",
        children: [{ name: "dynamics", children: [{ name: symbol }] }],
      },
    ],
  };
};

const makeArticulationNode = (articulation: ScoreArticulationEvent): ScoreXmlNode => ({
  name: articulation.element,
  ...(articulation.placement ? { attributes: { placement: articulation.placement } } : {}),
});

const makeSlurNode = (slur: ScoreSlurEvent): ScoreXmlNode => ({
  name: "slur",
  attributes: {
    number: String(slur.number),
    type: slur.type,
    ...(slur.placement ? { placement: slur.placement } : {}),
  },
});

const makePitchedNote = (
  note: ScoreNoteEvent,
  segment: VoiceSegment,
  chordNote: boolean,
): ScoreXmlNode => {
  const durationNodes = [
    textNode("duration", durationToDivisions(segment.duration)),
    ...(segment.tieStop ? [{ name: "tie", attributes: { type: "stop" } }] : []),
    ...(segment.tieStart ? [{ name: "tie", attributes: { type: "start" } }] : []),
  ];
  const notationChildren = [
    ...(segment.tieStop ? [{ name: "tied", attributes: { type: "stop" } }] : []),
    ...(segment.tieStart ? [{ name: "tied", attributes: { type: "start" } }] : []),
    ...(note.slurs ?? []).map(makeSlurNode),
  ];
  const articulationChildren = (note.articulations ?? [])
    .filter((articulation) => articulation.element !== "fermata")
    .map(makeArticulationNode);
  const directNotationChildren = [
    ...notationChildren,
    ...(note.articulations ?? [])
      .filter((articulation) => articulation.element === "fermata")
      .map(makeArticulationNode),
    ...(articulationChildren.length
      ? [{ name: "articulations", children: articulationChildren }]
      : []),
  ];

  return {
    name: "note",
    children: [
      ...(chordNote ? [{ name: "chord" }] : []),
      pitchToNode(note.pitch),
      ...durationNodes,
      textNode("voice", String(segment.voice)),
      ...makeDurationTypeNodes(segment.duration),
      ...(typeof segment.staff === "number" ? [textNode("staff", String(segment.staff))] : []),
      ...(directNotationChildren.length
        ? [{ name: "notations", children: directNotationChildren }]
        : []),
    ],
  };
};

const validateNoteEvents = (
  events: readonly ScoreNoteEvent[],
): { notes: ScoreNoteEvent[]; diagnostics: ScoreBuildResult["diagnostics"] } => {
  const diagnostics: ScoreBuildResult["diagnostics"] = [];
  const notes: ScoreNoteEvent[] = [];

  events.forEach((event, index) => {
    const path = event.sourcePaths?.[0];
    if (!isFiniteNumber(event.pitch) || event.pitch < 0 || event.pitch > 127) {
      diagnostics.push(
        scoreDiagnostic(
          "warning",
          "invalid-pitch",
          `Skipped note ${index}: pitch is not 0..127.`,
          path,
        ),
      );
      return;
    }
    if (!isFiniteNumber(event.time) || event.time < 0) {
      diagnostics.push(
        scoreDiagnostic(
          "warning",
          "invalid-time",
          `Skipped note ${index}: time is negative.`,
          path,
        ),
      );
      return;
    }
    if (!isFiniteNumber(event.duration) || event.duration <= 0) {
      diagnostics.push(
        scoreDiagnostic(
          "warning",
          "invalid-duration",
          `Skipped note ${index}: duration must be greater than zero.`,
          path,
        ),
      );
      return;
    }
    if (
      typeof event.velocity === "number" &&
      (!Number.isFinite(event.velocity) || event.velocity < 0 || event.velocity > 127)
    ) {
      diagnostics.push(
        scoreDiagnostic(
          "warning",
          "invalid-velocity",
          `Skipped note ${index}: velocity is not 0..127.`,
          path,
        ),
      );
      return;
    }

    notes.push({
      ...event,
      eventId:
        typeof event.eventId === "number" && Number.isFinite(event.eventId)
          ? Math.round(event.eventId)
          : undefined,
      pitch: Math.round(event.pitch),
      part: clampPositiveInteger(event.part, 1),
      voice: typeof event.voice === "number" ? clampPositiveInteger(event.voice, 1) : undefined,
      staff: typeof event.staff === "number" ? clampPositiveInteger(event.staff, 1) : undefined,
      dynamicCode:
        typeof event.dynamicCode === "number"
          ? clampPositiveInteger(event.dynamicCode + 1, 1) - 1
          : dynamicCodeFromVelocity(event.velocity ?? 80),
    });
  });

  return { notes, diagnostics };
};

const groupChordEvents = (events: readonly ScoreNoteEvent[]): TimedChord[] => {
  const groups = new Map<string, TimedChord>();
  events.forEach((event) => {
    const part = event.part ?? 1;
    const voice = event.voice;
    const staff = event.staff;
    const dynamicCode = event.dynamicCode ?? dynamicCodeFromVelocity(event.velocity ?? 80);
    const key = [
      part,
      voice ?? "auto",
      staff ?? "staff",
      formatNumericXmlValue(event.time),
      formatNumericXmlValue(event.duration),
    ].join("|");
    const current = groups.get(key);
    if (current) {
      current.notes.push(event);
      return;
    }
    groups.set(key, {
      time: event.time,
      duration: event.duration,
      part,
      voice,
      staff,
      dynamicCode,
      notes: [event],
    });
  });

  return [...groups.values()].sort(
    (a, b) =>
      a.part - b.part ||
      a.time - b.time ||
      a.duration - b.duration ||
      Math.min(...a.notes.map((note) => note.pitch)) -
        Math.min(...b.notes.map((note) => note.pitch)),
  );
};

const assignVoices = (chords: readonly TimedChord[]): TimedChord[] => {
  const endsByPart = new Map<number, number[]>();
  return chords.map((chord) => {
    if (typeof chord.voice === "number") return chord;

    const voiceEnds = endsByPart.get(chord.part) ?? [];
    let voiceIndex = voiceEnds.findIndex((end) => end <= chord.time + EPSILON);
    if (voiceIndex < 0) {
      voiceIndex = voiceEnds.length;
    }
    voiceEnds[voiceIndex] = chord.time + chord.duration;
    endsByPart.set(chord.part, voiceEnds);
    return { ...chord, voice: voiceIndex + 1 };
  });
};

const splitChordIntoMeasures = (
  chord: TimedChord,
  beatsPerMeasure: number,
): Array<{ measure: number; segment: VoiceSegment }> => {
  const segments: Array<{ measure: number; segment: VoiceSegment }> = [];
  const endTime = chord.time + chord.duration;
  let cursor = chord.time;
  while (cursor < endTime - EPSILON) {
    const measureIndex = Math.floor(cursor / beatsPerMeasure);
    const measureStart = measureIndex * beatsPerMeasure;
    const nextBoundary = measureStart + beatsPerMeasure;
    const segmentEnd = Math.min(endTime, nextBoundary);
    segments.push({
      measure: measureIndex + 1,
      segment: {
        startBeat: cursor - measureStart,
        duration: segmentEnd - cursor,
        voice: chord.voice ?? 1,
        staff: chord.staff,
        dynamicCode: chord.dynamicCode,
        tieStop: cursor > chord.time + EPSILON,
        tieStart: segmentEnd < endTime - EPSILON,
        notes: [...chord.notes].sort((a, b) => a.pitch - b.pitch),
      },
    });
    cursor = segmentEnd;
  }
  return segments;
};

const inferClef = (notes: readonly ScoreNoteEvent[]): { sign: string; line: string } => {
  if (notes.length === 0) return { sign: "G", line: "2" };
  const sorted = notes.map((note) => note.pitch).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 60;
  return median < 60 ? { sign: "F", line: "4" } : { sign: "G", line: "2" };
};

const makeAttributesNode = (clefs: readonly StaffClef[], staffCount: number): ScoreXmlNode => ({
  name: "attributes",
  children: [
    textNode("divisions", String(DEFAULT_DIVISIONS)),
    { name: "key", children: [textNode("fifths", "0")] },
    {
      name: "time",
      children: [textNode("beats", String(DEFAULT_BEATS_PER_MEASURE)), textNode("beat-type", "4")],
    },
    ...(staffCount > 1 ? [textNode("staves", String(staffCount))] : []),
    ...clefs.map((clef) => ({
      name: "clef",
      ...(staffCount > 1 ? { attributes: { number: String(clef.staff) } } : {}),
      children: [textNode("sign", clef.sign), textNode("line", clef.line)],
    })),
  ],
});

const makeMeasureNode = (
  measureNumber: number,
  segments: readonly VoiceSegment[],
  clefs: readonly StaffClef[] | null,
  staffCount: number,
  dynamicCodesByVoice: Map<number, number | null>,
): { node: ScoreXmlNode; diagnostics: ScoreBuildResult["diagnostics"] } => {
  const diagnostics: ScoreBuildResult["diagnostics"] = [];
  const children: ScoreXmlNode[] = [];
  if (clefs) {
    children.push(makeAttributesNode(clefs, staffCount));
  }

  const segmentsByVoice = new Map<number, VoiceSegment[]>();
  segments.forEach((segment) => {
    const current = segmentsByVoice.get(segment.voice) ?? [];
    current.push(segment);
    segmentsByVoice.set(segment.voice, current);
  });

  const voices = [...segmentsByVoice.keys()].sort((a, b) => a - b);
  const activeVoices = voices.length > 0 ? voices : [1];

  activeVoices.forEach((voice, voiceIndex) => {
    if (voiceIndex > 0) {
      children.push({
        name: "backup",
        children: [textNode("duration", durationToDivisions(DEFAULT_BEATS_PER_MEASURE))],
      });
    }

    let cursor = 0;
    let lastDynamicCode = dynamicCodesByVoice.get(voice) ?? null;
    const voiceSegments = (segmentsByVoice.get(voice) ?? []).sort(
      (a, b) => a.startBeat - b.startBeat || a.duration - b.duration,
    );

    voiceSegments.forEach((segment) => {
      if (segment.startBeat < cursor - EPSILON) {
        diagnostics.push(
          scoreDiagnostic(
            "warning",
            "overlapping-note",
            `Skipped an overlapping note in measure ${measureNumber}, voice ${voice}.`,
          ),
        );
        return;
      }

      if (segment.startBeat > cursor + EPSILON) {
        children.push(makeRestNote(segment.startBeat - cursor, voice, segment.staff));
      }

      if (lastDynamicCode !== segment.dynamicCode) {
        const direction = makeDynamicDirection(segment.dynamicCode);
        if (direction) children.push(direction);
        lastDynamicCode = segment.dynamicCode;
        dynamicCodesByVoice.set(voice, segment.dynamicCode);
      }

      segment.notes.forEach((note, index) => {
        children.push(makePitchedNote(note, segment, index > 0));
      });
      cursor = segment.startBeat + segment.duration;
    });

    if (cursor < DEFAULT_BEATS_PER_MEASURE - EPSILON) {
      children.push(
        makeRestNote(
          DEFAULT_BEATS_PER_MEASURE - cursor,
          voice,
          voiceSegments.find((segment) => typeof segment.staff === "number")?.staff,
        ),
      );
    }
  });

  return {
    node: { name: "measure", attributes: { number: String(measureNumber) }, children },
    diagnostics,
  };
};

const buildPartNode = (
  partNumber: number,
  notes: readonly ScoreNoteEvent[],
  chords: readonly TimedChord[],
  measureCount: number,
): { node: ScoreXmlNode; diagnostics: ScoreBuildResult["diagnostics"] } => {
  const diagnostics: ScoreBuildResult["diagnostics"] = [];
  const staffCount = Math.max(1, ...notes.map((note) => note.staff ?? 1));
  const clefs = Array.from({ length: staffCount }, (_, index) => {
    const staff = index + 1;
    return {
      staff,
      ...inferClef(notes.filter((note) => (note.staff ?? 1) === staff)),
    };
  });
  const dynamicCodesByVoice = new Map<number, number | null>();
  const segmentsByMeasure = new Map<number, VoiceSegment[]>();
  chords.forEach((chord) => {
    splitChordIntoMeasures(chord, DEFAULT_BEATS_PER_MEASURE).forEach(({ measure, segment }) => {
      const current = segmentsByMeasure.get(measure) ?? [];
      current.push(segment);
      segmentsByMeasure.set(measure, current);
    });
  });

  const children = Array.from({ length: measureCount }, (_, index) => {
    const measureNumber = index + 1;
    const { node, diagnostics: measureDiagnostics } = makeMeasureNode(
      measureNumber,
      segmentsByMeasure.get(measureNumber) ?? [],
      measureNumber === 1 ? clefs : null,
      staffCount,
      dynamicCodesByVoice,
    );
    diagnostics.push(...measureDiagnostics);
    return node;
  });

  return {
    node: { name: "part", attributes: { id: `P${partNumber}` }, children },
    diagnostics,
  };
};

export const buildScoreFromNoteEvents = (
  events: readonly ScoreNoteEvent[],
  options: { adapterId?: string; streamCount?: number } = {},
): ScoreBuildResult => {
  const adapterId = options.adapterId ?? SCORE_NOTE_EVENTS_ADAPTER_ID;
  const { notes, diagnostics } = validateNoteEvents(events);

  if (notes.length === 0) {
    return {
      tree: null,
      diagnostics: [
        ...diagnostics,
        scoreDiagnostic("warning", "no-score-notes", "No valid score notes were available."),
      ],
      stats: {
        adapterId,
        noteCount: 0,
        measureCount: 0,
        partCount: 0,
        streamCount: options.streamCount ?? 0,
      },
    };
  }

  const chords = assignVoices(groupChordEvents(notes));
  const partNumbers = [...new Set(notes.map((note) => note.part ?? 1))].sort((a, b) => a - b);
  const measureCount = Math.max(
    1,
    Math.ceil(
      notes.reduce((max, note) => Math.max(max, note.time + note.duration), 0) /
        DEFAULT_BEATS_PER_MEASURE,
    ),
  );

  const partList: ScoreXmlNode = {
    name: "part-list",
    children: partNumbers.map((partNumber) => ({
      name: "score-part",
      attributes: { id: `P${partNumber}` },
      children: [textNode("part-name", `Part ${partNumber}`)],
    })),
  };

  const partNodes = partNumbers.map((partNumber) => {
    const partNotes = notes.filter((note) => (note.part ?? 1) === partNumber);
    const partChords = chords.filter((chord) => chord.part === partNumber);
    const { node, diagnostics: partDiagnostics } = buildPartNode(
      partNumber,
      partNotes,
      partChords,
      measureCount,
    );
    diagnostics.push(...partDiagnostics);
    return node;
  });

  return {
    tree: {
      root: {
        name: "score-partwise",
        attributes: { version: "4.0" },
        children: [partList, ...partNodes],
      },
    },
    diagnostics,
    stats: {
      adapterId,
      noteCount: notes.length,
      measureCount,
      partCount: partNumbers.length,
      streamCount: options.streamCount ?? 0,
    },
  };
};

const toMidiStream = (
  stream: { feature_path: string; data: number[] } | undefined,
): MidiScalarStream | undefined =>
  stream ? { path: stream.feature_path, data: stream.data } : undefined;

export const buildScoreFromMidiGroups = (
  groups: readonly StudioPluginMidiStreamGroup[],
  streamCount = 0,
): ScoreBuildResult => {
  if (groups.length === 0) {
    return {
      tree: null,
      diagnostics: [
        scoreDiagnostic(
          "warning",
          "no-compatible-streams",
          "No pitch/time/duration/velocity streams were available for score notation.",
        ),
      ],
      stats: {
        adapterId: SCORE_NOTE_EVENTS_ADAPTER_ID,
        noteCount: 0,
        measureCount: 0,
        partCount: 0,
        streamCount,
      },
    };
  }

  const clip = buildMidiClipFromStreamGroups(
    groups.map((group) => ({
      groupPath: group.groupPath,
      pitch: toMidiStream(group.pitch),
      time: toMidiStream(group.time),
      duration: toMidiStream(group.duration),
      velocity: toMidiStream(group.velocity),
    })),
  );
  const diagnostics = clip.diagnostics.flatMap((diagnostic) => {
    const path = diagnostic.groupPath === "/" ? undefined : diagnostic.groupPath;
    const lines = [];
    if (diagnostic.missing.length > 0) {
      lines.push(
        scoreDiagnostic(
          "warning",
          "missing-note-stream",
          `${diagnostic.groupPath}: missing ${diagnostic.missing.join(", ")}.`,
          path,
        ),
      );
    }
    Object.entries(diagnostic.skippedReasons).forEach(([reason, count]) => {
      lines.push(
        scoreDiagnostic(
          "warning",
          `skipped-${reason}`,
          `${diagnostic.groupPath}: skipped ${count} note value${count === 1 ? "" : "s"}.`,
          path,
        ),
      );
    });
    return lines;
  });

  const result = buildScoreFromNoteEvents(
    clip.notes.map((note) => ({
      pitch: note.pitch,
      time: note.time,
      duration: note.duration,
      velocity: note.velocity,
      part: note.channel,
      sourcePaths: note.sourcePaths,
    })),
    { adapterId: SCORE_NOTE_EVENTS_ADAPTER_ID, streamCount },
  );

  return {
    ...result,
    diagnostics: [...diagnostics, ...result.diagnostics],
  };
};
