export const DEFAULT_TRANSFORMATION_DRAFT_CODE = "return x + args[0];";
export const DEFAULT_CONDITION_DRAFT_CODE = "return true;";

export type TransformationDraftRuntime = (x: number, args: number[]) => number;
export type ConditionDraftRuntime = (args: number[]) => boolean;

export type CompileDraftRuntimeResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: string;
    };

export const identityTransformRun: TransformationDraftRuntime = (x: number, _args: number[]) => x;

export const alwaysTrueConditionCheck: ConditionDraftRuntime = (_args: number[]) => true;

export const compileTransformationDraftCode = (
  code: string,
): CompileDraftRuntimeResult<TransformationDraftRuntime> => {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, error: "Transformation code is empty." };
  if (!/\breturn\b/.test(trimmed)) {
    return {
      ok: false,
      error: "Mock compiler expects a return statement.",
    };
  }
  try {
    const fn = new Function("x", "args", `"use strict"; ${trimmed}`) as TransformationDraftRuntime;
    return { ok: true, value: fn };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid transformation code.";
    return { ok: false, error: message };
  }
};

export const compileConditionDraftCode = (
  code: string,
): CompileDraftRuntimeResult<ConditionDraftRuntime> => {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, error: "Condition code is empty." };
  if (!/\breturn\b/.test(trimmed)) {
    return {
      ok: false,
      error: "Mock compiler expects a return statement.",
    };
  }
  try {
    const fn = new Function("args", `"use strict"; ${trimmed}`) as (args: number[]) => unknown;
    return {
      ok: true,
      value: (args: number[]) => Boolean(fn(args)),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid condition code.";
    return { ok: false, error: message };
  }
};

export const extractToolboxRuntimeSnippet = (solSrc?: string): string | undefined => {
  const firstLine = solSrc
    ?.split(/\r?\n/g)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine;
};
