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
  ScoreClefEvent,
  ScoreKeyEvent,
  ScoreMeterEvent,
  ScoreNoteEvent,
  ScorePartEvent,
  ScoreSlurEvent,
  ScoreTempoEvent,
  ScoreXmlNode,
} from "$lib/score/types";
import type { StudioPluginMidiStreamGroup } from "$lib/studio/plugins/runtime";

export const SCORE_NOTE_EVENTS_ADAPTER_ID = "music-note-events-v1";

const DEFAULT_DIVISIONS = 480;
const DEFAULT_METER_BEATS = 4;
const DEFAULT_METER_BEAT_TYPE = 4;
const EPSILON = 0.000001;
const SUPPORTED_SCORE_BEAT_TYPES = new Set([1, 2, 4, 8, 16, 32, 64, 128]);
const RENDERABLE_KEY_MODES = new Set(["major", "minor", "none"]);

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

type NormalizedMeter = {
  time: number;
  beats: number;
  beatType: number;
  sourcePath?: string;
};

type MeasureDefinition = {
  number: number;
  startBeat: number;
  endBeat: number;
  meter: NormalizedMeter;
  meterChanged: boolean;
};

type ScoreBuildOptions = {
  adapterId?: string;
  streamCount?: number;
  divisions?: number;
  meters?: readonly ScoreMeterEvent[];
  parts?: readonly ScorePartEvent[];
  clefs?: readonly ScoreClefEvent[];
  tempos?: readonly ScoreTempoEvent[];
  keys?: readonly ScoreKeyEvent[];
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
const MIN_RENDERABLE_MEASURE_BEATS = NOTE_TYPE_BEATS.at(-1)?.beats ?? 0.03125;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const clampPositiveInteger = (value: unknown, fallback: number): number => {
  if (!isFiniteNumber(value)) return fallback;
  return Math.max(1, Math.round(value));
};

const quantizeBeatToRendererGrid = (value: number): number =>
  Math.max(0, Math.round(value / MIN_RENDERABLE_MEASURE_BEATS) * MIN_RENDERABLE_MEASURE_BEATS);

const quantizeDurationToRendererGrid = (value: number): number =>
  Math.max(
    MIN_RENDERABLE_MEASURE_BEATS,
    Math.round(value / MIN_RENDERABLE_MEASURE_BEATS) * MIN_RENDERABLE_MEASURE_BEATS,
  );

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
  children.push(textNode("octave", String(Math.max(0, Math.min(9, Math.floor(pitch / 12) - 1)))));
  return { name: "pitch", children };
};

const makeDurationTypeNodes = (duration: number): ScoreXmlNode[] => {
  const noteType = resolveNoteType(duration);
  return [
    textNode("type", noteType.type),
    ...Array.from({ length: noteType.dots }, () => ({ name: "dot" })),
  ];
};

const makeRestNote = (
  duration: number,
  voice: number,
  staff: number | undefined,
  divisions: number,
): ScoreXmlNode => ({
  name: "note",
  children: [
    { name: "rest" },
    textNode("duration", durationToDivisions(duration, divisions)),
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

const makeTempoDirection = (bpm: number): ScoreXmlNode => ({
  name: "direction",
  attributes: { placement: "above" },
  children: [
    {
      name: "direction-type",
      children: [{ name: "words", text: `${formatNumericXmlValue(bpm)} bpm` }],
    },
    { name: "sound", attributes: { tempo: formatNumericXmlValue(bpm) } },
  ],
});

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
  divisions: number,
): ScoreXmlNode => {
  const durationNodes = [
    textNode("duration", durationToDivisions(segment.duration, divisions)),
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

    const time = quantizeBeatToRendererGrid(event.time);
    const duration = quantizeDurationToRendererGrid(event.duration);
    if (Math.abs(time - event.time) > EPSILON || Math.abs(duration - event.duration) > EPSILON) {
      diagnostics.push(
        scoreDiagnostic(
          "warning",
          "quantized-note-grid",
          `Quantized note ${index} to the smallest duration the score renderer can notate reliably.`,
          path,
        ),
      );
    }

    notes.push({
      ...event,
      eventId:
        typeof event.eventId === "number" && Number.isFinite(event.eventId)
          ? Math.round(event.eventId)
          : undefined,
      pitch: Math.round(event.pitch),
      time,
      duration,
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

const meterLengthBeats = (meter: Pick<NormalizedMeter, "beats" | "beatType">): number =>
  meter.beats * (4 / meter.beatType);

const normalizeMeterEvents = (
  meters: readonly ScoreMeterEvent[] | undefined,
  diagnostics: ScoreBuildResult["diagnostics"],
): NormalizedMeter[] => {
  const candidates = (meters ?? [])
    .flatMap((meter, index): NormalizedMeter[] => {
      if (
        !isFiniteNumber(meter.time) ||
        meter.time < 0 ||
        !isFiniteNumber(meter.beats) ||
        meter.beats <= 0 ||
        !isFiniteNumber(meter.beatType) ||
        meter.beatType <= 0 ||
        !SUPPORTED_SCORE_BEAT_TYPES.has(Math.round(meter.beatType))
      ) {
        diagnostics.push(
          scoreDiagnostic(
            "warning",
            "invalid-meter-event",
            `Skipped meter event ${index}: time and beats must be positive, and beat_type must be a standard notation denominator.`,
            meter.sourcePath,
          ),
        );
        return [];
      }
      return [
        {
          time: meter.time,
          beats: Math.max(1, Math.round(meter.beats)),
          beatType: Math.max(1, Math.round(meter.beatType)),
          sourcePath: meter.sourcePath,
        },
      ];
    })
    .sort((a, b) => a.time - b.time);

  const normalized: NormalizedMeter[] = [];
  candidates.forEach((meter, index) => {
    const previousTime = normalized.at(-1)?.time ?? 0;
    if (
      meter.time > EPSILON &&
      meter.time - previousTime < MIN_RENDERABLE_MEASURE_BEATS - EPSILON
    ) {
      diagnostics.push(
        scoreDiagnostic(
          "warning",
          "short-score-meter-span",
          `Skipped meter event ${index}: the resulting measure would be shorter than the score renderer can notate reliably.`,
          meter.sourcePath,
        ),
      );
      return;
    }
    normalized.push(meter);
  });

  if (normalized.length === 0) {
    diagnostics.push(
      scoreDiagnostic(
        "warning",
        "missing-score-meter",
        "No explicit score_meter_v2 layer was available; rendered with a 4/4 fallback.",
      ),
    );
    return [{ time: 0, beats: DEFAULT_METER_BEATS, beatType: DEFAULT_METER_BEAT_TYPE }];
  }

  if (normalized[0] && normalized[0].time > EPSILON) {
    diagnostics.push(
      scoreDiagnostic(
        "warning",
        "missing-initial-score-meter",
        "The first score_meter_v2 event starts after tick 0; rendered the opening span with a 4/4 fallback.",
      ),
    );
    return [
      { time: 0, beats: DEFAULT_METER_BEATS, beatType: DEFAULT_METER_BEAT_TYPE },
      ...normalized,
    ];
  }

  return normalized;
};

const buildMeasureMap = (
  maxEndBeat: number,
  meters: readonly ScoreMeterEvent[] | undefined,
  diagnostics: ScoreBuildResult["diagnostics"],
): MeasureDefinition[] => {
  const normalizedMeters = normalizeMeterEvents(meters, diagnostics);
  const measures: MeasureDefinition[] = [];
  let measureStart = 0;
  let meterIndex = 0;
  let previousMeterKey = "";
  const finalBeat = Math.max(maxEndBeat, meterLengthBeats(normalizedMeters[0]!));

  while (measureStart < finalBeat - EPSILON || measures.length === 0) {
    while (
      normalizedMeters[meterIndex + 1] &&
      normalizedMeters[meterIndex + 1]!.time <= measureStart + EPSILON
    ) {
      meterIndex += 1;
    }

    const meter = normalizedMeters[meterIndex]!;
    const meterKey = `${meter.beats}/${meter.beatType}`;
    const naturalEnd = measureStart + meterLengthBeats(meter);
    const nextMeter = normalizedMeters[meterIndex + 1];
    let measureEnd = naturalEnd;

    if (
      nextMeter &&
      nextMeter.time > measureStart + EPSILON &&
      nextMeter.time < naturalEnd - EPSILON
    ) {
      diagnostics.push(
        scoreDiagnostic(
          "warning",
          "mid-measure-meter-change",
          `Meter changes at beat ${formatNumericXmlValue(nextMeter.time)} before the current bar completes; rendered a shortened measure before the change.`,
          nextMeter.sourcePath,
        ),
      );
      measureEnd = nextMeter.time;
    }

    measures.push({
      number: measures.length + 1,
      startBeat: measureStart,
      endBeat: measureEnd,
      meter,
      meterChanged: meterKey !== previousMeterKey,
    });
    previousMeterKey = meterKey;
    measureStart = measureEnd;
  }

  return measures;
};

const findMeasureForBeat = (
  beat: number,
  measures: readonly MeasureDefinition[],
): MeasureDefinition | null =>
  measures.find(
    (measure, index) =>
      beat >= measure.startBeat - EPSILON &&
      (beat < measure.endBeat - EPSILON || index === measures.length - 1),
  ) ?? null;

const splitChordIntoMeasures = (
  chord: TimedChord,
  measures: readonly MeasureDefinition[],
): Array<{ measure: number; segment: VoiceSegment }> => {
  const segments: Array<{ measure: number; segment: VoiceSegment }> = [];
  const endTime = chord.time + chord.duration;
  let cursor = chord.time;
  while (cursor < endTime - EPSILON) {
    const measure = findMeasureForBeat(cursor, measures);
    if (!measure) break;
    const segmentEnd = Math.min(endTime, measure.endBeat);
    segments.push({
      measure: measure.number,
      segment: {
        startBeat: cursor - measure.startBeat,
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

const activeClefForStaff = (
  clefs: readonly ScoreClefEvent[] | undefined,
  part: number,
  staff: number,
  time: number,
  fallback: { sign: string; line: string },
): StaffClef => {
  const active = (clefs ?? [])
    .filter(
      (clef) =>
        clef.part === part &&
        clef.staff === staff &&
        clef.time <= time + EPSILON &&
        clef.sign.trim(),
    )
    .sort((a, b) => a.time - b.time)
    .at(-1);
  return {
    staff,
    sign: active?.sign ?? fallback.sign,
    line: String(active?.line ?? Number(fallback.line)),
  };
};

const normalizeRenderableClef = (clef: StaffClef): StaffClef => {
  const line = Number(clef.line);
  const roundedLine = Number.isFinite(line) ? Math.round(line) : Number.NaN;
  if (clef.sign === "G") return { ...clef, line: "2" };
  if (clef.sign === "F") return { ...clef, line: "4" };
  if (clef.sign === "C") return { ...clef, line: roundedLine <= 3 ? "3" : "4" };
  if (clef.sign === "percussion") return { ...clef, line: "2" };
  return { ...clef, sign: "G", line: "2" };
};

const activeKeyAt = (
  keys: readonly ScoreKeyEvent[] | undefined,
  part: number,
  time: number,
): ScoreKeyEvent | null =>
  (keys ?? [])
    .filter(
      (key) =>
        (typeof key.part !== "number" || key.part === part) &&
        key.time <= time + EPSILON &&
        Number.isFinite(key.fifths),
    )
    .sort((a, b) => a.time - b.time)
    .at(-1) ?? null;

const normalizeRenderableKey = (key: ScoreKeyEvent | null): ScoreKeyEvent | null => {
  if (!key) return null;
  const fifths = Math.round(key.fifths);
  if (fifths < -7 || fifths > 7) return null;
  const mode = key.mode && RENDERABLE_KEY_MODES.has(key.mode) ? key.mode : undefined;
  if (mode) return { ...key, fifths, mode };
  return {
    time: key.time,
    fifths,
    ...(typeof key.part === "number" ? { part: key.part } : {}),
    ...(key.sourcePath ? { sourcePath: key.sourcePath } : {}),
  };
};

const activeTempoAt = (
  tempos: readonly ScoreTempoEvent[] | undefined,
  time: number,
): ScoreTempoEvent | null =>
  (tempos ?? [])
    .filter((tempo) => tempo.time <= time + EPSILON && tempo.bpm > 0)
    .sort((a, b) => a.time - b.time)
    .at(-1) ?? null;

const makeAttributesNode = ({
  clefs,
  staffCount,
  meter,
  key,
  divisions,
}: {
  clefs: readonly StaffClef[];
  staffCount: number;
  meter: NormalizedMeter;
  key: ScoreKeyEvent | null;
  divisions: number;
}): ScoreXmlNode => {
  const renderableKey = normalizeRenderableKey(key);
  const renderableClefs = clefs.map(normalizeRenderableClef);
  return {
    name: "attributes",
    children: [
      textNode("divisions", String(divisions)),
      {
        name: "key",
        children: [
          textNode("fifths", String(renderableKey?.fifths ?? 0)),
          ...(renderableKey?.mode && renderableKey.mode !== "none"
            ? [textNode("mode", renderableKey.mode)]
            : []),
        ],
      },
      {
        name: "time",
        children: [
          textNode("beats", String(meter.beats)),
          textNode("beat-type", String(meter.beatType)),
        ],
      },
      ...(staffCount > 1 ? [textNode("staves", String(staffCount))] : []),
      ...renderableClefs.map((clef) => ({
        name: "clef",
        ...(staffCount > 1 ? { attributes: { number: String(clef.staff) } } : {}),
        children: [textNode("sign", clef.sign), textNode("line", clef.line)],
      })),
    ],
  };
};

const makeMeasureNode = (
  measure: MeasureDefinition,
  segments: readonly VoiceSegment[],
  attributes: { clefs: readonly StaffClef[]; key: ScoreKeyEvent | null } | null,
  staffCount: number,
  dynamicCodesByVoice: Map<number, number | null>,
  divisions: number,
  tempo: ScoreTempoEvent | null,
): { node: ScoreXmlNode; diagnostics: ScoreBuildResult["diagnostics"] } => {
  const diagnostics: ScoreBuildResult["diagnostics"] = [];
  const children: ScoreXmlNode[] = [];
  if (attributes) {
    children.push(
      makeAttributesNode({
        clefs: attributes.clefs,
        staffCount,
        meter: measure.meter,
        key: attributes.key,
        divisions,
      }),
    );
  }
  if (tempo) children.push(makeTempoDirection(tempo.bpm));

  const segmentsByVoice = new Map<number, VoiceSegment[]>();
  segments.forEach((segment) => {
    const current = segmentsByVoice.get(segment.voice) ?? [];
    current.push(segment);
    segmentsByVoice.set(segment.voice, current);
  });

  const voices = [...segmentsByVoice.keys()].sort((a, b) => a - b);
  const activeVoices = voices.length > 0 ? voices : [1];

  activeVoices.forEach((voice, voiceIndex) => {
    const voiceSegments = (segmentsByVoice.get(voice) ?? []).sort(
      (a, b) => a.startBeat - b.startBeat || a.duration - b.duration,
    );
    const fallbackStaff =
      voiceSegments.find((segment) => typeof segment.staff === "number")?.staff ??
      (staffCount > 1 ? 1 : undefined);

    if (voiceIndex > 0) {
      children.push({
        name: "backup",
        children: [
          textNode("duration", durationToDivisions(measure.endBeat - measure.startBeat, divisions)),
        ],
      });
    }

    let cursor = 0;
    let lastDynamicCode = dynamicCodesByVoice.get(voice) ?? null;

    voiceSegments.forEach((segment) => {
      if (segment.startBeat < cursor - EPSILON) {
        diagnostics.push(
          scoreDiagnostic(
            "warning",
            "overlapping-note",
            `Skipped an overlapping note in measure ${measure.number}, voice ${voice}.`,
          ),
        );
        return;
      }

      if (segment.startBeat > cursor + EPSILON) {
        children.push(makeRestNote(segment.startBeat - cursor, voice, segment.staff, divisions));
      }

      if (lastDynamicCode !== segment.dynamicCode) {
        const direction = makeDynamicDirection(segment.dynamicCode);
        if (direction) children.push(direction);
        lastDynamicCode = segment.dynamicCode;
        dynamicCodesByVoice.set(voice, segment.dynamicCode);
      }

      segment.notes.forEach((note, index) => {
        children.push(makePitchedNote(note, segment, index > 0, divisions));
      });
      cursor = segment.startBeat + segment.duration;
    });

    const measureLength = measure.endBeat - measure.startBeat;
    if (cursor < measureLength - EPSILON) {
      children.push(makeRestNote(measureLength - cursor, voice, fallbackStaff, divisions));
    }
  });

  return {
    node: { name: "measure", attributes: { number: String(measure.number) }, children },
    diagnostics,
  };
};

const buildPartNode = (
  partNumber: number,
  notes: readonly ScoreNoteEvent[],
  chords: readonly TimedChord[],
  measures: readonly MeasureDefinition[],
  options: Required<Pick<ScoreBuildOptions, "divisions">> &
    Pick<ScoreBuildOptions, "parts" | "clefs" | "tempos" | "keys">,
): { node: ScoreXmlNode; diagnostics: ScoreBuildResult["diagnostics"] } => {
  const diagnostics: ScoreBuildResult["diagnostics"] = [];
  const partLayer = (options.parts ?? []).find((part) => part.part === partNumber);
  const staffCount = Math.max(
    1,
    partLayer?.staffCount ?? 1,
    ...notes.map((note) => note.staff ?? 1),
  );
  const inferredClefs = Array.from({ length: staffCount }, (_, index) => {
    const staff = index + 1;
    return {
      staff,
      ...inferClef(notes.filter((note) => (note.staff ?? 1) === staff)),
    };
  });
  const dynamicCodesByVoice = new Map<number, number | null>();
  const segmentsByMeasure = new Map<number, VoiceSegment[]>();
  chords.forEach((chord) => {
    splitChordIntoMeasures(chord, measures).forEach(({ measure, segment }) => {
      const current = segmentsByMeasure.get(measure) ?? [];
      current.push(segment);
      segmentsByMeasure.set(measure, current);
    });
  });

  let lastAttributesKey = "";
  let lastTempoBpm: number | null = null;
  const children = measures.map((measure) => {
    const clefs = inferredClefs.map((fallback) =>
      activeClefForStaff(options.clefs, partNumber, fallback.staff, measure.startBeat, fallback),
    );
    const key = activeKeyAt(options.keys, partNumber, measure.startBeat);
    const attributesKey = JSON.stringify({
      meter: [measure.meter.beats, measure.meter.beatType],
      key: [key?.fifths ?? 0, key?.mode ?? ""],
      clefs,
      staffCount,
    });
    const includeAttributes = measure.number === 1 || attributesKey !== lastAttributesKey;
    if (includeAttributes) lastAttributesKey = attributesKey;

    const tempo = activeTempoAt(options.tempos, measure.startBeat);
    const includeTempo = tempo && tempo.bpm !== lastTempoBpm;
    if (tempo) lastTempoBpm = tempo.bpm;

    const { node, diagnostics: measureDiagnostics } = makeMeasureNode(
      measure,
      segmentsByMeasure.get(measure.number) ?? [],
      includeAttributes ? { clefs, key } : null,
      staffCount,
      dynamicCodesByVoice,
      options.divisions,
      includeTempo ? tempo : null,
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
  options: ScoreBuildOptions = {},
): ScoreBuildResult => {
  const adapterId = options.adapterId ?? SCORE_NOTE_EVENTS_ADAPTER_ID;
  const divisions = Math.max(1, Math.round(options.divisions ?? DEFAULT_DIVISIONS));
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
  const partNumbers = [
    ...new Set([
      ...notes.map((note) => note.part ?? 1),
      ...(options.parts ?? []).map((part) => part.part),
    ]),
  ].sort((a, b) => a - b);
  const maxEndBeat = notes.reduce((max, note) => Math.max(max, note.time + note.duration), 0);
  const measures = buildMeasureMap(maxEndBeat, options.meters, diagnostics);
  const measureCount = measures.length;

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
      measures,
      {
        divisions,
        parts: options.parts,
        clefs: options.clefs,
        tempos: options.tempos,
        keys: options.keys,
      },
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
