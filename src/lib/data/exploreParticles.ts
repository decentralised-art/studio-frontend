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
};

export const mockParticleViews: ParticleView[] = [
  { id: "music-score", label: "Music Score", description: "Rendered as notation." },
  { id: "midi", label: "MIDI", description: "Playable MIDI sequences." },
  { id: "audio-file", label: "Audio File", description: "Audio render output." },
  { id: "image-jpeg", label: "Image JPEG", description: "Still frame output." },
];

export const mockExploreParticles: ExploreParticle[] = [
  {
    id: "particle-echo-bloom",
    name: "Echo Bloom",
    summary: "Call-and-response phrases bloom into a stereo field.",
    authorId: "user-lyra",
    viewId: "audio-file",
    createdAt: 1734800400000,
    createdLabel: "2h ago",
    ingredients: ["Harmonic Shift", "Granular Bloom", "Tempo Weave"],
    complexity: 3,
    transactionName: "Bloom Relay",
    dependencies: ["Pulse Lattice", "Harmonic Drift", "Reverb Prism"],
  },
  {
    id: "particle-pulse-gate",
    name: "Pulse Gate",
    summary: "The mix unlocks only when the beat map crosses a threshold.",
    authorId: "user-milo",
    viewId: "midi",
    createdAt: 1734793200000,
    createdLabel: "5h ago",
    ingredients: ["Threshold LFO", "Beat Map", "Meter Sync"],
    complexity: 4,
    transactionName: "Gatekeeper",
    dependencies: ["Beat Map", "Meter Sync", "Latch Drift", "Phase Lock"],
  },
  {
    id: "particle-spectral-mirror",
    name: "Spectral Mirror",
    summary: "Incoming spectra reflect into harmonic twins.",
    authorId: "user-rae",
    viewId: "image-jpeg",
    createdAt: 1734710400000,
    createdLabel: "Yesterday",
    ingredients: ["Phase Prism", "Harmonic Sweep"],
    complexity: 2,
    transactionName: "Mirror Stack",
    dependencies: ["Phase Prism", "Harmonic Sweep"],
  },
  {
    id: "particle-score-weave",
    name: "Score Weave",
    summary: "Multi-voice notation rethreads motifs into a woven score.",
    authorId: "user-jun",
    viewId: "music-score",
    createdAt: 1734624000000,
    createdLabel: "2d ago",
    ingredients: ["Motif Relay", "Tempo Loom", "Cadence Knot"],
    complexity: 5,
    transactionName: "Weave PT",
    dependencies: ["Motif Relay", "Tempo Loom", "Cadence Knot", "Dynamic Trace", "Phrase Arc"],
  },
  {
    id: "particle-tempo-lattice",
    name: "Tempo Lattice",
    summary: "Tempo nudges become quantized lattices for collaborators.",
    authorId: "user-iris",
    viewId: "midi",
    createdAt: 1734537600000,
    createdLabel: "3d ago",
    ingredients: ["Pulse Grid", "Sync Drift", "Meter Snap"],
    complexity: 3,
    transactionName: "Lattice Sync",
    dependencies: ["Pulse Grid", "Sync Drift", "Meter Snap"],
  },
  {
    id: "particle-aurora-still",
    name: "Aurora Still",
    summary: "Chromatic trails condense into a single visual snapshot.",
    authorId: "user-nia",
    viewId: "image-jpeg",
    createdAt: 1734451200000,
    createdLabel: "4d ago",
    ingredients: ["Spectral Trace", "Light Fold"],
    complexity: 2,
    transactionName: "Aurora Capture",
    dependencies: ["Spectral Trace", "Light Fold"],
  },
];
