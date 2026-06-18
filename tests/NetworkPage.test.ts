import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authSessionMock = vi.hoisted(() => ({
  getToken: vi.fn(),
  hasAuthSession: vi.fn(),
}));

const authApiMock = vi.hoisted(() => ({
  followFormatInProfile: vi.fn(),
  followUserInProfile: vi.fn(),
  getCurrentUserProfileState: vi.fn(),
  listServicesUsers: vi.fn(),
  resolveCurrentUserChainSourceAddresses: vi.fn(),
  saveCurrentUserToolboxLibrary: vi.fn(),
  unfollowFormatInProfile: vi.fn(),
  unfollowUserInProfile: vi.fn(),
}));

const feedMock = vi.hoisted(() => ({
  createConnectorPostDataStream: vi.fn(),
  doesParticlePostCacheMatchFeedScope: vi.fn(),
  getConnectorPostFeedState: vi.fn(),
  listParticlePosts: vi.fn(),
  listParticleSearchEntities: vi.fn(),
  loadMoreConnectorPostDataFromChain: vi.fn(),
  syncParticlePostDataFromChain: vi.fn(),
}));

vi.mock("$app/paths", () => ({
  asset: (path: string) => path,
  base: "",
  resolve: (route: string, params?: Record<string, string>) =>
    Object.entries(params ?? {}).reduce(
      (resolved, [key, value]) => resolved.replace(`[${key}]`, value),
      route,
    ),
}));

vi.mock("$lib/auth/session", () => authSessionMock);

vi.mock("$lib/auth/api", () => authApiMock);

vi.mock("$lib/feed/particlePostData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/feed/particlePostData")>();
  return {
    ...actual,
    createConnectorPostDataStream: feedMock.createConnectorPostDataStream,
    doesParticlePostCacheMatchFeedScope: feedMock.doesParticlePostCacheMatchFeedScope,
    getConnectorPostFeedState: feedMock.getConnectorPostFeedState,
    listParticlePosts: feedMock.listParticlePosts,
    listParticleSearchEntities: feedMock.listParticleSearchEntities,
    loadMoreConnectorPostDataFromChain: feedMock.loadMoreConnectorPostDataFromChain,
    syncParticlePostDataFromChain: feedMock.syncParticlePostDataFromChain,
  };
});

vi.mock("$lib/components/social/SocialConnectorDependencyFlow.svelte", async () => ({
  default: (await import("./fixtures/MockSocialConnectorDependencyFlow.svelte")).default,
}));

const sawyerAddress = "0xfa71ff2394596f824d69961293d095a50d322e4e";
const viewerAddress = "0xb584a15f38c2014cff54fdb1b417428b51999276";

const loadPage = async () => (await import("../src/routes/network/+page.svelte")).default;

describe("network page", () => {
  beforeEach(() => {
    authSessionMock.getToken.mockReset();
    authSessionMock.getToken.mockReturnValue("services-token");
    authSessionMock.hasAuthSession.mockReset();
    authSessionMock.hasAuthSession.mockReturnValue(true);

    authApiMock.getCurrentUserProfileState.mockReset();
    authApiMock.getCurrentUserProfileState.mockResolvedValue({
      me: {
        id: "viewer",
        display_name: "Viewer",
        ethereum_address: viewerAddress,
        profile_json: {},
      },
      userId: "viewer",
      social: {
        followedUserAddresses: [sawyerAddress],
        followedFormatHashes: [],
      },
      toolbox: { connector: [], transformation: [], condition: [] },
    });
    authApiMock.listServicesUsers.mockReset();
    authApiMock.listServicesUsers.mockResolvedValue([
      {
        id: "sawyer",
        display_name: "Sawyer",
        ethereum_address: sawyerAddress.toUpperCase(),
        profile_json: {},
      },
    ]);
    authApiMock.resolveCurrentUserChainSourceAddresses.mockReset();
    authApiMock.resolveCurrentUserChainSourceAddresses.mockReturnValue([viewerAddress]);

    feedMock.createConnectorPostDataStream.mockReset();
    feedMock.createConnectorPostDataStream.mockReturnValue({ close: vi.fn() });
    feedMock.doesParticlePostCacheMatchFeedScope.mockReset();
    feedMock.doesParticlePostCacheMatchFeedScope.mockReturnValue(false);
    feedMock.getConnectorPostFeedState.mockReset();
    feedMock.getConnectorPostFeedState.mockReturnValue({ hasMoreHistory: false });
    feedMock.listParticleSearchEntities.mockReset();
    feedMock.listParticleSearchEntities.mockReturnValue({
      connectors: [],
      transformations: [],
      conditions: [],
    });
    feedMock.loadMoreConnectorPostDataFromChain.mockReset();
    feedMock.syncParticlePostDataFromChain.mockReset();
    feedMock.syncParticlePostDataFromChain.mockResolvedValue(undefined);
    feedMock.listParticlePosts.mockReset();
    feedMock.listParticlePosts.mockReturnValue([
      {
        type: "connector",
        id: "event-connector-pitch",
        authorId: sawyerAddress,
        createdAt: 1,
        createdLabel: "",
        particleId: "pitch",
        particleLabel: "pitch",
        formatHash: "",
        usedParticleIds: [],
        usedParticleLabels: [],
        createdNodeIds: [],
        reusedNodeIds: [],
        focusNodeIds: [],
      },
    ]);
  });

  afterEach(() => {
    cleanup();
  });

  it("hydrates services user labels for feed authors before search is used", async () => {
    const Page = await loadPage();
    render(Page);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Sawyer" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("link", { name: sawyerAddress })).not.toBeInTheDocument();
    expect(authApiMock.listServicesUsers).toHaveBeenCalledTimes(1);
  });
});
