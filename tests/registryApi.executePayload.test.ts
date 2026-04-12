import { beforeEach, describe, expect, it, vi } from "vitest";

const { chainAuthFetchMock } = vi.hoisted(() => ({
  chainAuthFetchMock: vi.fn(),
}));

vi.mock("$lib/auth/api", () => ({
  chainAuthFetch: chainAuthFetchMock,
}));

vi.mock("$lib/url/url", () => ({
  buildChainApiUrl: (path: string) => `https://api.example.invalid${path}`,
}));

import { ChainApiRequestError, postChainExecuteDetailed } from "../src/lib/chain/registryApi";

describe("registryApi execute payload contract", () => {
  beforeEach(() => {
    chainAuthFetchMock.mockReset();
  });

  it("posts /execute with dynamic_ri payload unchanged", async () => {
    chainAuthFetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            feature_path: "pitch:0",
            data: [60, 61, 62],
          },
        ]),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const payload = {
      connector_name: "root_connector",
      particles_count: "12",
      dynamic_ri: {
        "0": { start_point: 0, transformation_shift: 0 },
        "2": { start_point: 2, transformation_shift: 1 },
      },
    };

    const result = await postChainExecuteDetailed(payload);

    expect(chainAuthFetchMock).toHaveBeenCalledTimes(1);
    const [path, requestInit] = chainAuthFetchMock.mock.calls[0] ?? [];
    expect(path).toBe("/execute");
    expect(requestInit?.method).toBe("POST");
    expect(JSON.parse(String(requestInit?.body))).toEqual(payload);
    expect(result.status).toBe(201);
    expect(Array.isArray(result.body)).toBe(true);
    expect(result.body[0]?.feature_path).toBe("pitch:0");
  });

  it("surfaces backend execute errors as ChainApiRequestError", async () => {
    chainAuthFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Failed to execute connector." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      postChainExecuteDetailed({
        connector_name: "root_connector",
        particles_count: "8",
        dynamic_ri: {
          "0": { start_point: 0, transformation_shift: 0 },
        },
      }),
    ).rejects.toBeInstanceOf(ChainApiRequestError);

    expect(chainAuthFetchMock).toHaveBeenCalledTimes(1);
  });
});
