import { describe, expect, it } from "vitest";

import { resolveConnectorRiMutability, resolveNextRiLocked } from "../src/lib/studio/riMutability";

describe("riMutability", () => {
  it("keeps draft connectors toggleable", () => {
    const result = resolveConnectorRiMutability({
      fromNetwork: false,
      tabReadOnly: false,
      hasNetworkSelfStatic: false,
    });

    expect(result.state).toBe("draft-editable");
    expect(result.lockToggleDisabled).toBe(false);
  });

  it("disables lock toggle for on-chain connectors in view-only tabs", () => {
    const result = resolveConnectorRiMutability({
      fromNetwork: true,
      tabReadOnly: true,
      hasNetworkSelfStatic: false,
    });

    expect(result.state).toBe("network-view-only");
    expect(result.lockToggleDisabled).toBe(true);
  });

  it("keeps referenced on-chain dynamic connectors toggleable in editable tabs", () => {
    const result = resolveConnectorRiMutability({
      fromNetwork: true,
      tabReadOnly: false,
      hasNetworkSelfStatic: false,
    });

    expect(result.state).toBe("network-editable");
    expect(result.lockToggleDisabled).toBe(false);
  });

  it("keeps on-chain self-static connectors non-toggleable in editable tabs", () => {
    const result = resolveConnectorRiMutability({
      fromNetwork: true,
      tabReadOnly: false,
      hasNetworkSelfStatic: true,
    });

    expect(result.state).toBe("network-self-static");
    expect(result.lockToggleDisabled).toBe(true);
  });

  it("forces locked state for on-chain self-static connectors", () => {
    const mutability = resolveConnectorRiMutability({
      fromNetwork: true,
      tabReadOnly: false,
      hasNetworkSelfStatic: true,
    });

    const nextLocked = resolveNextRiLocked({
      mutability,
      currentLocked: false,
      requestedLocked: false,
    });

    expect(nextLocked).toBe(true);
  });

  it("keeps current lock bit when toggle is disabled", () => {
    const mutability = resolveConnectorRiMutability({
      fromNetwork: true,
      tabReadOnly: true,
      hasNetworkSelfStatic: false,
    });

    const nextLocked = resolveNextRiLocked({
      mutability,
      currentLocked: false,
      requestedLocked: true,
    });

    expect(nextLocked).toBe(false);
  });

  it("applies requested lock bit for editable network references", () => {
    const mutability = resolveConnectorRiMutability({
      fromNetwork: true,
      tabReadOnly: false,
      hasNetworkSelfStatic: false,
    });

    const nextLocked = resolveNextRiLocked({
      mutability,
      currentLocked: false,
      requestedLocked: true,
    });

    expect(nextLocked).toBe(true);
  });
});
