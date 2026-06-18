import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorldApiRequestError } from "../src/lib/worlds/api";
import {
  buildWorldAssetUrl,
  buildWorldSdkAssetUrl,
  deleteWorld,
  getWorld,
  listWorlds,
  updateWorldBundle,
  uploadWorldBundle,
  validateWorldBundle,
} from "../src/lib/worlds/api";

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });

const backendWorldFixture = {
  id: "world-123",
  slug: "uploaded-world",
  name: "Uploaded World",
  version: "0.1.0",
  entryUrn: "/world-assets/world-123/index.html",
  runtime: "iframe",
  surfaces: ["world-page"],
  permissions: ["dcn.execute"],
  description: "A backend-hosted world.",
  acceptedFormatHashes: [],
  acceptedConnectorSets: [{ connectors: ["pitch"] }],
  ownerId: "user-1",
  bundleHash: "a".repeat(64),
  manifestHash: "b".repeat(64),
  entryPath: "index.html",
  status: "active",
  createdAt: "2026-06-17T12:00:00Z",
  updatedAt: "2026-06-17T12:00:00Z",
};

describe("worlds API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("lists worlds with backend query parameters", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse([backendWorldFixture]));

    const worlds = await listWorlds({
      page: 2,
      limit: 25,
      surface: "world-page",
      query: " uploaded ",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/services/worlds?page=2&limit=25&surface=world-page&q=uploaded",
    );
    expect(worlds[0]?.id).toBe("world-123");
  });

  it("gets one world by id", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(backendWorldFixture));

    const world = await getWorld("world/123");

    expect(fetchMock).toHaveBeenCalledWith("/services/worlds/world%2F123");
    expect(world.slug).toBe("uploaded-world");
  });

  it("validates world bundles as public multipart requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      expect(init?.method).toBe("POST");
      expect(init?.body).toBeInstanceOf(FormData);
      expect((init?.body as FormData).get("bundle")).toBeInstanceOf(File);
      return jsonResponse({
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
        warnings: [],
      });
    });

    const result = await validateWorldBundle(new Blob(["zip"]));

    expect(fetchMock).toHaveBeenCalledWith(
      "/services/worlds/validate",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.descriptor.slug).toBe("uploaded-world");
  });

  it("uploads and updates world bundles with the services token", async () => {
    window.localStorage.setItem("hypermusic_token", "services-token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer services-token");
      expect(init?.body).toBeInstanceOf(FormData);
      return jsonResponse(backendWorldFixture);
    });

    await uploadWorldBundle(new Blob(["zip"]));
    await updateWorldBundle("world-123", new Blob(["zip"]));

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/services/worlds/upload",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/services/worlds/world-123",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("deletes worlds with the services token", async () => {
    window.localStorage.setItem("hypermusic_token", "services-token");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await deleteWorld("world-123");

    expect(fetchMock).toHaveBeenCalledWith(
      "/services/worlds/world-123",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("surfaces backend error bodies", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: "world missing" }, 404),
    );

    await expect(getWorld("missing")).rejects.toMatchObject({
      name: "WorldApiRequestError",
      status: 404,
      message: "world missing",
    } satisfies Partial<WorldApiRequestError>);
  });

  it("resolves backend asset URNs through the services gateway", () => {
    expect(buildWorldAssetUrl("/world-assets/world-123/index.html")).toBe(
      "/services/world-assets/world-123/index.html",
    );
    expect(buildWorldAssetUrl("/services/world-assets/world-123/index.html")).toBe(
      "/services/world-assets/world-123/index.html",
    );
    expect(buildWorldSdkAssetUrl("world-runtime.js")).toBe("/services/js/sdk/world-runtime.js");
    expect(buildWorldAssetUrl("https://api.example.test/world-assets/world-123/index.html")).toBe(
      "https://api.example.test/world-assets/world-123/index.html",
    );
  });
});
