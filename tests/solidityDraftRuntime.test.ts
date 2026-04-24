import { describe, expect, it } from "vitest";

import {
  alwaysTrueConditionCheck,
  compileConditionDraftCode,
  compileTransformationDraftCode,
  extractToolboxRuntimeSnippet,
  identityTransformRun,
} from "../src/lib/studio/solidityDraftRuntime";

describe("Solidity draft runtime helpers", () => {
  it("compiles transformation snippets into local preview functions", () => {
    const compiled = compileTransformationDraftCode("return x + args[0] * 2;");

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.value(4, [3])).toBe(10);
  });

  it("compiles condition snippets into boolean preview functions", () => {
    const compiled = compileConditionDraftCode("return args[0] > 2;");

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.value([3])).toBe(true);
    expect(compiled.value([1])).toBe(false);
  });

  it("reports empty or non-returning snippets consistently", () => {
    expect(compileTransformationDraftCode(" ")).toEqual({
      ok: false,
      error: "Transformation code is empty.",
    });
    expect(compileConditionDraftCode("const ok = true;")).toEqual({
      ok: false,
      error: "Mock compiler expects a return statement.",
    });
  });

  it("provides runtime fallbacks and toolbox snippets", () => {
    expect(identityTransformRun(7, [1])).toBe(7);
    expect(alwaysTrueConditionCheck([0])).toBe(true);
    expect(extractToolboxRuntimeSnippet("\n  contract Gate {}\n\nreturn true;")).toBe(
      "contract Gate {}",
    );
    expect(extractToolboxRuntimeSnippet("")).toBeUndefined();
  });
});
