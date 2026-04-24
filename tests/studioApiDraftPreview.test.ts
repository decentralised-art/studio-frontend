import { describe, expect, it } from "vitest";
import {
  isApiPath,
  isConnectorRequestBody,
  isResolvedTreePreview,
  normalizeApiRequestPath,
  normalizeDeployRequests,
  parseTransformationPreview,
  toConnectorBodyFromDef,
  type ApiDraftPreview,
} from "../src/lib/studio/apiDraftPreview";

describe("Studio API draft preview helpers", () => {
  it("normalizes API request paths from relative and absolute URLs", () => {
    expect(normalizeApiRequestPath(" /chain/connector/ ")).toBe("/chain/connector");
    expect(normalizeApiRequestPath("https://api.decentralised.art/chain/connector/")).toBe(
      "/chain/connector",
    );
    expect(isApiPath("/api/proxy/chain/connector/", "/chain/connector")).toBe(true);
  });

  it("recognizes connector bodies and resolved tree previews", () => {
    expect(
      isConnectorRequestBody({
        name: "root",
        dimensions: [{ transformations: [] }],
      }),
    ).toBe(true);
    expect(isConnectorRequestBody({ name: "root", dimensions: "1" })).toBe(false);
    expect(
      isResolvedTreePreview({
        root_connector: "root",
        connectors: [{ name: "root" }],
      }),
    ).toBe(true);
    expect(isResolvedTreePreview({ root_connector: "root" })).toBe(false);
  });

  it("prefers deploy_requests over legacy grouped requests", () => {
    const preview: ApiDraftPreview = {
      deploy_requests: [{ path: "/chain/connector", body: { name: "root" } }],
      requests: {
        connectors: [{ path: "/chain/connector", body: { name: "legacy" } }],
      },
    };

    expect(normalizeDeployRequests(preview)).toEqual([
      { path: "/chain/connector", body: { name: "root" } },
    ]);
  });

  it("flattens legacy condition, transformation, and connector requests", () => {
    const preview: ApiDraftPreview = {
      requests: {
        conditions: [{ path: "/chain/condition", body: { name: "isReady" } }],
        transformations: [{ path: "/chain/transformation", body: { name: "shift" } }],
        connectors: [{ path: "/chain/connector", body: { name: "root" } }],
      },
    };

    expect(normalizeDeployRequests(preview)).toEqual([
      { path: "/chain/condition", body: { name: "isReady" } },
      { path: "/chain/transformation", body: { name: "shift" } },
      { path: "/chain/connector", body: { name: "root" } },
    ]);
  });

  it("parses transformation preview labels", () => {
    expect(parseTransformationPreview("shift (1, 2, nope, -3.7)")).toEqual({
      name: "shift",
      args: [1, 2, -3.7],
    });
    expect(parseTransformationPreview(" ")).toBeNull();
  });

  it("serializes connector definitions to deploy bodies", () => {
    expect(
      toConnectorBodyFromDef({
        name: "root",
        dimensions: [
          {
            transformations: [{ name: "shift", args: [1, 2] }],
            composite: "child",
            bindings: { "0": "bound" },
          },
        ],
        conditionName: "isReady",
        conditionArgs: [4],
        staticRi: {
          "0": { startPoint: 2, transformationShift: -3 },
          "2": { startPoint: Number.NaN, transformationShift: 5.9 },
        },
      }),
    ).toEqual({
      name: "root",
      dimensions: [
        {
          transformations: [{ name: "shift", args: [1, 2] }],
          composite: "child",
          bindings: { "0": "bound" },
        },
      ],
      condition_name: "isReady",
      condition_args: [4],
      static_ri: {
        "0": { start_point: 2, transformation_shift: 0 },
        "2": { start_point: 0, transformation_shift: 5 },
      },
    });
  });
});
