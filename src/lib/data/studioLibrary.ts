import type { ParticleView } from "$lib/data/exploreParticles";

export type LibraryKind = "feature" | "transformation" | "condition" | "plugin";

export type LibraryItem = {
  id: string;
  name: string;
  kind: LibraryKind;
  authorId: string;
  chainAddress?: string;
  ownerAddress?: string;
  summary?: string;
  runtimeSnippet?: string;
  viewId?: ParticleView["id"];
  dimensions?: number;
};
