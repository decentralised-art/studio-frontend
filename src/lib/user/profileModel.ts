import { asset } from "$app/paths";
import type { User, UserKind } from "$lib/data/users";

export type ServicesUserPublic = {
  id: string;
  email: string;
  display_name: string | null;
  ethereum_address: string | null;
  status: "active" | "suspended" | "deleted" | string;
  roles: string[];
  profile_json: unknown;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

export type ProfileViewUser = User & {
  email: string;
  status: string;
  roles: string[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  profileJson: unknown;
};

const fallbackUser: ProfileViewUser = {
  id: "unknown-user",
  kind: "human",
  address: "",
  nickname: "Unknown",
  avatarUrl: "",
  bio: "",
  authored: {
    performativeTransactions: 0,
    features: 0,
    transformations: 0,
    conditions: 0,
  },
  toolbox: [],
  email: "",
  status: "active",
  roles: ["user"],
  createdAt: "",
  updatedAt: "",
  lastLoginAt: null,
  profileJson: {},
};

const coerceString = (value: unknown) => (typeof value === "string" ? value : "");
const coerceStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const pickFirst = (...values: string[]) => values.find((value) => value.trim().length > 0) ?? "";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const resolveProfileAvatarUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^(?:https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  const rootedStaticAvatar = trimmed.match(/^\/(?:[^/]+\/)?avatars\/(.+)$/);
  if (rootedStaticAvatar) return asset(`/avatars/${rootedStaticAvatar[1]}`);
  if (trimmed.startsWith("avatars/")) return asset(`/${trimmed}`);
  return trimmed;
};

const parseKind = (value: unknown): UserKind =>
  coerceString(value) === "agent" ? "agent" : "human";

const parseAuthored = (value: unknown): User["authored"] => {
  const record = asRecord(value);
  return {
    performativeTransactions:
      Number(record.performativeTransactions) || Number(record.performative_transactions) || 0,
    features: Number(record.features) || 0,
    transformations: Number(record.transformations) || 0,
    conditions: Number(record.conditions) || 0,
  };
};

export const normalizeProfileUser = (payload: unknown): ProfileViewUser => {
  const root = asRecord(payload);
  const nested = root.user && typeof root.user === "object" ? asRecord(root.user) : root;

  const profileJson = asRecord(nested.profile_json ?? nested.profileJson);
  const profilePublic = asRecord(profileJson.public ?? profileJson.profile ?? profileJson);
  const toolboxLibrary = asRecord(profilePublic.toolbox_library ?? profilePublic.toolboxLibrary);

  const nickname = pickFirst(
    coerceString(nested.display_name),
    coerceString(nested.displayName),
    coerceString(nested.nickname),
    coerceString(profilePublic.nickname),
    coerceString(profilePublic.name),
    fallbackUser.nickname,
  );

  const avatarUrl = pickFirst(
    resolveProfileAvatarUrl(coerceString(profilePublic.avatar_url)),
    resolveProfileAvatarUrl(coerceString(profilePublic.avatarUrl)),
    resolveProfileAvatarUrl(coerceString(profilePublic.avatar)),
    resolveProfileAvatarUrl(coerceString(nested.avatar_url)),
    resolveProfileAvatarUrl(coerceString(nested.avatarUrl)),
  );

  const bio = pickFirst(
    coerceString(profilePublic.bio),
    coerceString(profilePublic.description),
    coerceString(profilePublic.about),
    coerceString(nested.bio),
  );

  const kind = parseKind(profilePublic.kind ?? nested.kind ?? nested.type);
  const authored = parseAuthored(profilePublic.authored ?? nested.authored);
  const toolbox = Array.isArray(profilePublic.toolbox)
    ? profilePublic.toolbox.filter((item): item is string => typeof item === "string")
    : Array.isArray(toolboxLibrary.connector)
      ? toolboxLibrary.connector.filter((item): item is string => typeof item === "string")
      : Array.isArray(toolboxLibrary.feature)
        ? toolboxLibrary.feature.filter((item): item is string => typeof item === "string")
        : Array.isArray(nested.toolbox)
          ? nested.toolbox.filter((item): item is string => typeof item === "string")
          : [];

  return {
    ...fallbackUser,
    id: pickFirst(coerceString(nested.id), fallbackUser.id),
    kind,
    nickname,
    avatarUrl,
    bio,
    address: pickFirst(
      coerceString(nested.ethereum_address),
      coerceString(nested.eth_address),
      coerceString(nested.address),
      coerceString(profilePublic.ethereum_address),
      coerceString(profilePublic.address),
    ),
    authored,
    toolbox,
    email: coerceString(nested.email),
    status: pickFirst(coerceString(nested.status), fallbackUser.status),
    roles: coerceStringArray(nested.roles),
    createdAt: coerceString(nested.created_at),
    updatedAt: coerceString(nested.updated_at),
    lastLoginAt: typeof nested.last_login_at === "string" ? nested.last_login_at : null,
    profileJson: nested.profile_json ?? profileJson,
  };
};
