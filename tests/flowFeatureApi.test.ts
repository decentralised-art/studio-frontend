import { beforeEach, describe, expect, it, vi } from "vitest";

const { connectorExistsMock, connectorGetMock } = vi.hoisted(() => ({
  connectorExistsMock: vi.fn(),
  connectorGetMock: vi.fn(),
}));

vi.mock("$lib/chain/dcnClient", () => ({
  createDcnClient: () => ({
    connectorExists: connectorExistsMock,
    connectorGet: connectorGetMock,
  }),
  isDcnApiError: (error: unknown) =>
    Boolean(
      error &&
      typeof error === "object" &&
      (error as { name?: string }).name === "DecentralisedArtApiError",
    ),
}));

import {
  connectorToFlowFeature,
  doesChainConnectorFeatureExist,
  getChainConnectorFeature,
} from "../src/lib/chain/flowFeatureApi";

describe("flowFeatureApi", () => {
  beforeEach(() => {
    connectorExistsMock.mockReset();
    connectorGetMock.mockReset();
  });

  it("maps connector composites and bindings to legacy flow feature dependencies", () => {
    expect(
      connectorToFlowFeature({
        name: "root",
        ownerAddress: "0xb584a15f38c2014cff54fdb1b417428b51999276",
        dimensions: [
          {
            composite: "child",
            bindings: {
              "0": "pitch",
              "1": "time",
              "2": "pitch",
            },
            transformations: [{ name: "add", args: [1, 2] }],
          },
          {
            transformations: [{ name: "scale", args: [4] }],
            bindings: {},
          },
        ],
      }),
    ).toEqual({
      name: "root",
      owner: "0xb584a15f38c2014cff54fdb1b417428b51999276",
      dimensions: [
        {
          feature_name: "child",
          transformations: [{ name: "add", args: [1, 2] }],
        },
        {
          feature_name: "pitch",
          transformations: [{ name: "add", args: [1, 2] }],
        },
        {
          feature_name: "time",
          transformations: [{ name: "add", args: [1, 2] }],
        },
        {
          transformations: [{ name: "scale", args: [4] }],
        },
      ],
    });
  });

  it("fetches connector features through the SDK", async () => {
    connectorGetMock.mockResolvedValue({
      name: "root",
      owner: "0xb584a15f38c2014cff54fdb1b417428b51999276",
      address: "0x0",
      format_hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      condition_name: "",
      condition_args: [],
      dimensions: [
        {
          composite: "child",
          transformations: [{ name: "add", args: [1] }],
        },
      ],
    });

    await expect(getChainConnectorFeature(" root ")).resolves.toEqual({
      name: "root",
      owner: "0xb584a15f38c2014cff54fdb1b417428b51999276",
      dimensions: [
        {
          feature_name: "child",
          transformations: [{ name: "add", args: [1] }],
        },
      ],
    });
    expect(connectorGetMock).toHaveBeenCalledWith("root");
  });

  it("returns null for missing connector features", async () => {
    connectorGetMock.mockRejectedValue({
      name: "DecentralisedArtApiError",
      status: 404,
      body: { error: "not_found" },
    });

    await expect(getChainConnectorFeature("missing")).resolves.toBeNull();
  });

  it("checks connector existence through the SDK", async () => {
    connectorExistsMock.mockResolvedValue(true);

    await expect(doesChainConnectorFeatureExist(" child ")).resolves.toBe(true);
    expect(connectorExistsMock).toHaveBeenCalledWith("child");
  });
});
