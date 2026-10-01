import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorldRegistryLoadResult } from "../src/lib/worlds/registry";
import type { WorldDescriptor } from "../src/lib/worlds/types";

const appStateMock = vi.hoisted(() => ({
  page: {
    params: {
      slug: "backend-world",
      connector: undefined as string | undefined,
    },
  },
}));

const registryMock = vi.hoisted(() => ({
  loadWorldRegistry: vi.fn(),
}));

const navigationMock = vi.hoisted(() => ({
  goto: vi.fn(),
}));

const authApiMock = vi.hoisted(() => ({
  getCurrentUserProfileState: vi.fn(),
  listServicesUsers: vi.fn(),
}));

const worldApiMock = vi.hoisted(() => ({
  deleteWorld: vi.fn(),
  updateWorldBundle: vi.fn(),
}));

const formatDiscoveryMock = vi.hoisted(() => ({
  fetchWorldFormatConnectorEvents: vi.fn(),
}));

const backendHostMock = vi.hoisted(() => ({
  createBackendWorldHost: vi.fn(async () => ({
    worldUrl: (url: string) => `${url}?worldChannel=test-channel`,
    pushState: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock("$lib/worlds/backendHost", () => ({
  createBackendWorldHost: backendHostMock.createBackendWorldHost,
}));

vi.mock("$app/environment", () => ({
  browser: true,
  building: false,
  dev: false,
  version: "test",
}));

vi.mock("$app/navigation", () => navigationMock);

vi.mock("$app/paths", () => ({
  asset: (path: string) => path,
  base: "",
  resolve: (route: string, params?: Record<string, string>) =>
    Object.entries(params ?? {}).reduce(
      (resolved, [key, value]) => resolved.replace(`[${key}]`, value),
      route,
    ),
}));

vi.mock("$app/state", () => appStateMock);

vi.mock("$lib/auth/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/api")>();
  return {
    ...actual,
    getCurrentUserProfileState: authApiMock.getCurrentUserProfileState,
    listServicesUsers: authApiMock.listServicesUsers,
  };
});

vi.mock("$lib/worlds/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/worlds/api")>();
  return {
    ...actual,
    deleteWorld: worldApiMock.deleteWorld,
    updateWorldBundle: worldApiMock.updateWorldBundle,
  };
});

vi.mock("$lib/worlds/formatDiscovery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/worlds/formatDiscovery")>();
  return {
    ...actual,
    fetchWorldFormatConnectorEvents: formatDiscoveryMock.fetchWorldFormatConnectorEvents,
  };
});

vi.mock("$lib/components/social/SocialConnectorDependencyFlow.svelte", async () => ({
  default: (await import("./fixtures/MockSocialConnectorDependencyFlow.svelte")).default,
}));

vi.mock("$lib/worlds/registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/worlds/registry")>();
  return {
    ...actual,
    loadWorldRegistry: registryMock.loadWorldRegistry,
  };
});

const backendWorld: WorldDescriptor = {
  id: "backend-world-1",
  source: "backend",
  slug: "backend-world",
  name: "Backend World",
  version: "0.1.0",
  entry: "/world-assets/backend-world-1/index.html",
  entryUrn: "/world-assets/backend-world-1/index.html",
  runtime: "iframe",
  permissions: ["dcn.execute", "browser.downloads"],
  acceptedPluginIds: [],
  acceptedConnectorSets: [{ connectors: ["pitch", "duration"], optionalConnectors: ["velocity"] }],
  surfaces: ["world-page"],
  description: "A backend-hosted world.",
  shortDescription: "A backend-hosted world.",
  backend: {
    ownerId: "user-1",
    bundleHash: "a".repeat(64),
    manifestHash: "b".repeat(64),
    entryPath: "index.html",
    entryUrn: "/world-assets/backend-world-1/index.html",
    status: "active",
    createdAt: "2026-06-17T12:00:00Z",
    updatedAt: "2026-06-17T12:00:00Z",
  },
};

const registryResult = (): WorldRegistryLoadResult => ({
  worlds: [backendWorld],
  backendWorlds: [],
  backendError: null,
  usedFirstPartyFallback: false,
});

const registryResultWithWorld = (world: WorldDescriptor): WorldRegistryLoadResult => ({
  worlds: [world],
  backendWorlds: [],
  backendError: null,
  usedFirstPartyFallback: false,
});

const anonymousProfileState = () => ({
  me: null,
  userId: null,
  social: { followedUserAddresses: [], followedFormatHashes: [] },
  toolbox: { connector: [], transformation: [], condition: [] },
});

const ownerProfileState = () => ({
  me: { id: "user-1" },
  userId: "user-1",
  social: { followedUserAddresses: [], followedFormatHashes: [] },
  toolbox: { connector: [], transformation: [], condition: [] },
});

const backendWorldResponse = (overrides: Record<string, unknown> = {}) => ({
  id: "backend-world-1",
  slug: "backend-world",
  name: "Backend World",
  version: "0.1.0",
  entryUrn: "/world-assets/backend-world-1/index.html",
  runtime: "iframe" as const,
  surfaces: ["world-page"] as const,
  permissions: ["dcn.execute", "browser.downloads"] as const,
  description: "A backend-hosted world.",
  shortDescription: "A backend-hosted world.",
  acceptedFormatHashes: [],
  acceptedConnectorSets: [{ connectors: ["pitch", "duration"], optionalConnectors: ["velocity"] }],
  ownerId: "user-1",
  bundleHash: "a".repeat(64),
  manifestHash: "b".repeat(64),
  entryPath: "index.html",
  status: "active" as const,
  createdAt: "2026-06-17T12:00:00Z",
  updatedAt: "2026-06-17T12:00:00Z",
  ...overrides,
});

const loadPage = async () => (await import("../src/routes/worlds/[slug]/+page.svelte")).default;

const openOwnerControls = async () => {
  const summary = await screen.findByText("Owner controls");
  await fireEvent.click(summary);
};

describe("world detail page", () => {
  beforeEach(() => {
    appStateMock.page.params.slug = "backend-world";
    appStateMock.page.params.connector = undefined;
    authApiMock.getCurrentUserProfileState.mockReset();
    authApiMock.getCurrentUserProfileState.mockResolvedValue(anonymousProfileState());
    authApiMock.listServicesUsers.mockReset();
    authApiMock.listServicesUsers.mockResolvedValue([]);
    navigationMock.goto.mockReset();
    formatDiscoveryMock.fetchWorldFormatConnectorEvents.mockReset();
    formatDiscoveryMock.fetchWorldFormatConnectorEvents.mockResolvedValue({
      events: [],
      formatHashes: [],
      hasMore: false,
      errors: [],
    });
    registryMock.loadWorldRegistry.mockReset();
    registryMock.loadWorldRegistry.mockResolvedValue(registryResult());
    worldApiMock.deleteWorld.mockReset();
    worldApiMock.updateWorldBundle.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("resolves backend worlds and mounts their iframe through the SDK host", async () => {
    const Page = await loadPage();
    render(Page);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Backend World" })).toBeInTheDocument();
    });

    const iframe = screen.getByTitle("Backend World");
    await waitFor(() => {
      expect(iframe).toHaveAttribute(
        "src",
        expect.stringContaining("/services/world-assets/backend-world-1/index.html"),
      );
      expect(iframe).toHaveAttribute("src", expect.stringContaining("worldChannel="));
    });
    expect(screen.getByText("Compatible Connectors")).toBeInTheDocument();
    expect(screen.queryByText("Declared Connector Sets")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Random connector" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Random iteration" })).toBeDisabled();
    expect(formatDiscoveryMock.fetchWorldFormatConnectorEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        acceptedConnectorNames: ["pitch", "duration", "velocity"],
        connectorLimit: 24,
      }),
    );
    expect(registryMock.loadWorldRegistry).toHaveBeenCalledWith({ surface: "world-page" });
  });

  it("initializes backend runtime controls from the route connector", async () => {
    appStateMock.page.params.connector = "lead_pitch";

    const Page = await loadPage();
    render(Page);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Backend World" })).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: "lead_pitch" })).toHaveAttribute(
      "href",
      "/c/lead_pitch",
    );
    expect(screen.queryByText("Declared Connector Sets")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Random iteration" })).not.toBeDisabled();
  });

  it("loads compatible connector candidates for backend worlds with format hashes", async () => {
    const formatHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const worldWithFormatHash: WorldDescriptor = {
      ...backendWorld,
      acceptedFormatHashes: [formatHash],
    };
    registryMock.loadWorldRegistry.mockResolvedValue(registryResultWithWorld(worldWithFormatHash));
    formatDiscoveryMock.fetchWorldFormatConnectorEvents.mockResolvedValue({
      events: [
        {
          type: "connector",
          id: "world-format-candidate-melody_root",
          authorId: "0xb530bf08d76015080c67d6b5f00cdee53b45bdda",
          createdAt: 0,
          createdLabel: "",
          particleId: "melody_root",
          particleLabel: "melody_root",
          formatHash,
          usedParticleIds: [],
          usedParticleLabels: [],
          createdNodeIds: [],
          reusedNodeIds: [],
          focusNodeIds: [],
        },
      ],
      formatHashes: [formatHash],
      hasMore: false,
      errors: [],
    });

    const Page = await loadPage();
    render(Page);

    await waitFor(() => {
      expect(formatDiscoveryMock.fetchWorldFormatConnectorEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          acceptedFormatHashes: [formatHash],
          connectorLimit: 24,
        }),
      );
    });

    expect(screen.getByText("Compatible Connectors")).toBeInTheDocument();
    expect(screen.queryByText("Declared Connector Sets")).not.toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "melody_root" })).toBeInTheDocument();
  });

  it("hides backend world owner controls from non-owners", async () => {
    const Page = await loadPage();
    render(Page);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Backend World" })).toBeInTheDocument();
      expect(authApiMock.getCurrentUserProfileState).toHaveBeenCalled();
    });

    expect(screen.queryByText("Owner controls")).not.toBeInTheDocument();
  });

  it("updates backend world bundles for the uploaded world owner", async () => {
    authApiMock.getCurrentUserProfileState.mockResolvedValue(ownerProfileState());
    worldApiMock.updateWorldBundle.mockResolvedValue(
      backendWorldResponse({
        name: "Backend World v2",
        version: "0.2.0",
        bundleHash: "c".repeat(64),
        updatedAt: "2026-06-17T13:00:00Z",
      }),
    );

    const Page = await loadPage();
    render(Page);

    await waitFor(() => {
      expect(screen.getByText("Owner controls")).toBeInTheDocument();
    });
    await openOwnerControls();

    const file = new File(["zip"], "replacement.zip", { type: "application/zip" });
    await fireEvent.change(screen.getByLabelText("Replacement world ZIP bundle"), {
      target: { files: [file] },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Update bundle" }));

    await waitFor(() => {
      expect(worldApiMock.updateWorldBundle).toHaveBeenCalledWith("backend-world-1", file);
    });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Backend World v2" })).toBeInTheDocument();
    });
    expect(screen.getByText("World bundle updated.")).toBeInTheDocument();
  });

  it("deletes backend worlds after owner slug confirmation", async () => {
    authApiMock.getCurrentUserProfileState.mockResolvedValue(ownerProfileState());
    worldApiMock.deleteWorld.mockResolvedValue(undefined);

    const Page = await loadPage();
    render(Page);

    await waitFor(() => {
      expect(screen.getByText("Owner controls")).toBeInTheDocument();
    });
    await openOwnerControls();

    await fireEvent.input(screen.getByLabelText("Confirm world slug"), {
      target: { value: " BACKEND-WORLD " },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Delete world" }));

    await waitFor(() => {
      expect(worldApiMock.deleteWorld).toHaveBeenCalledWith("backend-world-1");
      expect(navigationMock.goto).toHaveBeenCalledWith("/worlds");
    });
  });
});
