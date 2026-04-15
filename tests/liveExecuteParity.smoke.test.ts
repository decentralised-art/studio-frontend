import { describe, expect, it } from "vitest";

import { authenticateAllMockAccountsInChain } from "../src/lib/auth/api";
import { buildChainApiUrl } from "../src/lib/url/url";

type ExecutePayload = {
  connector_name: string;
  particles_count: string;
  dynamic_ri: Record<string, { start_point: number; transformation_shift: number }>;
};

type ExecuteResponseEntry = {
  path?: string;
  feature_path?: string;
  data?: number[];
};

const runLiveExecute = async (token: string, payload: ExecutePayload) => {
  const response = await fetch(buildChainApiUrl("/execute"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep raw text fallback
  }

  return { status: response.status, ok: response.ok, body };
};

const liveSmokeEnabled = process.env.DCN_LIVE_SMOKE === "1";

describe("live execute parity smoke (manual, opt-in)", () => {
  it.skipIf(!liveSmokeEnabled)(
    "authenticates a mock chain user and executes canonical payloads",
    async () => {
      const authResults = await authenticateAllMockAccountsInChain({
        patchServicesProfile: false,
      });
      const lyra = authResults.find((entry) => entry.userId === "user-lyra");

      expect(lyra?.success).toBe(true);
      expect(typeof lyra?.token).toBe("string");
      const token = lyra?.token as string;

      const payloads: ExecutePayload[] = [
        {
          connector_name: "t1",
          particles_count: "12",
          dynamic_ri: {},
        },
        {
          connector_name: "t0",
          particles_count: "5",
          dynamic_ri: {
            "0": { start_point: 10, transformation_shift: 11 },
            "3": { start_point: 1, transformation_shift: 0 },
          },
        },
      ];

      for (const payload of payloads) {
        const result = await runLiveExecute(token, payload);
        expect(result.ok).toBe(true);

        const body = result.body;
        expect(Array.isArray(body)).toBe(true);
        const rows = body as ExecuteResponseEntry[];
        expect(rows.length).toBeGreaterThan(0);

        rows.forEach((row) => {
          expect(typeof row).toBe("object");
          expect(Array.isArray(row.data)).toBe(true);
          expect(typeof row.path === "string" || typeof row.feature_path === "string").toBe(true);
        });
      }
    },
    60_000,
  );
});
