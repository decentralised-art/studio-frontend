import { describe, expect, it, vi } from "vitest";

const { envelope } = vi.hoisted(() => ({
  envelope: {
    block_number: 123,
    block_hash: `0x${"ab".repeat(32)}`,
    runner: `0x${"12".repeat(20)}`,
    particles: [
      "pitch",
      "time",
      "duration",
      "velocity",
      "onset_tick",
      "duration_tick",
      "pitch_midi",
      "velocity_midi",
      "tone_sample_set",
      "tone_sample_index",
    ].map((path) => ({ path: `/${path}:0`, data: [1, 2, 3] })),
  },
}));

vi.mock("$lib/auth/session", () => ({ getChainToken: () => "mock", clearChainToken: vi.fn() }));
vi.mock("$lib/chain/registryApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/chain/registryApi")>()),
  postChainExecuteDetailed: async () => ({ status: 200, body: envelope }),
}));

import { executeMidiWorldRun } from "../src/lib/worlds/midiWorldRun";
import { executeMusicXmlWorldRun } from "../src/lib/worlds/musicXmlWorldRun";
import { executeToneWorldRun } from "../src/lib/worlds/toneWorldRun";

describe("built-in Worlds with block-stamped execute results", () => {
  it.each([executeMidiWorldRun, executeMusicXmlWorldRun, executeToneWorldRun])(
    "renders particles while preserving provenance",
    async (run) => {
      const result = await run({
        connectorName: "demo",
        particlesCount: 3,
        dynamicRiInput: {},
        surface: "world-page",
        worldName: "World",
      });
      expect(result.worldInput.executionMode).toBe("execute");
      expect(result.worldInput.executionProvenance).toEqual({
        block_number: 123,
        block_hash: envelope.block_hash,
        runner: envelope.runner,
      });
    },
  );
});
