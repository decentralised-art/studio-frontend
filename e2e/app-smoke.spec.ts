import { expect, test, type Page } from "@playwright/test";

const collectPageErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  return () => expect(errors).toEqual([]);
};

const prototypeConnectorToolbox = [
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

const stubRemoteApis = async (page: Page) => {
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
              id: "user-lyra",
              email: "user-lyra@mock.decentralised.art",
              display_name: "prototype_test_account",
              ethereum_address: "0xb584a15f38c2014cff54fdb1b417428b51999276",
              profile_json: {
                public: {
                  nickname: "prototype_test_account",
                  ethereum_address: "0xb584a15f38c2014cff54fdb1b417428b51999276",
                  toolbox: prototypeConnectorToolbox,
                  toolbox_library: {
                    connector: prototypeConnectorToolbox,
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

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
};

const authenticatePrototypeSession = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("hypermusic_token", "playwright-e2e-services-token");
    window.localStorage.setItem("hypermusic_chain_token", "playwright-e2e-chain-token");
    window.localStorage.setItem("hypermusic_chain_token_user_id", "user-lyra");
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
  "/u/user-lyra",
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

test("renders the login prototype entry point", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);

  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview Prototype" })).toBeVisible();
  await expect(page.getByPlaceholder("you@hypermusic.ai")).toBeVisible();
  assertNoPageErrors();
});

test("redirects authenticated login visitors to Network", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page);
  await authenticatePrototypeSession(page);

  await page.goto("/login");

  await expect(page).toHaveURL(/\/network$/);
  await expect(page.getByRole("region", { name: "Activity feed" })).toBeVisible();
  assertNoPageErrors();
});

test("renders the Studio workspace shell", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page);
  await authenticatePrototypeSession(page);

  await page.goto("/studio");

  await expect(page.getByRole("tab", { name: /Untitled Connector/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "New Connector", exact: true })).toBeVisible();
  await expect(page.getByRole("application", { name: "Flow canvas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Toggle assistant panel" }).first()).toBeVisible();
  assertNoPageErrors();
});

test("renders the full saved connector toolbox in Studio", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page);
  await authenticatePrototypeSession(page);

  await page.goto("/studio");
  await page.getByRole("button", { name: "Toolbox" }).click();

  await expect(page.getByText("test_midi_polyphony089768")).toBeVisible();
  await expect(page.getByText("A2_breath_return_overlay_realized")).toBeVisible();
  await expect(page.getByText("test_random_add_connector_20260420_01")).toBeVisible();
  await expect(page.getByText("score-weave")).toHaveCount(0);
  await expect(page.getByText("aurora-still")).toHaveCount(0);
  assertNoPageErrors();
});

test("renders the Network shell", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page);
  await authenticatePrototypeSession(page);

  await page.goto("/network");

  await expect(
    page.getByPlaceholder("Search users, connectors, transformations, conditions"),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Activity feed" })).toBeVisible();
  assertNoPageErrors();
});
