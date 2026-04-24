import { describe, expect, it } from "vitest";

import {
  formatTransformationPreview,
  formatTransformationPreviewLabel,
  isConnectorKind,
  isValidChainName,
  normalizeKey,
  parseArgsInput,
  slugify,
  titleize,
  toConditionContractName,
  toContractName,
} from "../src/lib/studio/studioNaming";

describe("Studio naming helpers", () => {
  it("formats display labels and lookup keys", () => {
    expect(titleize("network-connector")).toBe("Network Connector");
    expect(normalizeKey(" My-Connector_Name ")).toBe("myconnectorname");
    expect(slugify("  Root Connector!  ")).toBe("root-connector");
  });

  it("formats transformation previews", () => {
    expect(formatTransformationPreviewLabel(" shift ", [1, 2])).toBe("shift (1, 2)");
    expect(formatTransformationPreviewLabel(" ", [])).toBe("Transformation");
    expect(formatTransformationPreview({ name: "scale", args: [3] })).toBe("scale (3)");
  });

  it("recognizes connector node kinds", () => {
    expect(isConnectorKind("feature")).toBe(true);
    expect(isConnectorKind("connector")).toBe(true);
    expect(isConnectorKind("particle")).toBe(false);
    expect(isConnectorKind(undefined)).toBe(false);
  });

  it("validates chain-safe names", () => {
    expect(isValidChainName("root_1")).toBe(true);
    expect(isValidChainName("_root")).toBe(true);
    expect(isValidChainName("1root")).toBe(false);
    expect(isValidChainName("root-name")).toBe(false);
  });

  it("creates Solidity contract names", () => {
    expect(toContractName("pitch shift")).toBe("PitchShift");
    expect(toContractName("123 filter")).toBe("Tx123Filter");
    expect(toContractName(" !!! ")).toBe("Transformation");
    expect(toConditionContractName(" !!! ")).toBe("Condition");
  });

  it("parses comma-separated numeric arguments", () => {
    expect(parseArgsInput("1, 2.9, nope, -3.2")).toEqual([1, 2, -3]);
  });
});
