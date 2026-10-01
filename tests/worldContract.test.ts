import { describe, expect, it } from "vitest";

import {
  backendWorldToFrontendDescriptor,
  normalizeBackendWorldDescriptor,
  normalizeBackendWorldDescriptorList,
  normalizeBackendWorldValidateResponse,
  WorldContractError,
} from "../src/lib/worlds/contract";

const backendWorldFixture = {
  id: "world-123",
  slug: "uploaded-world",
  name: "Uploaded World",
  version: "0.1.0",
  entryUrn: "/world-assets/world-123/index.html",
  runtime: "iframe",
  surfaces: ["world-page", "studio-plugin"],
  permissions: ["dcn.connectors.read", "dcn.execute", "browser.downloads"],
  description: "A backend-hosted world.",
  shortDescription: "Backend world",
  heroLabel: "Backend",
  accentColor: "#67d6ff",
  acceptedFormatHashes: ["0xabc"],
  acceptedConnectorSets: [
    {
      connectors: ["pitch"],
      optionalConnectors: ["velocity"],
    },
  ],
  valueLimits: {
    particlesCount: { min: 1, max: 64 },
    connectorValues: {
      "/pitch:0": { min: 0, max: 127 },
    },
  },
  preview: "preview.png",
  previewUrn: "/world-assets/world-123/preview.png",
  ownerId: "user-1",
  bundleHash: "a".repeat(64),
  manifestHash: "b".repeat(64),
  entryPath: "index.html",
  status: "active",
  createdAt: "2026-06-17T12:00:00Z",
  updatedAt: "2026-06-17T12:00:00Z",
};

describe("world backend contract", () => {
  it("normalizes backend world descriptors", () => {
    const descriptor = normalizeBackendWorldDescriptor(backendWorldFixture);

    expect(descriptor.runtime).toBe("iframe");
    expect(descriptor.surfaces).toEqual(["world-page", "studio-plugin"]);
    expect(descriptor.permissions).toEqual([
      "dcn.connectors.read",
      "dcn.execute",
      "browser.downloads",
    ]);
    expect(descriptor.acceptedConnectorSets).toEqual([
      {
        connectors: ["pitch"],
        optionalConnectors: ["velocity"],
      },
    ]);
    expect(descriptor.valueLimits?.connectorValues?.["/pitch:0"]).toEqual({
      min: 0,
      max: 127,
    });
  });

  it("normalizes backend world descriptor lists", () => {
    expect(normalizeBackendWorldDescriptorList([backendWorldFixture])).toHaveLength(1);
  });

  it("normalizes validate responses without requiring persisted descriptor fields", () => {
    const response = normalizeBackendWorldValidateResponse({
      descriptor: {
        slug: "uploaded-world",
        name: "Uploaded World",
        version: "0.1.0",
        runtime: "iframe",
        surfaces: ["world-page"],
        permissions: ["dcn.execute"],
        description: "A backend-hosted world.",
        acceptedFormatHashes: [],
        acceptedConnectorSets: [{ connectors: ["pitch"] }],
      },
      bundleHash: "a".repeat(64),
      manifestHash: "b".repeat(64),
      warnings: ["demo warning"],
    });

    expect(response.descriptor.acceptedConnectorSets[0]).toEqual({
      connectors: ["pitch"],
      optionalConnectors: [],
    });
    expect(response.warnings).toEqual(["demo warning"]);
  });

  it("adapts backend descriptors into the current frontend descriptor shape", () => {
    const descriptor = normalizeBackendWorldDescriptor(backendWorldFixture);
    const frontendDescriptor = backendWorldToFrontendDescriptor(descriptor);

    expect(frontendDescriptor.source).toBe("backend");
    expect(frontendDescriptor.entry).toBe("/world-assets/world-123/index.html");
    expect(frontendDescriptor.entryUrn).toBe("/world-assets/world-123/index.html");
    expect(frontendDescriptor.acceptedPluginIds).toEqual([]);
    expect(frontendDescriptor.permissions).toEqual(descriptor.permissions);
    expect(frontendDescriptor.acceptedConnectorSets).toEqual(descriptor.acceptedConnectorSets);
    expect(frontendDescriptor.backend?.manifestHash).toBe("b".repeat(64));
    expect(frontendDescriptor.backend?.previewUrn).toBe("/world-assets/world-123/preview.png");
    expect(frontendDescriptor.valueLimits?.scalarValues?.["/pitch:0"]).toEqual({
      min: 0,
      max: 127,
    });
  });

  it("rejects unsupported runtime kinds", () => {
    expect(() =>
      normalizeBackendWorldDescriptor({
        ...backendWorldFixture,
        runtime: "module",
      }),
    ).toThrow(WorldContractError);
  });

  it("accepts Worlds without connector compatibility metadata", () => {
    const world = normalizeBackendWorldDescriptor({
      ...backendWorldFixture,
      acceptedFormatHashes: [],
      acceptedConnectorSets: [],
      permissions: [],
    });
    expect(world.acceptedConnectorSets).toEqual([]);
    expect(world.permissions).toEqual([]);
  });
});
