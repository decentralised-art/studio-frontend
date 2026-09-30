import { describe, expect, it } from "vitest";

import {
  normalizeChainExecuteResponse,
  type RawChainExecuteResponse,
} from "../src/lib/chain/registryApi";
import { buildChainApiUrl } from "../src/lib/url/url";

type ExecutePayload = {
  connector_name: string;
  particles_count: string;
  dynamic_ri: Record<string, { start_point: number; transformation_shift: number }>;
};

type ExecuteResponseEntry = {
  path?: string;
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
const liveChainToken = process.env.DCN_LIVE_CHAIN_TOKEN ?? "";

describe("live execute parity smoke (manual, opt-in)", () => {
  it.skipIf(!liveSmokeEnabled)(
    "executes canonical payloads with an externally supplied chain token",
    async () => {
      if (!liveChainToken) {
        throw new Error("Set DCN_LIVE_CHAIN_TOKEN when running DCN_LIVE_SMOKE=1.");
      }

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
        const result = await runLiveExecute(liveChainToken, payload);
        expect(result.ok).toBe(true);

        const body = normalizeChainExecuteResponse(result.body as RawChainExecuteResponse);
        const rows = body.particles as ExecuteResponseEntry[];
        expect(rows.length).toBeGreaterThan(0);

        rows.forEach((row) => {
          expect(typeof row).toBe("object");
          expect(Array.isArray(row.data)).toBe(true);
          expect(typeof row.path).toBe("string");
        });
      }
    },
    60_000,
  );
});
