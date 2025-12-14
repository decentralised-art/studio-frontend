/* editorBoundary.ts
 * Runtime validation for boundary inputs (URL, fetch, storage, user input).
 * Keep it small & deterministic.
 */

import type { ConditionId, FeatureId, SolidityDomain, TransformationId } from "./editorDomain";

export type ParseError =
  | { readonly kind: "Empty" }
  | { readonly kind: "TooLong"; readonly max: number }
  | { readonly kind: "InvalidCharacters"; readonly message: string };

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ParseError };

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function err<T>(error: ParseError): Result<T> {
  return { ok: false, error };
}

/**
 * Conservative identifier parser: allows [A-Za-z0-9._-] and length <= 128.
 * Adjust to your actual naming/ID scheme.
 */
export function parseIdentifier(raw: unknown, maxLen: number = 128): Result<string> {
  if (typeof raw !== "string")
    return err({ kind: "InvalidCharacters", message: "Expected string" });

  const s = raw.trim();
  if (s.length === 0) return err({ kind: "Empty" });
  if (s.length > maxLen) return err({ kind: "TooLong", max: maxLen });

  const re = /^[A-Za-z0-9._-]+$/;
  if (!re.test(s)) {
    return err({
      kind: "InvalidCharacters",
      message: "Allowed characters: A–Z a–z 0–9 . _ -",
    });
  }

  return ok(s);
}

export function parseFeatureId(raw: unknown): Result<FeatureId> {
  const r = parseIdentifier(raw);
  return r.ok ? ok({ kind: "FeatureId", value: r.value }) : r;
}

export function parseTransformationId(raw: unknown): Result<TransformationId> {
  const r = parseIdentifier(raw);
  return r.ok ? ok({ kind: "TransformationId", value: r.value }) : r;
}

export function parseConditionId(raw: unknown): Result<ConditionId> {
  const r = parseIdentifier(raw);
  return r.ok ? ok({ kind: "ConditionId", value: r.value }) : r;
}

export function parseSolidityDomain(raw: unknown): Result<SolidityDomain> {
  if (raw === "transformation" || raw === "condition") return ok(raw);
  return err({
    kind: "InvalidCharacters",
    message: "Domain must be 'transformation' or 'condition'.",
  });
}
