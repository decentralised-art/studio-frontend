import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("$lib/url/url", () => ({
  buildChainApiUrl: (path: string) => `https://api.example.invalid${path}`,
}));

import {
  fetchWorldFormatConnectorEvents,
  isFormatCompatibleWithScalarContract,
} from "../src/lib/worlds/formatDiscovery";

const formatHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("world format connector discovery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches connector candidates from accepted format hashes", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === `/format/${formatHash}`) {
        return Response.json({
          format_hash: formatHash,
          connectors: ["melody_root"],
          cursor: { has_more: false, next_after: null },
        });
      }
      if (url.pathname === "/connector/melody_root") {
        return Response.json({
          name: "melody_root",
          owner: "0xb530bf08d76015080c67d6b5f00cdee53b45bdda",
          format_hash: formatHash,
          dimensions: [
            {
              transformations: [{ name: "add", args: [1] }],
              composite: "melody_notes",
              bindings: {},
            },
          ],
        });
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchWorldFormatConnectorEvents({ acceptedFormatHashes: [formatHash] });

    expect(result.errors).toEqual([]);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      type: "connector",
      particleId: "melody_root",
      particleLabel: "melody_root",
      formatHash,
      authorId: "0xb530bf08d76015080c67d6b5f00cdee53b45bdda",
      usedParticleIds: ["melody_notes"],
    });
  });

  it("discovers compatible format hashes from accepted terminal scalar names", async () => {
    const compatibleHash = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const incompatibleHash = "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/formats") {
        return Response.json({
          formats: [compatibleHash, incompatibleHash],
          cursor: { has_more: false, next_after: null },
        });
      }
      if (url.pathname === `/format/${compatibleHash}`) {
        return Response.json({
          format_hash: compatibleHash,
          scalars: ["duration_tick:0", "onset_tick:0", "pitch_midi:0"],
          connectors: ["semantic_score"],
          cursor: { has_more: false, next_after: null },
        });
      }
      if (url.pathname === `/format/${incompatibleHash}`) {
        return Response.json({
          format_hash: incompatibleHash,
          scalars: ["duration_tick:0", "onset_tick:0", "pitch_midi:0", "unknown_field:0"],
          connectors: ["bad_score"],
          cursor: { has_more: false, next_after: null },
        });
      }
      if (url.pathname === "/connector/semantic_score") {
        return Response.json({
          name: "semantic_score",
          owner: "b530bf08d76015080c67d6b5f00cdee53b45bdda",
          format_hash: compatibleHash,
          dimensions: [{ transformations: [{ name: "add", args: [1] }], bindings: {} }],
        });
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchWorldFormatConnectorEvents({
      acceptedScalars: ["onset_tick", "duration_tick", "pitch_midi", "velocity_midi"],
      requiredScalars: ["onset_tick", "duration_tick", "pitch_midi"],
    });

    expect(result.errors).toEqual([]);
    expect(result.formatHashes).toEqual([compatibleHash]);
    expect(result.events.map((event) => event.particleId)).toEqual(["semantic_score"]);
    expect(result.events[0]?.authorId).toBe("0xb530bf08d76015080c67d6b5f00cdee53b45bdda");
  });

  it("reports more compatible connector candidates when the requested page is full", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === `/format/${formatHash}`) {
        return Response.json({
          format_hash: formatHash,
          connectors: ["alpha_root", "beta_root"],
          cursor: { has_more: false, next_after: null },
        });
      }
      if (url.pathname === "/connector/alpha_root" || url.pathname === "/connector/beta_root") {
        const name = url.pathname.split("/").at(-1) ?? "";
        return Response.json({
          name,
          owner: "0xb530bf08d76015080c67d6b5f00cdee53b45bdda",
          format_hash: formatHash,
          dimensions: [{ transformations: [{ name: "add", args: [1] }], bindings: {} }],
        });
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchWorldFormatConnectorEvents({
      acceptedFormatHashes: [formatHash],
      connectorLimit: 1,
    });

    expect(result.hasMore).toBe(true);
    expect(result.events.map((event) => event.particleId)).toEqual(["alpha_root"]);
  });

  it("reports more connector candidates when a format cursor has more pages", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === `/format/${formatHash}`) {
        return Response.json({
          format_hash: formatHash,
          connectors: ["alpha_root", "beta_root"],
          cursor: { has_more: true, next_after: "beta_root" },
        });
      }
      if (url.pathname === "/connector/alpha_root" || url.pathname === "/connector/beta_root") {
        const name = url.pathname.split("/").at(-1) ?? "";
        return Response.json({
          name,
          owner: "0xb530bf08d76015080c67d6b5f00cdee53b45bdda",
          format_hash: formatHash,
          dimensions: [{ transformations: [{ name: "add", args: [1] }], bindings: {} }],
        });
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchWorldFormatConnectorEvents({
      acceptedFormatHashes: [formatHash],
      connectorLimit: 2,
    });

    expect(result.hasMore).toBe(true);
    expect(result.events.map((event) => event.particleId)).toEqual(["alpha_root", "beta_root"]);
  });

  it("accepts only formats whose scalar names are required or accepted", () => {
    const options = {
      acceptedScalars: ["onset_tick", "duration_tick", "pitch_midi", "velocity_midi"],
      requiredScalars: ["onset_tick", "duration_tick", "pitch_midi"],
    };

    expect(
      isFormatCompatibleWithScalarContract(
        { scalars: ["duration_tick:0", "onset_tick:0", "pitch_midi:0"] },
        options,
      ),
    ).toBe(true);
    expect(
      isFormatCompatibleWithScalarContract(
        {
          scalars: ["duration_tick:0", "onset_tick:0", "pitch_midi:0", "velocity_midi:0"],
        },
        options,
      ),
    ).toBe(true);
    expect(
      isFormatCompatibleWithScalarContract(
        { scalars: ["duration_tick:0", "onset_tick:0"] },
        options,
      ),
    ).toBe(false);
    expect(
      isFormatCompatibleWithScalarContract(
        { scalars: ["duration_tick:0", "onset_tick:0", "pitch_midi:0", "unknown:0"] },
        options,
      ),
    ).toBe(false);
  });
});
