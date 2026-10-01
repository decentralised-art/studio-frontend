import type { ExploreParticle } from "$lib/data/exploreParticles";
import type { LibraryItem } from "$lib/data/studioLibrary";
import type { RuntimeFeatureDef, RuntimeParticleDef } from "$lib/particles/runtimeModel";
import type { StudioConnectorDef } from "$lib/studio/domain/connectorModel";
import type {
  ConditionDraftRuntime,
  TransformationDraftRuntime,
} from "$lib/studio/solidityDraftRuntime";

export type RuntimeTransformationDef = {
  argc: number;
  run: TransformationDraftRuntime;
};

export type RuntimeConditionDef = {
  argc: number;
  check: ConditionDraftRuntime;
};

export type DeployedRegistry = {
  connectors: Record<string, StudioConnectorDef>;
  features: Record<string, RuntimeFeatureDef>;
  particles: Record<string, RuntimeParticleDef>;
  transformations: Record<string, RuntimeTransformationDef>;
  conditions: Record<string, RuntimeConditionDef>;
};

export type DeployedLibrary = {
  features: LibraryItem[];
  transformations: LibraryItem[];
  conditions: LibraryItem[];
};

export const createEmptyDeployedRegistry = (): DeployedRegistry => ({
  connectors: {},
  features: {},
  particles: {},
  transformations: {},
  conditions: {},
});

export const createEmptyDeployedLibrary = (): DeployedLibrary => ({
  features: [],
  transformations: [],
  conditions: [],
});

export const upsertLibraryItem = (items: LibraryItem[], next: LibraryItem): LibraryItem[] => {
  if (items.some((item) => item.id === next.id)) return items;
  return [...items, next];
};

export const upsertParticleItem = (
  items: ExploreParticle[],
  next: ExploreParticle,
): ExploreParticle[] => {
  if (items.some((item) => item.id === next.id)) return items;
  return [...items, next];
};
