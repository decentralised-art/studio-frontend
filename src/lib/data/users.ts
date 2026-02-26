import { asset } from "$app/paths";

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

export type ChainSyncSource = {
  id: string;
  address: string;
  label: string;
};

export const mockUsers: User[] = [
  {
    id: "user-lyra",
    kind: "human",
    address: "0x48f750696ed392ca6d449a3d214656d024c5756f",
    nickname: "Lyra N.",
    avatarUrl: asset("/avatars/lyra.svg"),
    bio: "Composer and PT architect shaping spatial rhythm studies.",
    authored: {
      performativeTransactions: 12,
      features: 8,
      transformations: 6,
      conditions: 4,
    },
    toolbox: ["particle-score-weave", "particle-aurora-still"],
  },
  {
    id: "user-milo",
    kind: "human",
    address: "0x06ae7be53aea4757f87246b7cbc42ba3d21c3b4e",
    nickname: "Milo K.",
    avatarUrl: asset("/avatars/milo.svg"),
    bio: "Builds rhythmic agents and lattice-driven PTs.",
    authored: {
      performativeTransactions: 9,
      features: 11,
      transformations: 5,
      conditions: 7,
    },
    toolbox: ["particle-echo-bloom", "particle-tempo-lattice"],
  },
  {
    id: "user-rae",
    kind: "human",
    address: "0x268b41fdfce41ea40afed26444378750a44d3912",
    nickname: "Rae S.",
    avatarUrl: asset("/avatars/rae.svg"),
    bio: "Explores spectral mirrors and chroma feedback loops.",
    authored: {
      performativeTransactions: 7,
      features: 6,
      transformations: 9,
      conditions: 3,
    },
    toolbox: ["particle-pulse-gate"],
  },
  {
    id: "user-jun",
    kind: "human",
    address: "0xae1a75aac9be84d9d090d92178349ef3bb8fbe7b",
    nickname: "Jun A.",
    avatarUrl: asset("/avatars/jun.svg"),
    bio: "Weaves collaborative scores and tempo-linked PTs.",
    authored: {
      performativeTransactions: 10,
      features: 5,
      transformations: 4,
      conditions: 6,
    },
    toolbox: ["particle-echo-bloom", "particle-score-weave"],
  },
  {
    id: "user-iris",
    kind: "human",
    address: "0xa20601f5bf74e38450e5d3e0d78f1c29c3ce8792",
    nickname: "Iris Q.",
    avatarUrl: asset("/avatars/iris.svg"),
    bio: "Builds adaptive tempo lattices and sync logic.",
    authored: {
      performativeTransactions: 6,
      features: 9,
      transformations: 3,
      conditions: 4,
    },
    toolbox: ["particle-aurora-still"],
  },
  {
    id: "user-nia",
    kind: "human",
    address: "0x827dfab1ad121d8bacdf7c3f4b81625874986466",
    nickname: "Nia P.",
    avatarUrl: asset("/avatars/nia.svg"),
    bio: "Visual storyteller shaping chromatic PTs.",
    authored: {
      performativeTransactions: 5,
      features: 4,
      transformations: 5,
      conditions: 2,
    },
    toolbox: ["particle-spectral-mirror", "particle-tempo-lattice"],
  },
  {
    id: "agent-aurora",
    kind: "agent",
    address: "0xa6d72eb57f0163df7a7124a0fd7888771840b500",
    nickname: "Aurora Agent",
    avatarUrl: asset("/avatars/aurora.svg"),
    bio: "Autonomous arranger tuned for emergent harmony.",
    authored: {
      performativeTransactions: 14,
      features: 6,
      transformations: 8,
      conditions: 5,
    },
    toolbox: ["particle-echo-bloom", "particle-score-weave"],
  },
];

export const mockUsersById = Object.fromEntries(
  mockUsers.map((user) => [user.id, user] as const),
) as Record<User["id"], User>;

export const mockCurrentUserId: User["id"] = "user-lyra";

export const mockFollowingByUserId: Partial<Record<User["id"], User["id"][]>> = {
  "user-lyra": ["user-jun", "user-iris", "agent-aurora"],
  "user-milo": ["user-lyra", "user-jun"],
  "user-rae": ["user-lyra", "user-nia"],
  "user-jun": ["user-lyra", "user-iris", "agent-aurora"],
  "user-iris": ["user-lyra", "user-jun"],
  "user-nia": ["user-lyra", "agent-aurora"],
  "agent-aurora": ["user-lyra", "user-jun", "user-iris"],
};

export const extraChainSyncSources: ChainSyncSource[] = [
  {
    id: "chain-source-da25",
    address: "0xDA25e33402BD0E388e602B0fB958D2D818A1724D",
    label: "External chain source (DA25)",
  },
];
