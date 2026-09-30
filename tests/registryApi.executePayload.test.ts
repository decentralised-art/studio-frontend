import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeMock, simulateMock, statusRef } = vi.hoisted(() => ({
  executeMock: vi.fn(),
  simulateMock: vi.fn(),
  statusRef: { value: 200 },
}));

vi.mock("$lib/chain/dcnClient", () => ({
  createDcnStatusTrackingClient: () => ({
    client: {
      execute: executeMock,
      simulate: simulateMock,
    },
    getLastResponseStatus: () => statusRef.value,
  }),
  isDcnApiError: (error: unknown) =>
    Boolean(
      error && typeof error === "object" && (error as { name?: string }).name === "DcnApiError",
    ),
}));

import {
  ChainApiRequestError,
  postChainExecuteDetailed,
  postChainSimulateDetailed,
} from "../src/lib/chain/registryApi";

describe("registryApi execute payload contract", () => {
  beforeEach(() => {
    executeMock.mockReset();
    statusRef.value = 200;
  });

  it("executes with dynamic_ri payload unchanged and returns normalized current streams", async () => {
    executeMock.mockImplementation(async () => {
      statusRef.value = 201;
      return {
        block_number: 42,
        block_hash: `0x${"ab".repeat(32)}`,
        runner: `0x${"12".repeat(20)}`,
        particles: [
          {
            path: "pitch:0",
            data: [60, 61, 62],
          },
        ],
      };
    });

    const payload = {
      connector_name: "root_connector",
      particles_count: "12",
      dynamic_ri: {
        "0": { start_point: 0, transformation_shift: 0 },
        "2": { start_point: 2, transformation_shift: 1 },
      },
    };

    const result = await postChainExecuteDetailed(payload);

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock).toHaveBeenCalledWith(
      payload.connector_name,
      payload.particles_count,
      payload.dynamic_ri,
    );
    expect(result.status).toBe(201);
    expect(result.body.block_number).toBe(42);
    expect(result.body.block_hash).toBe(`0x${"ab".repeat(32)}`);
    expect(result.body.runner).toBe(`0x${"12".repeat(20)}`);
    expect(result.body.particles[0]).toEqual({
      path: "pitch:0",
      data: [60, 61, 62],
    });
  });

  it("keeps simulation as an array, with no invented chain provenance", async () => {
    simulateMock.mockResolvedValue([{ path: "time:0", data: [0, 10, 20] }]);
    const result = await postChainSimulateDetailed({
      connector_name: "draft",
      particles_count: "3",
      dynamic_ri: {},
    });
    expect(result.body).toEqual([{ path: "time:0", data: [0, 10, 20] }]);
    expect(simulateMock).toHaveBeenCalledWith("draft", "3", {});
    expect(executeMock).not.toHaveBeenCalled();
  });

  it.each([
    [],
    {
      block_number: -1,
      block_hash: `0x${"ab".repeat(32)}`,
      runner: `0x${"12".repeat(20)}`,
      particles: [],
    },
    { block_number: 1, block_hash: "0xwrong", runner: `0x${"12".repeat(20)}`, particles: [] },
    { block_number: 1, block_hash: `0x${"ab".repeat(32)}`, runner: "0x0", particles: [] },
    {
      block_number: 1,
      block_hash: `0x${"ab".repeat(32)}`,
      runner: `0x${"12".repeat(20)}`,
      particles: [{ path: "a", data: [NaN] }],
    },
  ])("rejects legacy/malformed chain results: %j", async (body) => {
    executeMock.mockResolvedValue(body);
    await expect(
      postChainExecuteDetailed({ connector_name: "x", particles_count: "1", dynamic_ri: {} }),
    ).rejects.toBeInstanceOf(ChainApiRequestError);
  });

  it("rejects malformed success execute payloads instead of returning empty output", async () => {
    executeMock.mockResolvedValue({ message: "unexpected envelope" });

    await expect(
      postChainExecuteDetailed({
        connector_name: "root_connector",
        particles_count: "3",
        dynamic_ri: {},
      }),
    ).rejects.toMatchObject({
      name: "ChainApiRequestError",
      status: 200,
    });
  });

  it("surfaces backend execute errors as ChainApiRequestError", async () => {
    executeMock.mockRejectedValue({
      name: "DcnApiError",
      status: 400,
      body: { message: "Failed to execute connector." },
    });

    await expect(
      postChainExecuteDetailed({
        connector_name: "root_connector",
        particles_count: "8",
        dynamic_ri: {
          "0": { start_point: 0, transformation_shift: 0 },
        },
      }),
    ).rejects.toBeInstanceOf(ChainApiRequestError);

    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid execute payload shape before issuing network request", async () => {
    await expect(
      postChainExecuteDetailed({
        connector_name: "root_connector",
        particles_count: "8",
        dynamic_ri: {},
        running_instances: [],
      } as unknown as {
        connector_name: string;
        particles_count: string;
        dynamic_ri: Record<string, { start_point: number; transformation_shift: number }>;
      }),
    ).rejects.toThrow(/unsupported top-level keys/i);

    expect(executeMock).toHaveBeenCalledTimes(0);
  });
});
