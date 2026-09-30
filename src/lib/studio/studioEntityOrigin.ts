const normalizeOwner = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const address = value.trim().toLowerCase().replace(/^0x/, "");
  return /^[0-9a-f]{40}$/.test(address) && !/^0+$/.test(address) ? `0x${address}` : "";
};

export const isPublishedChainAddress = (value: unknown): value is string =>
  typeof value === "string" &&
  /^0x[0-9a-f]{40}$/i.test(value.trim()) &&
  !/^0x0+$/i.test(value.trim());

export const isLocalEntityAddress = (value: unknown): value is string =>
  typeof value === "string" && /^(?:0x0|0x0{40})$/i.test(value.trim());

export const isOwnedLocalEntity = (
  entity: { address?: unknown; owner?: unknown },
  currentOwner: string,
): boolean => {
  const owner = normalizeOwner(currentOwner);
  return (
    Boolean(owner) && isLocalEntityAddress(entity.address) && normalizeOwner(entity.owner) === owner
  );
};
