import type { ParticleView } from "$lib/data/exploreParticles";
import { mockUsers } from "$lib/data/users";
import { mockRegistrySnapshot } from "$lib/particles/mockPtNetwork";

export type LibraryKind = "feature" | "transformation" | "condition" | "plugin";

export type LibraryItem = {
  id: string;
  name: string;
  kind: LibraryKind;
  authorId: string;
  summary?: string;
  runtimeSnippet?: string;
  viewId?: ParticleView["id"];
  dimensions?: number;
};

const defaultAuthorId = mockUsers[0]?.id ?? "user-lyra";

const featureMeta: Record<string, { name?: string; summary?: string; authorId?: string }> = {
  "major-scale-pattern": {
    name: "Major Scale Pattern",
    summary: "Pitch indexes that outline a major scale lattice.",
    authorId: "user-lyra",
  },
  "rhythm-pattern": {
    name: "Rhythm Pattern",
    summary: "Beat grid for rhythmic index mapping.",
    authorId: "user-jun",
  },
  "velocity-pattern": {
    name: "Velocity Jitter",
    summary: "Micro-variation pattern for dynamics.",
    authorId: "user-nia",
  },
  "pitch-values": {
    summary: "Raw pitch value stream.",
    authorId: "user-lyra",
  },
  "time-values": {
    summary: "Raw time index stream.",
    authorId: "user-milo",
  },
  "duration-values": {
    summary: "Raw duration stream.",
    authorId: "user-jun",
  },
  "velocity-values": {
    summary: "Raw velocity stream.",
    authorId: "user-iris",
  },
};

const transformationMeta: Record<string, { name?: string; summary?: string; authorId?: string }> = {
  add: {
    name: "Add",
    summary: "Adds a constant to each value.",
    authorId: "user-milo",
  },
  subtract: {
    name: "Subtract",
    summary: "Subtracts a constant from each value.",
    authorId: "user-rae",
  },
  addWrap: {
    name: "Add Wrap",
    summary: "Adds with modular wraparound.",
    authorId: "user-rae",
  },
  mirror: {
    name: "Mirror",
    summary: "Mirrors values around an axis.",
    authorId: "user-iris",
  },
};

const conditionMeta: Record<string, { name?: string; summary?: string; authorId?: string }> = {
  "always-true": {
    name: "Always True",
    summary: "Always passes.",
    authorId: "user-lyra",
  },
  "always-false": {
    name: "Always False",
    summary: "Always blocks.",
    authorId: "user-rae",
  },
  "min-arg": {
    name: "Min Arg",
    summary: "Passes when the argument is greater than zero.",
    authorId: "user-jun",
  },
};

export const mockFeatures: LibraryItem[] = mockRegistrySnapshot.features.map((feature) => {
  const meta = featureMeta[feature.name];
  return {
    id: `feature-${feature.name}`,
    name: feature.name,
    kind: "feature",
    authorId: meta?.authorId ?? defaultAuthorId,
    summary: meta?.summary,
    dimensions: feature.dimensions.length,
  };
});

export const mockTransformations: LibraryItem[] = mockRegistrySnapshot.transformations.map(
  (transformation) => {
    const meta = transformationMeta[transformation.name];
    return {
      id: `transform-${transformation.name}`,
      name: transformation.name,
      kind: "transformation",
      authorId: meta?.authorId ?? defaultAuthorId,
      summary: meta?.summary ?? `Requires ${transformation.argc} arg(s).`,
    };
  },
);

export const mockConditions: LibraryItem[] = mockRegistrySnapshot.conditions.map((condition) => {
  const meta = conditionMeta[condition.name];
  return {
    id: `condition-${condition.name}`,
    name: condition.name,
    kind: "condition",
    authorId: meta?.authorId ?? defaultAuthorId,
    summary: meta?.summary ?? `Requires ${condition.argc} arg(s).`,
  };
});

// Legacy in-app plugins were retired from Studio explorer UI.
export const mockPlugins: LibraryItem[] = [];
