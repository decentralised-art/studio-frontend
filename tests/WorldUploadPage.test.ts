import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  uploadWorldBundle: vi.fn(),
  validateWorldBundle: vi.fn(),
}));

const sessionMock = vi.hoisted(() => ({
  getToken: vi.fn(),
}));

vi.mock("$app/paths", () => ({
  resolve: (route: string, params?: Record<string, string>) =>
    params?.slug ? route.replace("[slug]", params.slug) : route,
}));

vi.mock("$lib/auth/session", () => ({
  getToken: sessionMock.getToken,
}));

vi.mock("$lib/components/auth/WalletAuthButton.svelte", async () => ({
  default: (await import("./fixtures/MockWalletAuthButton.svelte")).default,
}));

vi.mock("$lib/worlds/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/worlds/api")>();
  return {
    ...actual,
    uploadWorldBundle: apiMock.uploadWorldBundle,
    validateWorldBundle: apiMock.validateWorldBundle,
  };
});

const validateResponse = {
  descriptor: {
    slug: "uploaded-world",
    name: "Uploaded World",
    version: "0.1.0",
    runtime: "iframe" as const,
    surfaces: ["world-page", "studio-plugin"] as const,
    permissions: ["dcn.execute"] as const,
    description: "A validated uploaded world.",
    preview: "assets/preview.png",
    acceptedFormatHashes: [],
    acceptedConnectorSets: [{ connectors: ["pitch"], optionalConnectors: [] }],
  },
  bundleHash: "a".repeat(64),
  manifestHash: "b".repeat(64),
  warnings: [],
};

const uploadedWorld = {
  id: "world-uploaded-1",
  slug: "uploaded-world",
  name: "Uploaded World",
  version: "0.1.0",
  entryUrn: "/world-assets/world-uploaded-1/index.html",
  runtime: "iframe" as const,
  surfaces: ["world-page", "studio-plugin"] as const,
  permissions: ["dcn.execute"] as const,
  description: "A validated uploaded world.",
  acceptedFormatHashes: [],
  acceptedConnectorSets: [{ connectors: ["pitch"], optionalConnectors: [] }],
  ownerId: "user-1",
  bundleHash: "a".repeat(64),
  manifestHash: "b".repeat(64),
  entryPath: "index.html",
  status: "active" as const,
  createdAt: "2026-06-17T12:00:00Z",
  updatedAt: "2026-06-17T12:00:00Z",
};

const chooseBundle = async (file = new File(["zip"], "world.zip", { type: "application/zip" })) => {
  await fireEvent.change(screen.getByLabelText(/World ZIP bundle/), {
    target: { files: [file] },
  });
  return file;
};

const loadPage = async () => (await import("../src/routes/worlds/upload/+page.svelte")).default;

describe("world upload page", () => {
  beforeEach(() => {
    apiMock.uploadWorldBundle.mockReset();
    apiMock.validateWorldBundle.mockReset();
    sessionMock.getToken.mockReset();
    sessionMock.getToken.mockReturnValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  it("validates a selected ZIP bundle without requiring login", async () => {
    apiMock.validateWorldBundle.mockResolvedValue(validateResponse);

    const Page = await loadPage();
    render(Page);

    expect(screen.getByText("Bundle Contract")).toBeInTheDocument();
    expect(screen.getByText(/Upload requires a services session/)).toBeInTheDocument();

    const file = await chooseBundle();
    await fireEvent.click(screen.getByRole("button", { name: "Validate" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Uploaded World" })).toBeInTheDocument();
    });
    expect(apiMock.validateWorldBundle).toHaveBeenCalledWith(file);
    expect(screen.getByText("assets/preview.png")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
  });

  it("uploads a validated bundle when a services session exists", async () => {
    sessionMock.getToken.mockReturnValue("services-token");
    apiMock.validateWorldBundle.mockResolvedValue(validateResponse);
    apiMock.uploadWorldBundle.mockResolvedValue(uploadedWorld);

    const Page = await loadPage();
    render(Page);

    const file = await chooseBundle();
    await fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Upload" })).toBeEnabled());

    await fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    await waitFor(() => {
      expect(screen.getByText("Uploaded")).toBeInTheDocument();
    });
    expect(apiMock.uploadWorldBundle).toHaveBeenCalledWith(file);
    expect(screen.getByRole("link", { name: "View in gallery" })).toHaveAttribute(
      "href",
      "/?world=world-uploaded-1",
    );
  });

  it("shows validation errors without enabling upload", async () => {
    apiMock.validateWorldBundle.mockRejectedValue(new Error("manifest missing"));

    const Page = await loadPage();
    render(Page);

    await chooseBundle();
    await fireEvent.click(screen.getByRole("button", { name: "Validate" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("manifest missing");
    });
    expect(screen.queryByRole("heading", { name: "Uploaded World" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
  });
});
