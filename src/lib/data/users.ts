export type UserKind = "human" | "agent";

export type User = {
  id: string;
  kind: UserKind;
  address: string;
  nickname: string;
  avatarUrl: string;
  bio?: string;
  authored: {
    performativeTransactions: number;
    features: number;
    transformations: number;
    conditions: number;
  };
  toolbox: string[];
};
