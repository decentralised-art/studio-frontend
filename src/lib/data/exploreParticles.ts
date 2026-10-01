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
