import { buildServicesApiUrl } from "$lib/url/url";

export type LintIssue = {
  message: string;
  severity: "error" | "warning" | "info";
  line: number; // 1-based
  column: number; // 1-based
  endLine?: number; // 1-based
  endColumn?: number;
  code?: string; // rule name
};

type Req = {
  id: number;
  code: string;
  mode: "server" | "light";
  endpoint?: string;
};
type Res = { id: number; issues: LintIssue[] };

function lightLint(code: string): LintIssue[] {
  // Minimal, fast heuristics (NOT a replacement for solhint):
  const issues: LintIssue[] = [];
  const lines = code.split("\n");

  // Example: warn on tab indents + missing pragma
  const hasPragma = /^\s*pragma\s+solidity\b/m.test(code);
  if (!hasPragma) {
    issues.push({
      message: "Missing `pragma solidity ...;`",
      severity: "warning",
      line: 1,
      column: 1,
      code: "light/missing-pragma",
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const tab = ln.indexOf("\t");
    if (tab !== -1) {
      issues.push({
        message: "Tab indentation found (prefer spaces).",
        severity: "info",
        line: i + 1,
        column: tab + 1,
        endLine: i + 1,
        endColumn: tab + 2,
        code: "light/no-tabs",
      });
    }
  }

  return issues;
}

async function serverLint(code: string, endpoint: string): Promise<LintIssue[]> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    return [
      {
        message: `Lint endpoint error: ${res.status} ${res.statusText}`,
        severity: "warning",
        line: 1,
        column: 1,
        code: "server/lint-endpoint",
      },
    ];
  }
  return (await res.json()) as LintIssue[];
}

type LintError = {
  message?: string;
};

let lastTimer: NodeJS.Timeout | null = null;
let lastReq: Req | null = null;

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

self.onmessage = (ev: MessageEvent<Req>) => {
  lastReq = ev.data;

  if (lastTimer) clearTimeout(lastTimer);
  lastTimer = setTimeout(async () => {
    if (!lastReq) return;

    const { id, code, mode, endpoint } = lastReq;

    let issues: LintIssue[] = [];
    try {
      if (mode === "server") {
        issues = await serverLint(code, endpoint ?? buildServicesApiUrl("/solidity/lint"));
      } else {
        issues = lightLint(code);
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String((e as LintError).message)
            : "Unknown lint error";

      issues = [
        {
          message,
          severity: "warning",
          line: 1,
          column: 1,
          code: "worker/exception",
        },
      ];
    }

    const msg: Res = { id, issues };
    ctx.postMessage(msg);
  }, 250);
};
