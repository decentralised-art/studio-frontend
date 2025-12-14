import type { SoliditySnippet } from "./types";

export type ArgsCountInference = {
  readonly minArgsCount: number; // maxIndex + 1, or 0 if none
  readonly maxIndex: number | null; // null if none
};

function stripStringsAndComments(src: string): string {
  // Replace with spaces to keep indices stable (not required, but safe).
  // Handles:
  // - // line comments
  // - /* block comments */
  // - "double-quoted" strings with escapes
  // - 'single-quoted' strings with escapes
  return (
    src
      // block comments
      .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
      // line comments
      .replace(/\/\/[^\n\r]*/g, (m) => " ".repeat(m.length))
      // double quoted strings
      .replace(/"(?:\\.|[^"\\])*"/g, (m) => " ".repeat(m.length))
      // single quoted strings
      .replace(/'(?:\\.|[^'\\])*'/g, (m) => " ".repeat(m.length))
  );
}

/**
 * Infers the minimum required args count from numeric index usage `args[<N>]`.
 * Example:
 *   "return x + args[5];" -> minArgsCount = 6
 */
export function inferArgsCountFromSnippet(code: SoliditySnippet): ArgsCountInference {
  const cleaned = stripStringsAndComments(String(code));

  // only literal numeric indices (args[0], args[12], ...)
  const re = /\bargs\s*\[\s*(\d+)\s*\]/g;

  let maxIndex: number | null = null;

  for (;;) {
    const match = re.exec(cleaned);
    if (match === null) break;

    const raw = match[1];
    if (raw === undefined) continue;

    // parseInt safe because regex enforces digits
    const idx = Number.parseInt(raw, 10);
    if (!Number.isFinite(idx)) continue;

    if (maxIndex === null || idx > maxIndex) maxIndex = idx;
  }

  return {
    maxIndex,
    minArgsCount: maxIndex === null ? 0 : maxIndex + 1,
  };
}
