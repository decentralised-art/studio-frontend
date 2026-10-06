import { expect, test, type Page } from "@playwright/test";

const address = `0x${"ab".repeat(20)}`;
type RunRequest = {
  connector_name: string;
  particles_count: number;
  dynamic_ri?: Record<string, { start_point: number }>;
};

// Exercise the real Studio UI anonymously, with deterministic API responses.
async function setup(page: Page, lesson: "first-run" | "starting-value", holdFeed = false) {
  const requests: Array<{ path: string; body: RunRequest }> = [];
  const unexpectedWrites: string[] = [];
  const errors: string[] = [];
  let wrongResult = false;
  let releaseFeed = () => {};
  const feedReady = holdFeed
    ? new Promise<void>((resolve) => {
        releaseFeed = resolve;
      })
    : Promise.resolve();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.clear();
    Object.assign(window, { ethereum: undefined });
  });
  await page.route(/.*\/(?:services|chain)\/.*/, async (route) => {
    const request = route.request();
    if (!["fetch", "xhr"].includes(request.resourceType())) return route.continue();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/simulate") || path.endsWith("/execute")) {
      const body = request.postDataJSON() as RunRequest;
      requests.push({ path, body });
      const start = Number(body.dynamic_ri?.["0"]?.start_point ?? 0);
      const particles = [
        {
          path: "/pitch:0",
          data: Array.from(
            { length: Number(body.particles_count) },
            (_, i) => start + i + (wrongResult ? 1 : 0),
          ),
        },
      ];
      return route.fulfill({
        json: path.endsWith("/simulate")
          ? particles
          : {
              block_number: 10,
              block_hash: `0x${"ef".repeat(32)}`,
              runner: address,
              registry: address,
              particles,
            },
      });
    }
    if (request.method() === "POST" || path.includes("/nonce/")) {
      unexpectedWrites.push(path);
      return route.fulfill({
        status: 403,
        json: { message: "No signing or writing in this lesson" },
      });
    }
    if (path.endsWith("/connector/pitch"))
      return route.fulfill({
        json: {
          name: "pitch",
          owner: address,
          address,
          dimensions: [{ transformations: [{ name: "add", args: [1] }] }],
        },
      });
    if (path.endsWith("/transformation/add"))
      return route.fulfill({
        json: {
          name: "add",
          owner: address,
          address,
          args_count: 1,
        },
      });
    if (path.endsWith("/feed")) {
      await feedReady;
      return route.fulfill({
        json: {
          limit: 100,
          cursor: { has_more: false },
          items: [
            {
              feed_id: "pitch",
              event_type: "connector_added",
              status: "safe",
              visible: true,
              tx_hash: `0x${"cd".repeat(32)}`,
              block_number: 1,
              tx_index: 0,
              log_index: 0,
              history_cursor: "0000000000000001:0000:0000",
              created_at_ms: 1000,
              updated_at_ms: 1000,
              projector_version: 1,
              payload: { type: "connector", name: "pitch", owner: address },
            },
          ],
        },
      });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto(`/studio?network_kind=connector&network_id=pitch&lesson=${lesson}`);
  await expect(page.getByRole("tab", { name: /pitch/ })).toBeVisible();
  const guide = page.getByRole("region", { name: "Studio guided tutorial" });
  await expect(guide).toBeVisible();
  return {
    requests,
    unexpectedWrites,
    errors,
    guide,
    releaseFeed,
    setWrongResult: (value: boolean) => {
      wrongResult = value;
    },
  };
}

async function reachRun(page: Page, guide: ReturnType<Page["getByRole"]>, start: number) {
  await expect(guide.locator(".guide-notice")).toHaveCount(0);
  const next = guide.getByRole("button", { name: "Next", exact: true });
  await page
    .locator(".svelte-flow__node")
    .filter({ has: page.locator(".connector-title", { hasText: /^pitch$/ }) })
    .locator(".connector-title")
    .click();
  await next.click();
  if (!(await page.locator("#connector-ri-start").isVisible())) {
    await page.getByRole("button", { name: "Toggle inspector panel", exact: true }).click();
  }
  await next.click();
  await page.locator("#connector-ri-start").fill(String(start));
  await page.locator("#connector-ri-shift").fill("0");
  await next.click();
  await page.getByRole("button", { name: "Toggle run panel", exact: true }).click();
  await next.click();
  await page.locator("#run-samples-panel").fill("4");
  await next.click();
  await expect(guide.getByRole("button", { name: "Check my result" })).toBeDisabled();
}

for (const { lesson, width } of [
  { lesson: "first-run", width: 1440 },
  { lesson: "starting-value", width: 1440 },
] as const) {
  test(`${lesson} guides a real public run at ${width}px and checks its returned values without sign-in`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await setup(page, lesson);
    const start = lesson === "first-run" ? 0 : 10;
    await reachRun(page, state.guide, start);
    const mode = lesson === "first-run" ? "Execute on the Network" : "Simulate";
    await page.getByRole("button", { name: mode, exact: true }).click();
    await state.guide.getByRole("button", { name: "Check my result" }).click();
    await expect(state.guide.getByRole("heading", { name: "Check what came back" })).toBeVisible();
    const output = JSON.parse(await page.locator(".runner-output").innerText());
    expect((Array.isArray(output) ? output : output.particles)[0].data).toEqual([
      start,
      start + 1,
      start + 2,
      start + 3,
    ]);
    expect(state.requests).toHaveLength(1);
    expect(state.requests[0].body.connector_name).toBe("pitch");
    if (start) expect(state.requests[0].body.dynamic_ri?.["0"]?.start_point).toBe(start);
    expect(state.unexpectedWrites).toEqual([]);
    expect(state.errors).toEqual([]);
    await state.guide.getByRole("button", { name: "Finish walkthrough" }).click();
    await expect(state.guide).toBeHidden();
    expect(new URL(page.url()).searchParams.has("lesson")).toBe(false);
    await expect(page.getByRole("button", { name: mode, exact: true })).toBeEnabled();
  });
}

test("the guide waits for a matching result and can be dismissed without affecting Studio", async ({
  page,
}) => {
  const state = await setup(page, "first-run");
  await reachRun(page, state.guide, 0);
  state.setWrongResult(true);
  await page.getByRole("button", { name: "Execute on the Network", exact: true }).click();
  await expect(state.guide).toContainText("This run hasn’t matched the exercise yet");
  await expect(state.guide.getByRole("button", { name: "Check my result" })).toBeDisabled();
  state.setWrongResult(false);
  await page.getByRole("button", { name: "Execute on the Network", exact: true }).click();
  await expect(state.guide.getByRole("button", { name: "Check my result" })).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(state.guide).toBeHidden();
  await expect(page.locator(".runner-output")).toContainText("/pitch:0");
  expect(state.unexpectedWrites).toEqual([]);
  expect(state.errors).toEqual([]);
});

test("a narrow window explains the screen requirement and resizing resumes the guide", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const state = await setup(page, "starting-value");
  await expect(
    state.guide.getByRole("heading", { name: "Give the Studio a little more room" }),
  ).toBeVisible();
  await expect(state.guide.getByRole("link", { name: "Tutorial", exact: true })).toHaveAttribute(
    "href",
    "/tutorial",
  );
  expect(state.requests).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(
    state.guide.getByRole("heading", { name: "Select pitch on the canvas" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zoom to fit", exact: true }).click();
  await reachRun(page, state.guide, 10);
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(state.guide.getByRole("button", { name: "Check my result" })).toBeEnabled();
  expect(state.unexpectedWrites).toEqual([]);
  expect(state.errors).toEqual([]);
});

test("the walkthrough waits for the initial network refresh before starting", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const state = await setup(page, "starting-value", true);
  await expect(state.guide).toContainText("Waiting for published pitch to load");
  await expect(state.guide.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  expect(state.requests).toEqual([]);
  state.releaseFeed();
  await reachRun(page, state.guide, 10);
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(state.guide.getByRole("button", { name: "Check my result" })).toBeEnabled();
  expect(state.unexpectedWrites).toEqual([]);
  expect(state.errors).toEqual([]);
});
