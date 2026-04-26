import type { ServicesUserRecord } from "$lib/auth/api";
import { resolveProfileAvatarUrl } from "$lib/user/profileModel";

const ETH_ADDRESS_RE = /^0x[0-9a-f]{40}$/;

export const normalizeAuthorAddress = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  const withPrefix = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return ETH_ADDRESS_RE.test(withPrefix) ? withPrefix : "";
};

export const shortAuthorAddress = (address: string): string => {
  const normalized = normalizeAuthorAddress(address);
  if (!normalized) return "";
  if (normalized.length < 14) return normalized;
  return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
};

export const getServicesUserEthereumAddress = (user: ServicesUserRecord): string => {
  const direct =
    typeof user.ethereum_address === "string"
      ? user.ethereum_address
      : typeof user.ethereumAddress === "string"
        ? user.ethereumAddress
        : "";
  return normalizeAuthorAddress(direct);
};

export const resolveServicesUserDisplayLabel = (
  user: ServicesUserRecord,
  fallbackAddress = "",
): string => {
  const displayName =
    typeof user.display_name === "string"
      ? user.display_name.trim()
      : typeof user.displayName === "string"
        ? user.displayName.trim()
        : "";
  if (displayName) return displayName;

  const email = typeof user.email === "string" ? user.email.trim() : "";
  if (email) return email;

  const id = typeof user.id === "string" ? user.id.trim() : "";
  if (id) return id;

  return shortAuthorAddress(fallbackAddress);
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const resolveServicesUserAvatarUrl = (user: ServicesUserRecord): string => {
  const profileJson = asRecord(user.profile_json ?? user.profileJson);
  const profilePublic = asRecord(profileJson.public ?? profileJson.profile ?? profileJson);

  const candidates = [
    profilePublic.avatar_url,
    profilePublic.avatarUrl,
    profilePublic.avatar,
    user.avatar_url,
    user.avatarUrl,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const resolved = resolveProfileAvatarUrl(candidate);
    if (resolved) return resolved;
  }

  return "";
};

export const buildAuthorLabelMapFromServicesUsers = (
  users: ServicesUserRecord[],
): Record<string, string> => {
  const labelMap: Record<string, string> = {};

  users.forEach((user) => {
    const address = getServicesUserEthereumAddress(user);
    if (!address) return;
    const label = resolveServicesUserDisplayLabel(user, address);
    if (!label) return;
    labelMap[address] = label;
  });

  return labelMap;
};

export const buildAuthorAvatarMapFromServicesUsers = (
  users: ServicesUserRecord[],
): Record<string, string> => {
  const avatarMap: Record<string, string> = {};

  users.forEach((user) => {
    const address = getServicesUserEthereumAddress(user);
    if (!address) return;
    const avatarUrl = resolveServicesUserAvatarUrl(user);
    if (!avatarUrl) return;
    avatarMap[address] = avatarUrl;
  });

  return avatarMap;
};
