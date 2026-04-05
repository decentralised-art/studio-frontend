import { describe, expect, it } from "vitest";
import {
  resolveChainAccountCursor,
  resolveChainFormatCursor,
  type ChainAccountResponse,
  type ChainFormatResponse,
} from "../src/lib/chain/registryApi";

describe("registryApi cursor compatibility", () => {
  it("resolves account cursors from current nested cursor objects", () => {
    const payload: ChainAccountResponse = {
      cursor_connectors: { has_more: true, next_after: "C2" },
      cursor_transformations: { has_more: false, next_after: null },
      cursor_conditions: { has_more: true, next_after: "cond_alpha" },
    };

    expect(resolveChainAccountCursor(payload, "connectors")).toEqual({
      hasMore: true,
      nextAfter: "C2",
    });
    expect(resolveChainAccountCursor(payload, "transformations")).toEqual({
      hasMore: false,
      nextAfter: null,
    });
    expect(resolveChainAccountCursor(payload, "conditions")).toEqual({
      hasMore: true,
      nextAfter: "cond_alpha",
    });
  });

  it("falls back to legacy account cursor fields", () => {
    const payload: ChainAccountResponse = {
      connectors_has_more: true,
      next_after_connectors: "C9",
      transformations_has_more: true,
      next_after_transformations: "add",
      conditions_has_more: false,
      next_after_conditions: null,
    };

    expect(resolveChainAccountCursor(payload, "connectors")).toEqual({
      hasMore: true,
      nextAfter: "C9",
    });
    expect(resolveChainAccountCursor(payload, "transformations")).toEqual({
      hasMore: true,
      nextAfter: "add",
    });
    expect(resolveChainAccountCursor(payload, "conditions")).toEqual({
      hasMore: false,
      nextAfter: null,
    });
  });

  it("prefers current account cursor object over legacy fields", () => {
    const payload: ChainAccountResponse = {
      cursor_connectors: { has_more: false, next_after: null },
      connectors_has_more: true,
      next_after_connectors: "LEGACY_C1",
    };

    expect(resolveChainAccountCursor(payload, "connectors")).toEqual({
      hasMore: false,
      nextAfter: null,
    });
  });

  it("resolves format cursor from current nested cursor object", () => {
    const payload: ChainFormatResponse = {
      cursor: { has_more: true, next_after: "C2" },
    };
    expect(resolveChainFormatCursor(payload)).toEqual({
      hasMore: true,
      nextAfter: "C2",
    });
  });

  it("falls back to legacy format cursor fields", () => {
    const payload: ChainFormatResponse = {
      has_more: true,
      next_after: "C4",
    };
    expect(resolveChainFormatCursor(payload)).toEqual({
      hasMore: true,
      nextAfter: "C4",
    });
  });
});
