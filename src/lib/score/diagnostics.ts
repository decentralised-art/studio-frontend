import type { ScoreDiagnostic, ScoreDiagnosticLevel } from "./types";

export const scoreDiagnostic = (
  level: ScoreDiagnosticLevel,
  code: string,
  message: string,
  path?: string,
): ScoreDiagnostic => ({
  level,
  code,
  message,
  ...(path ? { path } : {}),
});

export const hasScoreErrors = (diagnostics: readonly ScoreDiagnostic[]): boolean =>
  diagnostics.some((diagnostic) => diagnostic.level === "error");
