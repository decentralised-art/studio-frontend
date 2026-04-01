import { mockUsers } from "$lib/data/users";
import { mockRegistrySnapshot } from "$lib/particles/mockPtNetwork";

export type ParticleView = {
  id: string;
  label: string;
  description?: string;
};

export type ExploreParticle = {
  id: string;
  name: string;
  summary: string;
  authorId: string;
  viewId: ParticleView["id"];
  createdAt: number;
  createdLabel: string;
  ingredients: string[];
  complexity: number;
  transactionName: string;
  dependencies: string[];
  formatHash?: string;
};

export const mockParticleViews: ParticleView[] = [
  { id: "music-score", label: "Music Score", description: "Rendered as notation." },
  { id: "midi", label: "MIDI", description: "Playable MIDI sequences." },
  { id: "audio-file", label: "Audio File", description: "Audio render output." },
  { id: "image-jpeg", label: "Image JPEG", description: "Still frame output." },
];

const defaultAuthorId = mockUsers[0]?.id ?? "user-lyra";

const particleMeta: Record<
  string,
  {
    name: string;
    summary: string;
    authorId: string;
    viewId: ParticleView["id"];
    createdAt: number;
    createdLabel: string;
    ingredients: string[];
    transactionName: string;
  }
> = {
  "score-weave": {
    name: "Score Weave",
    summary: "Two interlocked melodies ripple through a swung index lattice.",
    authorId: "user-jun",
    viewId: "music-score",
    createdAt: 1734807600000,
    createdLabel: "1h ago",
    ingredients: ["Weave Index", "Melody Duo", "Scale Fold"],
    transactionName: "Weave PT",
  },
  "melody-duo": {
    name: "Melody Duo",
    summary: "A dual-channel call between two mapped melodies.",
    authorId: "user-lyra",
    viewId: "midi",
    createdAt: 1734800400000,
    createdLabel: "3h ago",
    ingredients: ["Duo Index", "Melody", "Melody Alt"],
    transactionName: "Duo Relay",
  },
  melody: {
    name: "Melody",
    summary: "Pitch, time, duration, velocity indexes mapped into a single line.",
    authorId: "user-iris",
    viewId: "midi",
    createdAt: 1734793200000,
    createdLabel: "5h ago",
    ingredients: ["Melody Indexes", "Pitch Map", "Time Map"],
    transactionName: "Melody Stack",
  },
  "melody-alt": {
    name: "Melody Alt",
    summary: "Minor-scale variation of the mapped melody stream.",
    authorId: "user-rae",
    viewId: "midi",
    createdAt: 1734710400000,
    createdLabel: "Yesterday",
    ingredients: ["Melody Variation", "Pitch Map Minor"],
    transactionName: "Alt Stack",
  },
  "pitch-map": {
    name: "Pitch Map",
    summary: "Major-scale indexes mapped onto pitch values.",
    authorId: "user-milo",
    viewId: "midi",
    createdAt: 1734624000000,
    createdLabel: "2d ago",
    ingredients: ["Major Scale Pattern", "Pitch Values"],
    transactionName: "Pitch Map",
  },
  "pitch-map-minor": {
    name: "Pitch Map Minor",
    summary: "Minor-scale indexes mapped onto pitch values.",
    authorId: "user-lyra",
    viewId: "midi",
    createdAt: 1734537600000,
    createdLabel: "3d ago",
    ingredients: ["Minor Scale Pattern", "Pitch Values"],
    transactionName: "Pitch Map Minor",
  },
  "time-map": {
    name: "Time Map",
    summary: "Rhythm indexes mapped onto beat positions.",
    authorId: "user-jun",
    viewId: "midi",
    createdAt: 1734451200000,
    createdLabel: "4d ago",
    ingredients: ["Rhythm Pattern", "Time Values"],
    transactionName: "Time Map",
  },
  "duration-map": {
    name: "Duration Map",
    summary: "Duration indexes mapped onto duration values.",
    authorId: "user-iris",
    viewId: "midi",
    createdAt: 1734364800000,
    createdLabel: "5d ago",
    ingredients: ["Duration Pattern", "Duration Values"],
    transactionName: "Duration Map",
  },
  "velocity-map": {
    name: "Velocity Map",
    summary: "Velocity indexes mapped onto velocity values.",
    authorId: "user-nia",
    viewId: "midi",
    createdAt: 1734278400000,
    createdLabel: "6d ago",
    ingredients: ["Velocity Pattern", "Velocity Values"],
    transactionName: "Velocity Map",
  },
  pitch: {
    name: "Pitch",
    summary: "Raw pitch values seeded from a starting note.",
    authorId: "user-lyra",
    viewId: "midi",
    createdAt: 1734192000000,
    createdLabel: "1w ago",
    ingredients: ["Pitch Values"],
    transactionName: "Pitch Seed",
  },
  time: {
    name: "Time",
    summary: "Raw beat positions generated from a steady index.",
    authorId: "user-milo",
    viewId: "midi",
    createdAt: 1734105600000,
    createdLabel: "1w ago",
    ingredients: ["Time Values"],
    transactionName: "Time Seed",
  },
  duration: {
    name: "Duration",
    summary: "Raw duration values in a looping pattern.",
    authorId: "user-jun",
    viewId: "midi",
    createdAt: 1734019200000,
    createdLabel: "1w ago",
    ingredients: ["Duration Values"],
    transactionName: "Duration Seed",
  },
  velocity: {
    name: "Velocity",
    summary: "Raw velocity values in a looping pattern.",
    authorId: "user-iris",
    viewId: "midi",
    createdAt: 1733932800000,
    createdLabel: "1w ago",
    ingredients: ["Velocity Values"],
    transactionName: "Velocity Seed",
  },
};

const particlesByName = new Map(
  mockRegistrySnapshot.particles.map((particle) => [particle.name, particle]),
);

const complexityCache = new Map<string, number>();

const computeComplexity = (name: string, stack = new Set<string>()) => {
  if (complexityCache.has(name)) return complexityCache.get(name) ?? 1;
  if (stack.has(name)) return 1;
  stack.add(name);
  const particle = particlesByName.get(name);
  if (!particle) return 1;
  let total = 1;
  particle.composites.forEach((compositeName) => {
    if (compositeName) total += computeComplexity(compositeName, stack);
  });
  stack.delete(name);
  complexityCache.set(name, total);
  return total;
};

export const mockExploreParticles: ExploreParticle[] = mockRegistrySnapshot.particles
  .map((particle, index) => {
    const meta = particleMeta[particle.name];
    const createdAt = meta?.createdAt ?? Date.now() - index * 60 * 60 * 1000;
    const dependencies = particle.composites.filter(Boolean) as string[];
    const fallbackName = particle.name;
    const fallbackIngredients = [particle.featureName, ...dependencies];
    return {
      id: particle.name,
      name: meta?.name ?? fallbackName,
      summary: meta?.summary ?? `${fallbackName} particle.`,
      authorId: meta?.authorId ?? defaultAuthorId,
      viewId: meta?.viewId ?? "midi",
      createdAt,
      createdLabel: meta?.createdLabel ?? "recently",
      ingredients: meta?.ingredients ?? fallbackIngredients,
      complexity: computeComplexity(particle.name),
      transactionName: meta?.transactionName ?? `${fallbackName} PT`,
      dependencies,
    };
  })
  .sort((a, b) => b.createdAt - a.createdAt);
