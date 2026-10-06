import { beforeEach, describe, expect, it, vi } from "vitest";

const { conditionPostMock, connectorPostMock, transformationPostMock, statusRef } = vi.hoisted(
  () => ({
    conditionPostMock: vi.fn(),
    connectorPostMock: vi.fn(),
    transformationPostMock: vi.fn(),
    statusRef: { value: 200 },
  }),
);

vi.mock("$lib/chain/dcnClient", () => ({
  createDcnStatusTrackingClient: () => ({
    client: {
      conditionPost: conditionPostMock,
      connectorPost: connectorPostMock,
      transformationPost: transformationPostMock,
    },
    getLastResponseStatus: () => statusRef.value,
  }),
  isDcnApiError: (error: unknown) =>
    Boolean(
      error &&
      typeof error === "object" &&
      (error as { name?: string }).name === "DecentralisedArtApiError",
    ),
}));

import {
  ChainApiRequestError,
  postChainConditionDetailed,
  postChainConnectorDetailed,
  postChainTransformationDetailed,
} from "../src/lib/chain/registryApi";

describe("registryApi publish pipeline contract", () => {
  beforeEach(() => {
    conditionPostMock.mockReset();
    connectorPostMock.mockReset();
    transformationPostMock.mockReset();
    statusRef.value = 200;
  });

  it("publishes transformation, condition and connector payloads unchanged", async () => {
    transformationPostMock.mockImplementation(async () => {
      statusRef.value = 201;
      return { name: "add2", owner: "0xabc" };
    });
    conditionPostMock.mockImplementation(async () => {
      statusRef.value = 201;
      return { name: "always_true", owner: "0xabc" };
    });
    connectorPostMock.mockImplementation(async () => {
      statusRef.value = 201;
      return { name: "corpus_seed_1", owner: "0xabc" };
    });

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

    expect(transformationPostMock).toHaveBeenCalledWith(transformationPayload);
    expect(conditionPostMock).toHaveBeenCalledWith(conditionPayload);
    expect(connectorPostMock).toHaveBeenCalledWith(connectorPayload);
  });

  it("surfaces connector publish errors as ChainApiRequestError", async () => {
    connectorPostMock.mockRejectedValue({
      name: "DecentralisedArtApiError",
      status: 400,
      body: { message: "Connector name already exists." },
    });

    await expect(
      postChainConnectorDetailed({
        name: "existing_connector",
        dimensions: [{ transformations: [], bindings: {} }],
        condition_name: "",
        condition_args: [],
      }),
    ).rejects.toBeInstanceOf(ChainApiRequestError);

    expect(connectorPostMock).toHaveBeenCalledTimes(1);
  });
});
