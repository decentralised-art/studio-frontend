import { expect, test, type Page } from "@playwright/test";

const collectPageErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  return () => expect(errors).toEqual([]);
};

const fixtureConnectorToolbox = [
  "pitch",
  "time",
  "test_random_transformation1234",
  "test_random_add_connector_20260420_01",
  "velocity",
  "duration",
  "test_midi_chromatic_in_time_stable_duration_and_velocity12345",
  "test_various_midi_values12345",
  "test_midi_polyphony089768",
  "test_connector_polyphony_every_second12345678456",
  "test_break_add2_56079",
  "A2_breath_return_layer_realized",
  "A2_breath_return_overlay",
  "A2_breath_return_overlay_realized",
];

const fixtureAddress = "0xb584a15f38c2014cff54fdb1b417428b51999276";
const unlistedChainAddress = "0xfa71ff2394596f824d69961293d095a50d322e4e";
const fixtureUserId = "playwright-user";
const fixtureEmail = "playwright-user@example.test";
const fixtureDisplayName = "Playwright User";

type RemoteApiObserver = {
  chainAccountRequests: string[];
  chainFeedRequests: string[];
};

const stubRemoteApis = async (page: Page) => {
  const observer: RemoteApiObserver = {
    chainAccountRequests: [],
    chainFeedRequests: [],
  };

  await page.route("https://api.decentralised.art/**", async (route) => {
    const url = route.request().url();

    if (url.includes("/services/auth/me")) {
      const isServicesAuthenticated = route
        .request()
        .headers()
        .authorization?.startsWith("Bearer playwright-e2e-services-token");
      if (isServicesAuthenticated) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            user: {
              id: fixtureUserId,
              email: fixtureEmail,
              display_name: fixtureDisplayName,
              ethereum_address: fixtureAddress,
              profile_json: {
                public: {
                  nickname: fixtureDisplayName,
                  ethereum_address: fixtureAddress,
                  toolbox: fixtureConnectorToolbox,
                  toolbox_library: {
                    connector: fixtureConnectorToolbox,
                    transformation: [
                      "subtract",
                      "add",
                      "test_add_new1234567",
                      "test_random_20260419204115",
                      "test_random_add_20260420_01",
                    ],
                    condition: [],
                  },
                },
              },
            },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unauthorized" }),
      });
      return;
    }

    if (url.includes("/chain/feed/stream")) {
      observer.chainFeedRequests.push(url);
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `event: stream_meta\ndata: ${JSON.stringify({
          has_more: false,
          last_seq: 1,
          requested_since_seq: 0,
          min_available_seq: 1,
          replay_floor_seq: 1,
          stale_since_seq: false,
        })}\n\n`,
      });
      return;
    }

    if (url.includes("/chain/feed")) {
      observer.chainFeedRequests.push(url);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          limit: 128,
          cursor: {
            has_more: false,
            next_before: null,
          },
          items: [
            {
              feed_id: "feed-profile-connector",
              event_type: "connector_added",
              status: "safe",
              visible: true,
              tx_hash: "0xabc",
              block_number: 1,
              tx_index: 0,
              log_index: 0,
              history_cursor: "0000000000000001:0000:0000",
              created_at_ms: 1000,
              updated_at_ms: 1000,
              projector_version: 1,
              payload: {
                type: "connector",
                name: "profile_connector",
                owner: fixtureAddress,
              },
            },
            {
              feed_id: "feed-pitch",
              event_type: "connector_added",
              status: "safe",
              visible: true,
              tx_hash: "0xdef",
              block_number: 1,
              tx_index: 1,
              log_index: 0,
              history_cursor: "0000000000000001:0001:0000",
              created_at_ms: 900,
              updated_at_ms: 900,
              projector_version: 1,
              payload: {
                type: "connector",
                name: "pitch",
                owner: fixtureAddress,
              },
            },
            {
              feed_id: "feed-time",
              event_type: "connector_added",
              status: "safe",
              visible: true,
              tx_hash: "0x123",
              block_number: 1,
              tx_index: 2,
              log_index: 0,
              history_cursor: "0000000000000001:0002:0000",
              created_at_ms: 800,
              updated_at_ms: 800,
              projector_version: 1,
              payload: {
                type: "connector",
                name: "time",
                owner: fixtureAddress,
              },
            },
            {
              feed_id: "feed-unlisted-connector",
              event_type: "connector_added",
              status: "safe",
              visible: true,
              tx_hash: "0xfaa",
              block_number: 1,
              tx_index: 4,
              log_index: 0,
              history_cursor: "0000000000000001:0004:0000",
              created_at_ms: 600,
              updated_at_ms: 600,
              projector_version: 1,
              payload: {
                type: "connector",
                name: "unlisted_connector",
                owner: unlistedChainAddress,
              },
            },
            {
              feed_id: "feed-add",
              event_type: "transformation_added",
              status: "safe",
              visible: true,
              tx_hash: "0x456",
              block_number: 1,
              tx_index: 3,
              log_index: 0,
              history_cursor: "0000000000000001:0003:0000",
              created_at_ms: 700,
              updated_at_ms: 700,
              projector_version: 1,
              payload: {
                type: "transformation",
                name: "add",
                owner: fixtureAddress,
              },
            },
          ],
        }),
      });
      return;
    }

    if (url.includes("/chain/account")) {
      observer.chainAccountRequests.push(url);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    if (url.includes("/chain/connector/unlisted_connector")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          name: "unlisted_connector",
          owner: unlistedChainAddress,
          format_hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          dimensions: [
            {
              composite: null,
              transformations: [],
            },
          ],
        }),
      });
      return;
    }

    if (url.includes("/chain/connector/profile_connector")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          name: "profile_connector",
          owner: fixtureAddress,
          format_hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          dimensions: [
            {
              composite: null,
              transformations: [],
            },
          ],
        }),
      });
      return;
    }

    if (url.includes("/chain/connector/pitch") || url.includes("/chain/connector/time")) {
      const connectorName = url.includes("/chain/connector/pitch") ? "pitch" : "time";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          name: connectorName,
          owner: fixtureAddress,
          format_hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          dimensions: [
            {
              composite: null,
              transformations: [],
            },
          ],
        }),
      });
      return;
    }

    if (url.includes("/chain/transformation/add")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          name: "add",
          owner: fixtureAddress,
          sol_src: "return x + args[0];",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  return observer;
};

const authenticateFixtureSession = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("hypermusic_token", "playwright-e2e-services-token");
    window.localStorage.setItem("hypermusic_chain_token", "playwright-e2e-chain-token");
    window.localStorage.setItem(
      "hypermusic_chain_token_user_id",
      "wallet:0xb584a15f38c2014cff54fdb1b417428b51999276",
    );
  });
};

test("redirects anonymous root visitors to login", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);

  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  assertNoPageErrors();
});

const protectedRouteCases = [
  "/studio",
  "/network",
  "/account",
  "/map",
  "/create",
  "/explore",
  "/social",
  "/c/pitch",
  "/f/pitch",
  "/u/playwright-user",
  "/p/pitch",
];

protectedRouteCases.forEach((path) => {
  test(`redirects anonymous ${path} visitors to login`, async ({ page }) => {
    const assertNoPageErrors = collectPageErrors(page);
    await stubRemoteApis(page);

    await page.goto(path);

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    if (path === "/studio") {
      await expect(page.getByRole("application", { name: "Flow canvas" })).toHaveCount(0);
    }
    if (path === "/network") {
      await expect(page.getByRole("region", { name: "Activity feed" })).toHaveCount(0);
    }
    assertNoPageErrors();
  });
});

test("renders the login and registration entry point", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);

  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText("Mock system warning")).toBeVisible();
  await expect(page.getByPlaceholder("you@hypermusic.ai")).toBeVisible();
  await page.getByRole("button", { name: "Need an account? Register" }).click();
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  await expect(page.getByPlaceholder("Your public name")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  assertNoPageErrors();
});

test("redirects authenticated login visitors to Network", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/login");

  await expect(page).toHaveURL(/\/network$/);
  await expect(page.getByRole("region", { name: "Activity feed" })).toBeVisible();
  assertNoPageErrors();
});

test("renders the Studio workspace shell", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/studio");

  await expect(page.getByRole("tab", { name: /Untitled Connector/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "New Connector", exact: true })).toBeVisible();
  await expect(page.getByRole("application", { name: "Flow canvas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Toggle assistant panel" }).first()).toBeVisible();
  assertNoPageErrors();
});

test("renders the resolvable saved connector toolbox in Studio", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/studio");
  const toolboxTab = page.getByRole("button", { name: "Toolbox", exact: true });
  await expect(toolboxTab).toBeVisible({ timeout: 15_000 });
  await toolboxTab.click();

  await expect(page.getByRole("link", { name: "pitch", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "time", exact: true })).toBeVisible();
  await expect(page.getByText("test_midi_polyphony089768")).toHaveCount(0);
  await expect(page.getByText("A2_breath_return_overlay_realized")).toHaveCount(0);
  await expect(page.getByText("test_random_add_connector_20260420_01")).toHaveCount(0);
  await expect(page.getByText("score-weave")).toHaveCount(0);
  await expect(page.getByText("aurora-still")).toHaveCount(0);
  assertNoPageErrors();
});

test("renders the Network shell", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  const remoteApis = await stubRemoteApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/network");

  await expect(page.getByRole("region", { name: "Activity feed" })).toBeVisible();
  await expect(page.getByRole("link", { name: "profile_connector" })).toBeVisible({
    timeout: 15_000,
  });
  expect(remoteApis.chainFeedRequests.some((url) => url.includes("/chain/feed"))).toBe(true);
  expect(remoteApis.chainAccountRequests).toEqual([]);
  assertNoPageErrors();
});

test("opens and adds a Studio Network connector discovered from the feed", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  const remoteApis = await stubRemoteApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/studio");

  const profileConnectorCard = page
    .getByRole("listitem")
    .filter({ hasText: "profile_connector" })
    .first();
  await expect(profileConnectorCard).toBeVisible({ timeout: 15_000 });
  await profileConnectorCard.getByTitle("Add to flow").click();
  await expect(
    page.locator(".connector-node").filter({ hasText: "profile_connector" }),
  ).toBeVisible();

  await profileConnectorCard.getByTitle("Open in Studio").click();
  await expect(page.getByRole("tab", { name: /profile_connector/ })).toBeVisible();
  expect(remoteApis.chainFeedRequests.some((url) => url.includes("/chain/feed"))).toBe(true);
  expect(remoteApis.chainAccountRequests).toEqual([]);
  assertNoPageErrors();
});

test("renders account activity from feed events owned by the current chain address", async ({
  page,
}) => {
  const assertNoPageErrors = collectPageErrors(page);
  const remoteApis = await stubRemoteApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/account");

  await expect(page.getByRole("link", { name: "profile_connector" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("No activity by this user yet.")).toHaveCount(0);
  expect(remoteApis.chainFeedRequests.some((url) => url.includes("/chain/feed"))).toBe(true);
  expect(remoteApis.chainAccountRequests).toEqual([]);
  assertNoPageErrors();
});

test("renders public profile activity from the chain feed", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page);
  await authenticateFixtureSession(page);

  await page.goto(`/u/${fixtureAddress}`);

  await expect(page.getByRole("link", { name: "profile_connector" })).toBeVisible();
  await expect(page.getByText("No activity by this user yet.")).toHaveCount(0);
  assertNoPageErrors();
});

test("opens an unlisted chain address from Network search without social counters", async ({
  page,
}) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/network");

  await page
    .getByPlaceholder("Search users, connectors, transformations, conditions")
    .fill(unlistedChainAddress);

  const addressResult = page.getByRole("listitem").filter({ hasText: unlistedChainAddress });
  await expect(addressResult).toBeVisible();
  await addressResult.getByRole("link", { name: unlistedChainAddress }).click();

  await expect(page).toHaveURL(new RegExp(`/u/${unlistedChainAddress}$`));
  await expect(page.locator(".profile-main input").first()).toHaveValue(unlistedChainAddress);
  await expect(page.locator(".profile-main input").last()).toHaveValue(unlistedChainAddress);
  await expect(page.getByRole("button", { name: /^Followers/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Following/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Follow" })).toBeVisible();
  await expect(page.getByRole("link", { name: "unlisted_connector" })).toBeVisible();
  assertNoPageErrors();
});
