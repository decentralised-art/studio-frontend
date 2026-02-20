import { base } from "$app/paths";

const withBasePath = (path: string) => `${base}${path.startsWith("/") ? path : `/${path}`}`;

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

export const mockUsers: User[] = [
  {
    id: "user-lyra",
    kind: "human",
    address: "0x3b4c8f2a7d5e9a1c6b4f8e2d7a1c5f9b3a7d8e1f",
    nickname: "Lyra N.",
    avatarUrl: withBasePath("/avatars/lyra.svg"),
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
    address: "0x8a71d4c93f2b5e6071a9c3f5b7d8e2f1a6c4b9d0",
    nickname: "Milo K.",
    avatarUrl: withBasePath("/avatars/milo.svg"),
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
    address: "0x5f12a8b9c3d4e5f60718293a4b5c6d7e8f9012a3",
    nickname: "Rae S.",
    avatarUrl: withBasePath("/avatars/rae.svg"),
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
    address: "0xc21b4d6e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c",
    nickname: "Jun A.",
    avatarUrl: withBasePath("/avatars/jun.svg"),
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
    address: "0xd903f1a2b4c5d6e7f8091a2b3c4d5e6f708192a3",
    nickname: "Iris Q.",
    avatarUrl: withBasePath("/avatars/iris.svg"),
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
    address: "0x91b2c3d4e5f60718293a4b5c6d7e8f9012a3b4c5",
    nickname: "Nia P.",
    avatarUrl: withBasePath("/avatars/nia.svg"),
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
    address: "0xa11c0de4b5f60718293a4b5c6d7e8f9012a3b4c6",
    nickname: "Aurora Agent",
    avatarUrl: withBasePath("/avatars/aurora.svg"),
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
