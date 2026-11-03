import { expect, test, type Page } from "@playwright/test";

const world = {
  id: "score-world-id",
  slug: "score",
  name: "Score",
  version: "0.2.2",
  entryUrn: "/world-assets/score-world-id/index.html",
  runtime: "iframe",
  surfaces: ["world-page", "studio-plugin"],
  permissions: ["browser.audio"],
  description: "Musical notation",
  acceptedFormatHashes: ["ab".repeat(32)],
  acceptedConnectorSets: [],
  preview: "assets/preview.png",
  previewUrn: "/world-assets/score-world-id/assets/preview.png",
  ownerId: `0x${"12".repeat(20)}`,
  bundleHash: "score-bundle",
  manifestHash: "score-manifest",
  entryPath: "index.html",
  status: "active",
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
};

async function setup(page: Page, authenticated = false, starterConnector: string | null = null) {
  const writes: string[] = [],
    errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.context().addInitScript(
    ({ authenticated }) => {
      if (window.top !== window) return;
      Object.assign(window, { ethereum: undefined });
      if (authenticated) localStorage.setItem("hypermusic_token", "test-services-session");
    },
    { authenticated },
  );
  await page.context().route(/.*\/(?:services|chain)\/.*/, async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (path.endsWith("/js/sdk/world-host.js"))
      return route.fulfill({
        contentType: "text/javascript",
        body: `
      export class DecentralisedArtClient { constructor() {} }
      export function createWorldHost(options) {
        queueMicrotask(() => options.onReady?.());
        return { worldUrl(url) { const u = new URL(url, location.href); u.searchParams.set('worldChannel', 'test'); return u.href; }, pushState(state) { options.iframe.contentWindow.postMessage({type: "test-state", payload: state.payload}, "*"); }, dispose() {} };
      }`,
      });
    if (path.endsWith("/studio-starter.json"))
      return route.fulfill(
        starterConnector
          ? {
              json: {
                schemaVersion: 1,
                connector: starterConnector,
                particlesCount: 12,
                dynamicRi: { "0": { start_point: 60, transformation_shift: 0 } },
                simulate: true,
              },
            }
          : { status: 404, body: "No starter" },
      );
    if (/\/chain\/connector\//.test(path))
      return route.fulfill({
        json: {
          name: decodeURIComponent(path.split("/").at(-1)!),
          owner: world.ownerId,
          address: `0x${"ab".repeat(20)}`,
          format_hash: world.acceptedFormatHashes[0],
          dimensions: [{ transformations: [{ name: "add", args: [1] }] }],
          static_ri: {},
        },
      });
    if (path.endsWith("/chain/simulate")) {
      const input = request.postDataJSON();
      const ri = input.dynamic_ri["0"];
      return route.fulfill({
        json: [
          {
            path: `/${input.connector_name}:0`,
            data: Array.from(
              { length: Number(input.particles_count) },
              (_, i) => Number(ri.start_point) + i + Number(ri.transformation_shift),
            ),
          },
        ],
      });
    }
    if (path.includes("/world-assets/"))
      return route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><main>Connect musical material.</main><script>addEventListener('message', e => { if (e.data.type === 'test-state') document.querySelector('main').textContent = JSON.stringify(e.data.payload); });</script>`,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    if (request.method() === "POST" || path.includes("/nonce/")) {
      writes.push(path);
      return route.fulfill({ status: 403, body: "No writes in launch tests" });
    }
    if (path.endsWith("/worlds/score-world-id")) return route.fulfill({ json: world });
    if (path.endsWith("/worlds/missing"))
      return route.fulfill({ status: 404, body: "World not found" });
    if (path.endsWith("/worlds")) return route.fulfill({ json: [world] });
    const user = {
      id: world.ownerId,
      ethereum_address: world.ownerId,
      display_name: "Test owner",
      profile_json: { public: { ethereum_address: world.ownerId } },
    };
    if (path.endsWith("/auth/me"))
      return route.fulfill(
        authenticated ? { json: { user } } : { status: 401, body: "Unauthorized" },
      );
    if (path.includes("/services/users/")) return route.fulfill({ json: { user } });
    if (path.endsWith("/services/users"))
      return route.fulfill({ json: authenticated ? [user] : [] });
    if (path.includes("/chain/account/"))
      return route.fulfill({
        json: { owned_connectors: [], owned_transformations: [], owned_conditions: [] },
      });
    if (path.endsWith("/feed"))
      return route.fulfill({ json: { items: [], cursor: { has_more: false }, limit: 100 } });
    return route.fulfill({ json: [] });
  });
  return { writes, errors };
}

async function openRunPanel(page: Page) {
  if (!(await page.locator("#run-samples-panel").isVisible()))
    await page.getByRole("button", { name: /^(Toggle run panel|Run panel)$/ }).click();
  await expect(page.getByRole("button", { name: "Simulate", exact: true })).toBeVisible();
}

const worldNodes = (page: Page) => page.locator('.svelte-flow__node[data-id^="plugin-world:"]');
async function expectWorldInStudio(page: Page) {
  await expect(page).toHaveURL(/\/studio(?:\?world=score-world-id)?$/);
  await expect(page.getByRole("application", { name: "Flow canvas" })).toBeVisible();
  await expect(worldNodes(page)).toHaveCount(1);
  await expect(worldNodes(page)).toContainText("Score");
  await expect(worldNodes(page).locator("iframe")).toHaveAttribute(
    "src",
    /world-assets\/score-world-id\/index\.html/,
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".world-renderer-panel")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /Score/ })).toBeVisible();
  await expect(page.getByText("View-only tab")).toHaveCount(0);
}

for (const mode of ["Gallery", "One by one"]) {
  test(`opens Score from ${mode} directly on an editable Studio canvas`, async ({ page }) => {
    const { writes, errors } = await setup(page);
    await page.goto("/worlds");
    await page.getByRole("button", { name: mode, exact: true }).click();
    const opened = page.context().waitForEvent("page");
    await page.getByRole("button", { name: "Open Score", exact: true }).click();
    const studio = await opened;
    await expectWorldInStudio(studio);
    await expect(page).toHaveURL(/\/worlds$/);
    await studio.close();
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("direct World links redirect to Studio without loading the legacy renderer", async ({
  page,
}) => {
  const { writes, errors } = await setup(page);
  await page.goto("/worlds/score");
  await expectWorldInStudio(page);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test("preserves existing tabs and reuses the World after reload and reopening", async ({
  page,
}) => {
  const { errors } = await setup(page, true);
  await page.goto("/studio");
  await expect(page.getByRole("tab", { name: /Untitled Connector/ })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(sessionStorage).some((key) => key.startsWith("dcn_studio_tabs_session_v1:")),
      ),
    )
    .toBe(true);
  await page.goto("/studio?world=score-world-id");
  await expectWorldInStudio(page);
  await expect(page.getByRole("tab", { name: /Untitled Connector/ })).toBeVisible();
  const tabs = await page.getByRole("tab").count();
  await page.reload();
  await expectWorldInStudio(page);
  await expect(page.getByRole("tab")).toHaveCount(tabs);
  await page.goto("/?world=score-world-id");
  await expectWorldInStudio(page);
  await expect(page.getByRole("tab")).toHaveCount(tabs);
  expect(errors).toEqual([]);
});

test("a missing World leaves the existing Studio work available", async ({ page }) => {
  const { writes, errors } = await setup(page);
  await page.goto("/studio?world=missing");
  await expect(page.getByRole("alert")).toContainText("World not found");
  await expect(page.getByRole("tab", { name: /Untitled Connector/ })).toBeVisible();
  await expect(worldNodes(page)).toHaveCount(0);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test("anonymous refresh keeps the World launch without adding another World node", async ({
  page,
}) => {
  const { errors } = await setup(page);
  await page.goto("/studio?world=score-world-id");
  await expectWorldInStudio(page);
  await page.reload();
  await expectWorldInStudio(page);
  expect(errors).toEqual([]);
});

for (const connector of ["pitch", "other_world_material"]) {
  test(`loads and simulates bundle-owned ${connector} without sign-in, and allows removing the root`, async ({
    page,
  }) => {
    const { writes, errors } = await setup(page, false, connector);
    await page.goto("/studio?world=score-world-id");
    await expectWorldInStudio(page);
    const root = page.locator(`.svelte-flow__node[data-id^="connector-${connector}"]`);
    await expect(root).toHaveCount(1);
    await expect(page.locator(".svelte-flow__edge")).toHaveCount(1);
    const frame = worldNodes(page).frameLocator("iframe");
    await expect(frame.locator("main")).toContainText('"executionMode":"simulate"');
    await expect(frame.locator("main")).toContainText("60,61,62");
    await openRunPanel(page);
    await page.locator("#run-samples-panel").fill("4");
    await page.getByRole("button", { name: "Simulate", exact: true }).click();
    await expect(frame.locator("main")).toContainText('"data":[60,61,62,63]');
    // Normal RI controls and the existing runner still drive the World.
    const numberInputs = root.locator('input[type="number"]');
    await numberInputs.first().fill("72");
    await numberInputs.first().press("Tab");
    await page.getByRole("button", { name: "Simulate", exact: true }).click();
    await expect(frame.locator("main")).toContainText('"data":[72,73,74,75]');
    await root.locator(".connector-title").click();
    await root.focus();
    await root.press("Enter");
    await expect(root).toHaveClass(/selected/);
    await root.press("Backspace");
    await expect(root).toHaveCount(0);
    await expect(page.locator(".svelte-flow__edge")).toHaveCount(0);
    await expect(page.locator('.svelte-flow__node[data-id^="draft-root-"]')).toHaveCount(0);
    await expect(worldNodes(page)).toHaveCount(1);
    if (connector === "pitch") {
      const item = page
        .getByRole("listitem")
        .filter({ has: page.getByRole("link", { name: connector, exact: true }) });
      await item.getByRole("button", { name: "Add to flow", exact: true }).click();
      await expect(root).toHaveCount(1);
      await page.getByRole("button", { name: "Zoom to fit", exact: true }).click();
      await worldNodes(page).locator('[data-handleid="out"]').click();
      await root.locator('[data-handleid="plugin-in"]').click();
      await expect(page.locator(".svelte-flow__edge")).toHaveCount(1);
      await root.locator('input[type="number"]').first().fill("60");
      await openRunPanel(page);
      await page.getByRole("button", { name: "Simulate", exact: true }).click();
      await expect(frame.locator("main")).toContainText('"data":[60,61,62,63]');
    }
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("restores a World draft's edited values and preserves removal after reload", async ({
  page,
}) => {
  const { writes, errors } = await setup(page, true, "pitch");
  await page.goto("/studio?world=score-world-id");
  const root = page.locator('.svelte-flow__node[data-id^="connector-pitch-"]');
  await expect(root).toHaveCount(1);
  await root.locator('input[type="number"]').first().fill("67");
  await root.locator('input[type="number"]').first().press("Tab");
  await openRunPanel(page);
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(worldNodes(page).frameLocator("iframe").locator("main")).toContainText("67,68,69");
  await page.reload();
  await expectWorldInStudio(page);
  await expect(root.locator('input[type="number"]').first()).toHaveValue("67");
  await expect(worldNodes(page).frameLocator("iframe").locator("main")).toContainText("67,68,69");
  await root.locator(".connector-title").click();
  await root.focus();
  await root.press("Enter");
  await expect(root).toHaveClass(/selected/);
  await root.press("Backspace");
  await expect(root).toHaveCount(0);
  await page.reload();
  await expectWorldInStudio(page);
  await expect(root).toHaveCount(0);
  await expect(page.locator('.svelte-flow__node[data-id^="draft-root-"]')).toHaveCount(0);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test("a new bundle starter preserves older World tabs and opens a fresh configured draft", async ({
  page,
}) => {
  const { writes, errors } = await setup(page, true);
  await page.goto("/studio?world=score-world-id");
  await expectWorldInStudio(page);
  await expect(page).toHaveURL(/\/studio$/);
  await page.context().route("**/studio-starter.json", (route) =>
    route.fulfill({
      json: {
        schemaVersion: 1,
        connector: "pitch",
        particlesCount: 12,
        dynamicRi: { "0": { start_point: 60, transformation_shift: 0 } },
        simulate: true,
      },
    }),
  );
  await page.goto("/studio?world=score-world-id");
  await expect(page.locator('.svelte-flow__node[data-id^="connector-pitch-"]')).toHaveCount(1);
  await expect(worldNodes(page)).toHaveCount(1);
  await expect(
    page.getByRole("tablist", { name: "Connector tabs" }).getByRole("tab", { name: /Score/ }),
  ).toHaveCount(2);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test("enlarges and restores a World and evaluates it in full screen without restarting its iframe", async ({
  page,
}) => {
  const { writes, errors } = await setup(page, false, "pitch");
  await page.goto("/studio?world=score-world-id");
  await expectWorldInStudio(page);
  const node = worldNodes(page);
  const iframe = node.locator("iframe");
  const frame = iframe.contentFrame();
  await expect(frame.locator("main")).toContainText("60");
  await frame.locator("main").evaluate((main) => {
    Object.assign(window, { retainedWorldDocument: main });
  });
  const state = await frame.locator("main").innerText();
  const original = await node.evaluate((element) => ({
    width: element.offsetWidth,
    height: element.offsetHeight,
  }));
  const edges = await page.locator(".svelte-flow__edge").count();
  await node.getByRole("button", { name: "Enlarge World", exact: true }).click();
  await expect
    .poll(() => node.evaluate((element) => element.offsetWidth))
    .toBeGreaterThanOrEqual(960);
  await expect
    .poll(() => node.evaluate((element) => element.offsetHeight))
    .toBeGreaterThanOrEqual(720);
  await expect(frame.locator("main")).toHaveText(state);
  expect(
    await frame
      .locator("main")
      .evaluate((main) => main === Reflect.get(window, "retainedWorldDocument")),
  ).toBe(true);
  expect(await page.locator(".svelte-flow__edge").count()).toBe(edges);
  await node.getByRole("button", { name: "Restore World size", exact: true }).click();
  await expect
    .poll(() =>
      node.evaluate((element) => ({ width: element.offsetWidth, height: element.offsetHeight })),
    )
    .toEqual(original);
  await node.getByRole("button", { name: "Full screen World", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => document.fullscreenElement?.classList.contains("backend-world-shell")),
    )
    .toBe(true);
  const fullscreenBounds = await node.locator(".backend-world-shell").boundingBox();
  expect(Math.abs(fullscreenBounds!.width - page.viewportSize()!.width)).toBeLessThan(2);
  expect(Math.abs(fullscreenBounds!.height - page.viewportSize()!.height)).toBeLessThan(2);
  await expect(frame.locator("main")).toHaveText(state);
  await node.getByRole("button", { name: "Exit full screen World", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  expect(
    await frame
      .locator("main")
      .evaluate((main) => main === Reflect.get(window, "retainedWorldDocument")),
  ).toBe(true);
  await expect
    .poll(() =>
      node.evaluate((element) => ({ width: element.offsetWidth, height: element.offsetHeight })),
    )
    .toEqual(original);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});
