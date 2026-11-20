import type { EntityKind, PreparedPublication } from "decentralised-art";

import { publicationTransactionUrl } from "./publicationExplorer";
import type { PublicationProgress, PublicationRecord } from "./studioPublication";
import type {
  PublicationEntity,
  PublicationPlanEntry,
  StudioPublicationPlan,
} from "./studioPublicationPlan";

export type PublicationQuote = {
  gasLimit: bigint;
  feeWei: bigint | null;
  chainId: bigint;
  contentHash: string;
};

export type PublicationReview = {
  root: PublicationEntity;
  owner: string;
  stage: "planning" | "review" | "running" | "paused" | "complete";
  plan?: StudioPublicationPlan;
  quotes: Record<string, PublicationQuote>;
  quoteProblems: Record<string, string>;
  progress?: PublicationProgress;
  unresolved?: PublicationRecord;
  activity?: string;
  problem?: string;
  stopRequested: boolean;
};

export type PublicationPricing = { chainId: bigint; gasPrice: bigint };

export function readPublicationQuantity(value: unknown): bigint | null {
  return typeof value === "string" && /^0x[0-9a-f]{1,64}$/i.test(value) ? BigInt(value) : null;
}

export function quotePublication(
  prepared: PreparedPublication,
  pricing: PublicationPricing | null,
): PublicationQuote | null {
  const gasLimit = readPublicationQuantity(prepared.transaction.gas);
  const chainId = readPublicationQuantity(prepared.transaction.chainId);
  if (!gasLimit || !chainId || !/^0x[0-9a-f]{64}$/i.test(prepared.content_hash)) return null;
  return {
    gasLimit,
    chainId,
    contentHash: prepared.content_hash,
    feeWei: pricing?.chainId === chainId ? gasLimit * pricing.gasPrice : null,
  };
}

const formatWei = (wei: bigint, chainId: bigint) => {
  const scale = 10n ** 18n;
  const fraction = (wei % scale).toString().padStart(18, "0").slice(0, 8).replace(/0+$/, "");
  const amount =
    wei > 0n && wei < 10n ** 10n
      ? "<0.00000001"
      : (wei / scale).toString() + (fraction ? "." + fraction : "");
  const currency =
    chainId === 11155111n ? "Sepolia ETH" : chainId === 1n ? "ETH" : `units on chain ${chainId}`;
  return `${amount} ${currency}`;
};

export const isPublicationComplete = (entry: PublicationPlanEntry): boolean =>
  entry.state === "published" || entry.state === "mined";

export function readyPublicationEntries(entries: PublicationPlanEntry[]): PublicationPlanEntry[] {
  const complete = new Set(entries.filter(isPublicationComplete).map(({ key }) => key));
  return entries.filter(
    ({ state, dependencies }) =>
      state === "draft" && dependencies.every((dependency) => complete.has(dependency)),
  );
}

type ReviewRow = {
  key: string;
  name: string;
  kind: EntityKind;
  status: string;
  detail?: string;
  fee?: string;
  explorerUrl?: string;
};

export function describePublicationReview(review: PublicationReview) {
  const entries = review.plan?.entries ?? [];
  const remaining = entries.filter((entry) => !isPublicationComplete(entry));
  const mined = entries.filter(({ state }) => state === "mined").length;
  const reused = entries.filter(({ state }) => state === "published").length;
  const ready = new Set(readyPublicationEntries(entries).map(({ key }) => key));
  const quotes = remaining.flatMap(({ key }) => {
    const quote = review.quotes[key];
    return quote?.feeWei != null ? [quote] : [];
  });
  const summary = review.plan
    ? `${reused} already public · ${mined} confirmed · ${remaining.length} left`
    : undefined;
  let feeSummary: string | undefined;
  if (remaining.length) {
    const chainId = quotes[0]?.chainId;
    if (chainId && quotes.every((quote) => quote.chainId === chainId)) {
      const total = quotes.reduce((sum, quote) => sum + (quote.feeWei ?? 0n), 0n);
      const unknown = remaining.length - quotes.length;
      feeSummary = unknown
        ? `Estimated gas cost for ${quotes.length} of ${remaining.length} remaining · ${formatWei(total, chainId)} · ${unknown} unpriced`
        : `Estimated gas cost for all ${remaining.length} remaining · ${formatWei(total, chainId)}`;
    } else {
      feeSummary = `${remaining.length} remaining without a fee estimate`;
    }
  }

  const rows: ReviewRow[] = entries.map((entry) => {
    const quote = review.quotes[entry.key];
    const row: ReviewRow = { key: entry.key, name: entry.name, kind: entry.kind, status: "" };
    if (quote && entry.state === "draft") {
      row.fee =
        quote.feeWei === null
          ? `${quote.gasLimit.toLocaleString()} gas limit`
          : `Est. ${formatWei(quote.feeWei, quote.chainId)}`;
    }
    if (entry.txHash) {
      row.explorerUrl =
        publicationTransactionUrl({ chainId: entry.chainId, tx_hash: entry.txHash }) ?? undefined;
    }
    if (entry.state === "published") row.status = "Already public";
    else if (entry.state === "mined") row.status = "Confirmed on-chain";
    else if (entry.state === "pending") row.status = "Saved transaction";
    else if (entry.state === "sending") row.status = "Wallet submission to recover";
    else if (!ready.has(entry.key)) row.status = "Waiting for dependencies";
    else if (review.quoteProblems[entry.key]) {
      row.status = "Estimate unavailable";
      row.detail = review.quoteProblems[entry.key];
    } else row.status = quote ? "Ready to publish" : "Ready for estimate";
    return row;
  });
  const actionLabel =
    review.stage === "review" && review.unresolved
      ? "Check saved transaction"
      : review.stage === "review" && remaining.length
        ? `Publish ${remaining.length} ${remaining.length === 1 ? "item" : "items"}`
        : review.stage === "paused"
          ? "Refresh review"
          : undefined;
  return { rows, summary, feeSummary, actionLabel };
}
