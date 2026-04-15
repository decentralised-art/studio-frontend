export type ConnectorRiMutabilityContext = {
  fromNetwork: boolean;
  tabReadOnly: boolean;
  hasNetworkSelfStatic: boolean;
};

export type ConnectorRiMutabilityState =
  | "draft-editable"
  | "network-view-only"
  | "network-self-static"
  | "network-editable";

export type ConnectorRiMutability = {
  state: ConnectorRiMutabilityState;
  lockToggleDisabled: boolean;
};

export type ResolveNextRiLockedInput = {
  mutability: ConnectorRiMutability;
  currentLocked: boolean;
  requestedLocked?: boolean;
};

/**
 * RI mutability policy:
 * - Draft connectors are always toggleable (open <-> static).
 * - On-chain connectors in view-only tabs cannot be toggled.
 * - On-chain connectors that already define self static_ri cannot be relaxed.
 * - Referenced on-chain connectors in editable tabs are toggleable only when self static_ri is absent.
 */
export const resolveConnectorRiMutability = (
  context: ConnectorRiMutabilityContext,
): ConnectorRiMutability => {
  if (!context.fromNetwork) {
    return { state: "draft-editable", lockToggleDisabled: false };
  }

  if (context.tabReadOnly) {
    return { state: "network-view-only", lockToggleDisabled: true };
  }

  if (context.hasNetworkSelfStatic) {
    return { state: "network-self-static", lockToggleDisabled: true };
  }

  return { state: "network-editable", lockToggleDisabled: false };
};

/**
 * Resolve next RI lock bit for connector controls.
 *
 * Rules:
 * - `network-self-static` is always locked.
 * - If lock toggle is disabled, keep current bit.
 * - Otherwise, apply requested bit when provided.
 */
export const resolveNextRiLocked = ({
  mutability,
  currentLocked,
  requestedLocked,
}: ResolveNextRiLockedInput): boolean => {
  if (mutability.state === "network-self-static") {
    return true;
  }

  if (mutability.lockToggleDisabled) {
    return currentLocked;
  }

  if (typeof requestedLocked === "boolean") {
    return requestedLocked;
  }

  return currentLocked;
};
