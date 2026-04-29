import type { MidiNote } from "$lib/midi/midiClip";

export type PtOutputFeature = {
  feature_path: string;
  data: number[];
};

export type { MidiNote };

export type MidiParticle = {
  tempo: number;
  lengthBeats: number;
  notes: MidiNote[];
  channels: number;
};

export type PtToMidiOptions = {
  basePitch?: number;
  defaultDuration?: number;
  defaultStep?: number;
  defaultVelocity?: number;
  defaultTempo?: number;
};

type FeatureBucket = {
  pitch?: number[];
  time?: number[];
  duration?: number[];
  velocity?: number[];
};

const clampMidi = (value: number) => Math.min(127, Math.max(0, Math.round(value)));

const normalizePath = (path: string) => path.trim().replace(/\/+/g, "/");

const splitFeaturePath = (path: string) => {
  const cleaned = normalizePath(path);
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length === 0) return { group: "", type: "" };
  const type = parts[parts.length - 1] ?? "";
  let groupParts = parts.slice(0, -1);
  if (["pitch", "time", "duration", "velocity"].includes(type)) {
    const parent = parts[parts.length - 2] ?? "";
    if (parent.includes("map")) {
      groupParts = parts.slice(0, -2);
    }
  }
  const group = groupParts.length > 0 ? `/${groupParts.join("/")}` : "";
  return { group, type };
};

export const ptOutputToMidi = (
  features: PtOutputFeature[],
  options: PtToMidiOptions = {},
): MidiParticle => {
  const {
    basePitch = 60,
    defaultDuration = 0.5,
    defaultStep = 1,
    defaultVelocity = 90,
    defaultTempo = 120,
  } = options;

  const buckets = new Map<string, FeatureBucket>();
  let tempo = defaultTempo;

  for (const feature of features) {
    const { group, type } = splitFeaturePath(feature.feature_path);
    if (!type) continue;

    if (type === "tempo" && feature.data.length > 0) {
      const nextTempo = feature.data[0];
      if (Number.isFinite(nextTempo)) tempo = nextTempo;
      continue;
    }

    if (!group) continue;
    const bucket = buckets.get(group) ?? {};
    if (type === "pitch") bucket.pitch = feature.data;
    if (type === "time") bucket.time = feature.data;
    if (type === "duration") bucket.duration = feature.data;
    if (type === "velocity") bucket.velocity = feature.data;
    buckets.set(group, bucket);
  }

  const groups = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
  const notes: MidiNote[] = [];

  groups.forEach(([group, bucket], index) => {
    const channel = (index % 16) + 1;
    const maxLength = Math.max(
      bucket.pitch?.length ?? 0,
      bucket.time?.length ?? 0,
      bucket.duration?.length ?? 0,
      bucket.velocity?.length ?? 0,
    );

    for (let i = 0; i < maxLength; i += 1) {
      const time = bucket.time?.[i] ?? i * defaultStep;
      const duration = bucket.duration?.[i] ?? defaultDuration;
      const velocity = bucket.velocity?.[i] ?? defaultVelocity;
      const pitch = bucket.pitch?.[i] ?? 0;
      const midiPitch = clampMidi(basePitch + pitch);

      notes.push({
        time,
        duration,
        pitch: midiPitch,
        velocity: clampMidi(velocity),
        channel,
        groupPath: group,
      });
    }
  });

  const lengthBeats = notes.reduce((max, note) => Math.max(max, note.time + note.duration), 0);

  return {
    tempo,
    lengthBeats,
    notes,
    channels: Math.max(groups.length, 1),
  };
};
