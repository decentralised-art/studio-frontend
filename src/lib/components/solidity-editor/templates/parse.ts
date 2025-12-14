import type { ContractName, RenderResult, SoliditySnippet } from "./types.ts";

const CONTRACT_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Solidity contract identifiers must match identifier rules.
 * We intentionally keep this strict (no unicode).
 */
export function parseContractName(raw: string): RenderResult<ContractName> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, error: "Contract name is empty." };
  if (!CONTRACT_NAME_RE.test(trimmed)) {
    return {
      ok: false,
      error: "Invalid contract name (use A-Z, a-z, 0-9, _; cannot start with a digit).",
    };
  }
  return { ok: true, value: trimmed as ContractName };
}

/**
 * For {CODE} we accept any snippet, but we normalize line endings.
 * You can tighten this later (e.g., forbid 'pragma', 'import', 'contract', etc.).
 */
export function parseSoliditySnippet(raw: string): RenderResult<SoliditySnippet> {
  const normalized = raw.replace(/\r\n/g, "\n");
  return { ok: true, value: normalized as SoliditySnippet };
}
