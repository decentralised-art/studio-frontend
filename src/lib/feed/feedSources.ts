const ETH_ADDRESS_RE = /^0x[0-9a-f]{40}$/;

export const normalizeFeedSourceAddress = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  const withPrefix = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return ETH_ADDRESS_RE.test(withPrefix) ? withPrefix : "";
};

export const computeFeedSourceAddresses = (input: {
  currentUserAddress?: string;
  followedUserAddresses?: string[];
}): string[] => {
  const sourceSet = new Set<string>();

  const normalizedCurrent = normalizeFeedSourceAddress(input.currentUserAddress ?? "");
  if (normalizedCurrent) {
    sourceSet.add(normalizedCurrent);
  }

  (input.followedUserAddresses ?? []).forEach((entry) => {
    const normalized = normalizeFeedSourceAddress(entry);
    if (!normalized) return;
    sourceSet.add(normalized);
  });

  return Array.from(sourceSet);
};
