import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FIRST_PARTY_WORLDS,
  MUSICXML_SCORE_WORLD,
  type WorldRegistryLoadResult,
} from "../src/lib/worlds/registry";
import type { WorldDescriptor } from "../src/lib/worlds/types";

const registryMock = vi.hoisted(() => ({
  loadWorldRegistry: vi.fn(),
}));

vi.mock("$app/paths", () => ({
  resolve: (route: string, params?: Record<string, string>) =>
    params?.slug ? route.replace("[slug]", params.slug) : route,
}));

vi.mock("$lib/worlds/registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/worlds/registry")>();
  return {
    ...actual,
    loadWorldRegistry: registryMock.loadWorldRegistry,
  };
});

const backendWorld: WorldDescriptor = {
  ...MUSICXML_SCORE_WORLD,
  id: "backend-world-1",
  source: "backend",
  slug: "backend-world",
  name: "Backend World",
  entry: "/world-assets/backend-world-1/index.html",
  shortDescription: "A backend-hosted world.",
};

const registryResult = (
  overrides: Partial<WorldRegistryLoadResult> = {},
): WorldRegistryLoadResult => ({
  worlds: [...FIRST_PARTY_WORLDS, backendWorld],
  backendWorlds: [],
  backendError: null,
  usedFirstPartyFallback: false,
  ...overrides,
});

const loadPage = async () => (await import("../src/routes/worlds/+page.svelte")).default;

describe("worlds catalog page", () => {
  beforeEach(() => {
    registryMock.loadWorldRegistry.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders bundled worlds before adding backend registry results", async () => {
    let resolveRegistry: (value: WorldRegistryLoadResult) => void = () => undefined;
    const registryPromise = new Promise<WorldRegistryLoadResult>((resolve) => {
      resolveRegistry = resolve;
    });
    registryMock.loadWorldRegistry.mockReturnValue(registryPromise);

    const Page = await loadPage();
    render(Page);

    expect(screen.getByRole("heading", { name: "MusicXML Score World" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Backend World" })).not.toBeInTheDocument();

    resolveRegistry(registryResult());

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Backend World" })).toBeInTheDocument();
    });
    expect(registryMock.loadWorldRegistry).toHaveBeenCalledWith({ surface: "world-page" });
  });

  it("keeps bundled worlds visible when backend loading falls back", async () => {
    registryMock.loadWorldRegistry.mockResolvedValue(
      registryResult({
        worlds: [...FIRST_PARTY_WORLDS],
        backendError: new Error("offline"),
        usedFirstPartyFallback: true,
      }),
    );

    const Page = await loadPage();
    render(Page);

    await waitFor(() => {
      expect(
        screen.getByText("Showing bundled worlds. Backend registry unavailable."),
      ).toBeVisible();
    });
    expect(screen.getByRole("heading", { name: "MusicXML Score World" })).toBeInTheDocument();
  });

  it("links to the backend world upload flow", async () => {
    registryMock.loadWorldRegistry.mockResolvedValue(registryResult());

    const Page = await loadPage();
    render(Page);

    expect(screen.getByRole("link", { name: /Upload a world bundle/ })).toHaveAttribute(
      "href",
      "/worlds/upload",
    );
  });
});
