import { expect, test, type Page } from "@playwright/test";

const collectPageErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  return () => expect(errors).toEqual([]);
};

const stubRemoteApis = async (page: Page) => {
  await page.route("https://api.decentralised.art/**", async (route) => {
    const url = route.request().url();

    if (url.includes("/services/auth/me")) {
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
    window.localStorage.setItem("hypermusic_chain_token", "playwright-e2e-chain-token");
  });
};

test("redirects anonymous root visitors to login", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);

  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  assertNoPageErrors();
});

test("renders the login prototype entry point", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);

  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview Prototype" })).toBeVisible();
  await expect(page.getByPlaceholder("you@hypermusic.ai")).toBeVisible();
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
