import { browser } from "$app/environment";

import type { StudioPluginRuntimeData } from "$lib/studio/plugins/runtime";

export type StudioMidiNote = {
  time: number;
  duration: number;
  pitch: number;
  velocity: number;
  channel: number;
};

export type StudioMidiClip = {
  tempo: number;
  ppq: number;
  notes: StudioMidiNote[];
  lengthBeats: number;
  skippedNotes: number;
};

const PPQ = 480;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const clampVelocity = (value: number) => Math.max(0, Math.min(127, Math.round(value)));

const sanitizeFileName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "dcn-midi-clip";
  return trimmed.replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "");
};

export const pluginRuntimeToMidiClip = (
  runtimeData: StudioPluginRuntimeData,
  options?: { tempo?: number },
): StudioMidiClip => {
  const tempo = Number.isFinite(options?.tempo) ? Math.max(10, Number(options?.tempo)) : 120;
  const notes: StudioMidiNote[] = [];
  let skippedNotes = 0;

  runtimeData.midiGroups.forEach((group, groupIndex) => {
    if (!group.pitch || !group.time || !group.duration || !group.velocity) return;
    const maxLength = Math.max(
      group.pitch.data.length,
      group.time.data.length,
      group.duration.data.length,
      group.velocity.data.length,
    );
    const channel = (groupIndex % 16) + 1;

    for (let i = 0; i < maxLength; i += 1) {
      const pitchValue = group.pitch.data[i];
      const timeValue = group.time.data[i];
      const durationValue = group.duration.data[i];
      const velocityValue = group.velocity.data[i];

      if (
        !isFiniteNumber(pitchValue) ||
        !isFiniteNumber(timeValue) ||
        !isFiniteNumber(durationValue) ||
        !isFiniteNumber(velocityValue)
      ) {
        skippedNotes += 1;
        continue;
      }

      if (durationValue <= 0 || timeValue < 0) {
        skippedNotes += 1;
        continue;
      }

      const pitch = Math.round(pitchValue);
      if (pitch < 0 || pitch > 127) {
        skippedNotes += 1;
        continue;
      }

      notes.push({
        time: timeValue,
        duration: durationValue,
        pitch,
        velocity: clampVelocity(velocityValue),
        channel,
      });
    }
  });

  notes.sort((a, b) => (a.time === b.time ? a.pitch - b.pitch : a.time - b.time));
  const lengthBeats = notes.reduce((max, note) => Math.max(max, note.time + note.duration), 0);
  return { tempo, ppq: PPQ, notes, lengthBeats, skippedNotes };
};

const write16be = (value: number): number[] => [(value >> 8) & 0xff, value & 0xff];

const write32be = (value: number): number[] => [
  (value >> 24) & 0xff,
  (value >> 16) & 0xff,
  (value >> 8) & 0xff,
  value & 0xff,
];

const encodeVarLen = (value: number): number[] => {
  let buffer = value & 0x7f;
  let next = value >>> 7;
  while (next > 0) {
    buffer <<= 8;
    buffer |= (next & 0x7f) | 0x80;
    next >>>= 7;
  }
  const bytes: number[] = [];
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) {
      buffer >>>= 8;
    } else {
      break;
    }
  }
  return bytes;
};

type MidiEvent = {
  tick: number;
  rank: number;
  status: number;
  data1: number;
  data2: number;
};

export const encodeMidiClip = (clip: StudioMidiClip): Uint8Array => {
  const events: MidiEvent[] = [];
  clip.notes.forEach((note) => {
    const startTick = Math.max(0, Math.round(note.time * clip.ppq));
    const endTick = Math.max(startTick + 1, Math.round((note.time + note.duration) * clip.ppq));
    const channel = Math.max(0, Math.min(15, note.channel - 1));
    events.push({
      tick: startTick,
      rank: 1,
      status: 0x90 | channel,
      data1: note.pitch,
      data2: note.velocity,
    });
    events.push({
      tick: endTick,
      rank: 0,
      status: 0x80 | channel,
      data1: note.pitch,
      data2: 0,
    });
  });

  events.sort((a, b) => (a.tick === b.tick ? a.rank - b.rank : a.tick - b.tick));

  const track: number[] = [];
  const tempoMicros = Math.max(1, Math.round(60_000_000 / clip.tempo));
  track.push(0x00, 0xff, 0x51, 0x03, ...write32be(tempoMicros).slice(1));

  let cursorTick = 0;
  events.forEach((event) => {
    const delta = Math.max(0, event.tick - cursorTick);
    track.push(...encodeVarLen(delta), event.status, event.data1, event.data2);
    cursorTick = event.tick;
  });
  track.push(0x00, 0xff, 0x2f, 0x00);

  const header = [
    0x4d,
    0x54,
    0x68,
    0x64, // MThd
    ...write32be(6),
    ...write16be(0), // format 0
    ...write16be(1), // one track
    ...write16be(clip.ppq),
  ];
  const trackChunk = [
    0x4d,
    0x54,
    0x72,
    0x6b, // MTrk
    ...write32be(track.length),
    ...track,
  ];
  return Uint8Array.from([...header, ...trackChunk]);
};

export const downloadMidiClip = (clip: StudioMidiClip, fileName: string) => {
  if (!browser) return;
  const bytes = encodeMidiClip(clip);
  const blobPayload = new Uint8Array(bytes.byteLength);
  blobPayload.set(bytes);
  const blob = new Blob([blobPayload.buffer], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sanitizeFileName(fileName)}.mid`;
  anchor.click();
  URL.revokeObjectURL(url);
};
