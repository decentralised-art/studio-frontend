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

import {
  ChainApiRequestError,
  postChainConditionDetailed,
  postChainConnectorDetailed,
  postChainTransformationDetailed,
} from "../src/lib/chain/registryApi";

describe("registryApi publish pipeline contract", () => {
  beforeEach(() => {
    chainAuthFetchMock.mockReset();
  });

  it("posts transformation, condition and connector payloads unchanged", async () => {
    chainAuthFetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ name: "add2", owner: "0xabc" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ name: "always_true", owner: "0xabc" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ name: "corpus_seed_1", owner: "0xabc" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const transformationPayload = {
      name: "add2",
      sol_src: "return x + args[0];",
    };
    const conditionPayload = {
      name: "always_true",
      sol_src: "return true;",
    };
    const connectorPayload = {
      name: "corpus_seed_1",
      dimensions: [
        {
          transformations: [{ name: "add2", args: [1] }],
          composite: "pitch",
          bindings: {},
        },
      ],
      condition_name: "always_true",
      condition_args: [],
    };

    const txResult = await postChainTransformationDetailed(transformationPayload);
    const conditionResult = await postChainConditionDetailed(conditionPayload);
    const connectorResult = await postChainConnectorDetailed(connectorPayload);

    expect(txResult.status).toBe(201);
    expect(conditionResult.status).toBe(201);
    expect(connectorResult.status).toBe(201);

    expect(chainAuthFetchMock).toHaveBeenCalledTimes(3);

    const [txPath, txInit] = chainAuthFetchMock.mock.calls[0] ?? [];
    expect(txPath).toBe("/transformation");
    expect(txInit?.method).toBe("POST");
    expect(JSON.parse(String(txInit?.body))).toEqual(transformationPayload);

    const [conditionPath, conditionInit] = chainAuthFetchMock.mock.calls[1] ?? [];
    expect(conditionPath).toBe("/condition");
    expect(conditionInit?.method).toBe("POST");
    expect(JSON.parse(String(conditionInit?.body))).toEqual(conditionPayload);

    const [connectorPath, connectorInit] = chainAuthFetchMock.mock.calls[2] ?? [];
    expect(connectorPath).toBe("/connector");
    expect(connectorInit?.method).toBe("POST");
    expect(JSON.parse(String(connectorInit?.body))).toEqual(connectorPayload);
  });

  it("surfaces connector publish errors as ChainApiRequestError", async () => {
    chainAuthFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Connector name already exists." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      postChainConnectorDetailed({
        name: "existing_connector",
        dimensions: [{ transformations: [], bindings: {} }],
        condition_name: "",
        condition_args: [],
      }),
    ).rejects.toBeInstanceOf(ChainApiRequestError);

    expect(chainAuthFetchMock).toHaveBeenCalledTimes(1);
  });
});
