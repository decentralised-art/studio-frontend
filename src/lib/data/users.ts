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

// Seed snapshot of mock chain sources. This intentionally stays immutable even if
// runtime auth updates mockUsers[*].address in memory.
export const mockUserSeedChainSyncSources: ChainSyncSource[] = mockUsers.map((user) => ({
  id: user.id,
  address: user.address,
  label: user.nickname,
}));

export const extraChainSourceProfiles: User[] = [
  {
    id: "chain-source-da25",
    kind: "agent",
    address: "0xDA25e33402BD0E388e602B0fB958D2D818A1724D",
    nickname: "OpenClawd Agent Bob",
    avatarUrl: asset("/avatars/aurora.svg"),
    bio: "External chain source mirrored into the network feed.",
    authored: {
      performativeTransactions: 0,
      features: 0,
      transformations: 0,
      conditions: 0,
    },
    toolbox: [],
  },
  {
    id: "chain-source-fa71",
    kind: "agent",
    address: "0xfa71ff2394596f824d69961293d095a50d322e4e",
    nickname: "Chain Source fa71",
    avatarUrl: asset("/avatars/aurora.svg"),
    bio: "External chain source mirrored into the network feed.",
    authored: {
      performativeTransactions: 0,
      features: 0,
      transformations: 0,
      conditions: 0,
    },
    toolbox: [],
  },
  {
    id: "chain-source-b530",
    kind: "agent",
    address: "0xb530bf08d76015080c67d6b5f00cdee53b45bdda",
    nickname: "Chain Source b530",
    avatarUrl: asset("/avatars/aurora.svg"),
    bio: "External chain source mirrored into the network feed.",
    authored: {
      performativeTransactions: 0,
      features: 0,
      transformations: 0,
      conditions: 0,
    },
    toolbox: [],
  },
  {
    id: "chain-source-71a6",
    kind: "agent",
    address: "0x71a60533defdc8e989392068f0d97c9e71974839",
    nickname: "Chain Source 71a6",
    avatarUrl: asset("/avatars/aurora.svg"),
    bio: "External chain source mirrored into the network feed.",
    authored: {
      performativeTransactions: 0,
      features: 0,
      transformations: 2,
      conditions: 0,
    },
    toolbox: [],
  },
  {
    id: "chain-source-81da",
    kind: "agent",
    address: "0x81da631a0744b5b431ddade5636a5605d2d6c5cd",
    nickname: "Chain Source 81da",
    avatarUrl: asset("/avatars/aurora.svg"),
    bio: "External chain source mirrored into the network feed.",
    authored: {
      performativeTransactions: 0,
      features: 0,
      transformations: 0,
      conditions: 0,
    },
    toolbox: [],
  },
  {
    id: "chain-source-7e5f",
    kind: "agent",
    address: "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
    nickname: "Logic Corpus Source",
    avatarUrl: asset("/avatars/aurora.svg"),
    bio: "External chain source for reusable logic conditions and math transformations.",
    authored: {
      performativeTransactions: 0,
      features: 0,
      transformations: 11,
      conditions: 5,
    },
    toolbox: [],
  },
];

export const displayUsersById = Object.fromEntries(
  [...mockUsers, ...extraChainSourceProfiles].map((user) => [user.id, user] as const),
) as Record<string, User>;

export const mockCurrentUserId: User["id"] = "user-lyra";

export const mockFollowingByUserId: Partial<Record<User["id"], User["id"][]>> = {
  "user-lyra": [
    "user-milo",
    "user-rae",
    "user-jun",
    "user-iris",
    "user-nia",
    "agent-aurora",
    "chain-source-da25",
    "chain-source-fa71",
    "chain-source-b530",
    "chain-source-71a6",
    "chain-source-81da",
    "chain-source-7e5f",
  ],
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
    label: "OpenClawd Agent Bob",
  },
  {
    id: "chain-source-fa71",
    address: "0xfa71ff2394596f824d69961293d095a50d322e4e",
    label: "Chain Source fa71",
  },
  {
    id: "chain-source-b530",
    address: "0xb530bf08d76015080c67d6b5f00cdee53b45bdda",
    label: "Chain Source b530",
  },
  {
    id: "chain-source-71a6",
    address: "0x71a60533defdc8e989392068f0d97c9e71974839",
    label: "Chain Source 71a6",
  },
  {
    id: "chain-source-81da",
    address: "0x81da631a0744b5b431ddade5636a5605d2d6c5cd",
    label: "Chain Source 81da",
  },
  {
    id: "chain-source-7e5f",
    address: "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
    label: "Logic Corpus Source",
  },
];
