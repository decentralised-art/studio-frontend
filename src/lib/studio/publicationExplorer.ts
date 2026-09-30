import type { PublicationRecord } from "./studioPublication";

const explorerBase = (chainId: string | undefined): string | null => {
  if (!chainId || !/^0x[0-9a-f]+$/i.test(chainId)) return null;
  switch (BigInt(chainId)) {
    case 1n:
      return "https://etherscan.io";
    case 11155111n:
      return "https://sepolia.etherscan.io";
    default:
      return null;
  }
};

export const publicationTransactionUrl = (
  record: Pick<PublicationRecord, "chainId" | "tx_hash">,
): string | null => {
  const base = explorerBase(record.chainId);
  return base && /^0x[0-9a-f]{64}$/i.test(record.tx_hash ?? "")
    ? `${base}/tx/${record.tx_hash}`
    : null;
};

export const publicationAddressUrl = (
  record: Pick<PublicationRecord, "chainId" | "address">,
): string | null => {
  const base = explorerBase(record.chainId);
  return base &&
    /^0x[0-9a-f]{40}$/i.test(record.address ?? "") &&
    !/^0x0+$/i.test(record.address ?? "")
    ? `${base}/address/${record.address}`
    : null;
};
