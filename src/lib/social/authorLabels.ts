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

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const uniqueStrings = (values: string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

export const getServicesUserEthereumAddress = (user: ServicesUserRecord): string => {
  const idAddress = normalizeAuthorAddress(user.id);
  if (idAddress) return idAddress;

  const direct =
    typeof user.ethereum_address === "string"
      ? user.ethereum_address
      : typeof user.ethereumAddress === "string"
        ? user.ethereumAddress
        : "";
  const directAddress = normalizeAuthorAddress(direct);
  if (directAddress) return directAddress;

  const profileJson = asRecord(user.profile_json ?? user.profileJson);
  const profilePublic = asRecord(profileJson.public ?? profileJson.profile ?? profileJson);
  const profileAddress =
    typeof profilePublic.ethereum_address === "string"
      ? profilePublic.ethereum_address
      : typeof profilePublic.ethereumAddress === "string"
        ? profilePublic.ethereumAddress
        : typeof profilePublic.address === "string"
          ? profilePublic.address
          : "";

  return normalizeAuthorAddress(profileAddress);
};

export const getServicesUserChainSourceAddresses = (user: ServicesUserRecord): string[] => {
  const profileJson = asRecord(user.profile_json ?? user.profileJson);
  const profilePublic = asRecord(profileJson.public ?? profileJson.profile ?? profileJson);
  const sourceAliases = asRecord(
    profilePublic.source_aliases ?? profilePublic.sourceAliases ?? profilePublic.chain_sources,
  );

  return uniqueStrings(
    [
      getServicesUserEthereumAddress(user),
      ...asStringArray(profilePublic.chain_source_addresses).map(normalizeAuthorAddress),
      ...asStringArray(profilePublic.chainSourceAddresses).map(normalizeAuthorAddress),
      ...asStringArray(profilePublic.source_addresses).map(normalizeAuthorAddress),
      ...asStringArray(profilePublic.sourceAddresses).map(normalizeAuthorAddress),
      ...asStringArray(profilePublic.author_source_addresses).map(normalizeAuthorAddress),
      ...asStringArray(profilePublic.authorSourceAddresses).map(normalizeAuthorAddress),
      ...asStringArray(sourceAliases.chain_source_addresses).map(normalizeAuthorAddress),
      ...asStringArray(sourceAliases.chainSourceAddresses).map(normalizeAuthorAddress),
      ...asStringArray(sourceAliases.addresses).map(normalizeAuthorAddress),
    ].filter(Boolean),
  );
};

export const getServicesUserNickname = (user: ServicesUserRecord): string => {
  const profileJson = asRecord(user.profile_json ?? user.profileJson);
  const profilePublic = asRecord(profileJson.public ?? profileJson.profile ?? profileJson);
  const candidates = [
    user.display_name,
    user.displayName,
    user.nickname,
    profilePublic.nickname,
    profilePublic.name,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const name = candidate.trim();
    if (name && !normalizeAuthorAddress(name) && name.toLowerCase() !== "unknown") return name;
  }
  return "";
};

export const resolveServicesUserDisplayLabel = (
  user: ServicesUserRecord,
  fallbackAddress = "",
): string => {
  const displayName = getServicesUserNickname(user);
  if (displayName) return displayName;

  const email = typeof user.email === "string" ? user.email.trim() : "";
  if (email) return email;

  const id = typeof user.id === "string" ? user.id.trim() : "";
  if (id) return id;

  return shortAuthorAddress(fallbackAddress);
};

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
    const addresses = getServicesUserChainSourceAddresses(user);
    if (addresses.length === 0) return;
    const label = resolveServicesUserDisplayLabel(user, addresses[0]);
    if (!label) return;
    addresses.forEach((address) => {
      labelMap[address] = label;
    });
  });

  return labelMap;
};

export const buildAuthorAvatarMapFromServicesUsers = (
  users: ServicesUserRecord[],
): Record<string, string> => {
  const avatarMap: Record<string, string> = {};

  users.forEach((user) => {
    const addresses = getServicesUserChainSourceAddresses(user);
    if (addresses.length === 0) return;
    const avatarUrl = resolveServicesUserAvatarUrl(user);
    if (!avatarUrl) return;
    addresses.forEach((address) => {
      avatarMap[address] = avatarUrl;
    });
  });

  return avatarMap;
};
