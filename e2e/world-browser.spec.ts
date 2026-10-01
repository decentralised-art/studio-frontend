import { expect, test } from "@playwright/test";

const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lP8AAAAASUVORK5CYII=",
  "base64",
);

const worlds = ["Autonomous World", "Another World"].map((name, index) => ({
  id: `world-${index + 1}`,
  slug: `world-${index + 1}`,
  name,
  version: "1.0.0",
  entryUrn: `/world-assets/world-${index + 1}/index.html`,
  runtime: "iframe",
  surfaces: ["world-page"],
  permissions: [],
  description: `${name} runs without connectors.`,
  preview: "assets/preview.png",
  previewUrn: `/world-assets/world-${index + 1}/assets/preview.png`,
  acceptedFormatHashes: [],
  acceptedConnectorSets: [],
  ownerId: "another-user",
  bundleHash: `bundle-${index + 1}`,
  manifestHash: `manifest-${index + 1}`,
  entryPath: "index.html",
  status: "active",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
}));

test("browses Worlds in both views and opens an independent iframe", async ({ page }) => {
  let connectorRequests = 0;
  await page.route("**/services/worlds**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const world = worlds.find((item) => path.endsWith(`/worlds/${item.id}`));
    await route.fulfill({ json: world ?? worlds });
  });
  await page.route("**/services/world-assets/**", async (route) => {
    if (route.request().url().includes("preview.png")) {
      await route.fulfill({ status: 200, contentType: "image/png", body: image });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Independent World</title><main>World running without connectors</main>",
    });
  });
  if (!process.env.WORLD_USE_REAL_SDK) {
    await page.route("**/services/js/sdk/world-host.js", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/javascript",
        body: `export class DecentralisedArtClient { constructor() {} }
          export function createWorldHost() {
            return {
              worldUrl(url) { return url + '?worldChannel=test'; },
              pushState() {},
              dispose() {}
            };
          }`,
      });
    });
  }
  await page.route(/^https?:\/\/[^/]+\/chain\//, async (route) => {
    connectorRequests += 1;
    await route.abort();
  });

  await page.goto("/");
  await expect(page.getByRole("region", { name: "Worlds", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Autonomous World" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gallery" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "One by one" }).click();
  await expect(page.getByRole("button", { name: "One by one" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Open Autonomous World" }).click();
  await expect(page.getByRole("dialog", { name: "Autonomous World" })).toBeVisible();
  await expect(
    page.frameLocator(".world-dialog iframe").getByText("World running without connectors"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await page.getByRole("button", { name: "Exit fullscreen" }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  await page.getByRole("button", { name: "Close World" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  expect(connectorRequests).toBe(0);

  await page.reload();
  await expect(page.getByRole("button", { name: "One by one" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.goto("/worlds");
  await expect(page.getByRole("button", { name: "Open Another World" })).toBeVisible();
  await page.goto("/?world=world-2");
  await expect(page.getByRole("dialog", { name: "Another World" })).toBeVisible();
  await page.getByRole("button", { name: "Close World" }).click();
  await expect(page).toHaveURL(/\/$/);
});
