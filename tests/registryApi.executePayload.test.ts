import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeMock, statusRef } = vi.hoisted(() => ({
  executeMock: vi.fn(),
  statusRef: { value: 200 },
}));

vi.mock("$lib/chain/dcnClient", () => ({
  createDcnStatusTrackingClient: () => ({
    client: {
      execute: executeMock,
    },
    getLastResponseStatus: () => statusRef.value,
  }),
  isDcnApiError: (error: unknown) =>
    Boolean(
      error && typeof error === "object" && (error as { name?: string }).name === "DcnApiError",
    ),
}));

import { ChainApiRequestError, postChainExecuteDetailed } from "../src/lib/chain/registryApi";

describe("registryApi execute payload contract", () => {
  beforeEach(() => {
    executeMock.mockReset();
    statusRef.value = 200;
  });

  it("executes with dynamic_ri payload unchanged and returns normalized current streams", async () => {
    executeMock.mockImplementation(async () => {
      statusRef.value = 201;
      return [
        {
          path: "pitch:0",
          data: [60, 61, 62],
        },
      ];
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
    expect(Array.isArray(result.body)).toBe(true);
    expect(result.body[0]).toEqual({
      path: "pitch:0",
      data: [60, 61, 62],
    });
  });

  it("normalizes legacy execute stream payloads that still use feature_path", async () => {
    executeMock.mockResolvedValue([
      {
        feature_path: "time:0",
        data: [0, 10, 20],
      },
    ]);

    const result = await postChainExecuteDetailed({
      connector_name: "root_connector",
      particles_count: "3",
      dynamic_ri: {},
    });

    expect(result.body[0]).toEqual({
      path: "time:0",
      data: [0, 10, 20],
    });
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
