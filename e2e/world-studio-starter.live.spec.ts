import { expect, test } from "@playwright/test";

test("Score starter renders real public simulation through the canonical SDK and Verovio", async ({
  page,
}) => {
  test.skip(!process.env.DCN_WORLD_STARTER_LIVE, "Opt-in public API/local World integration check");
  test.setTimeout(60_000);
  const writes: string[] = [],
    errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (
      /\/(?:services|chain)\//.test(new URL(request.url()).pathname) &&
      request.method() !== "GET" &&
      request.method() !== "OPTIONS" &&
      !new URL(request.url()).pathname.endsWith("/simulate")
    )
      writes.push(request.url());
  });
  await page.addInitScript(() => {
    Object.assign(window, { ethereum: undefined });
  });
  await page.goto("/studio?world=cb881a1e-e385-48d7-b8ad-06d2ae3c05f6");
  const world = page.locator('.svelte-flow__node[data-id^="plugin-world:"]');
  const score = world.frameLocator("iframe");
  await expect(world).toHaveCount(1);
  await expect(score.getByRole("button", { name: /^Note \d+, MIDI pitch/ })).toHaveCount(12, {
    timeout: 45_000,
  });
  await expect(
    score.getByRole("button", { name: "Note 1, MIDI pitch 60", exact: true }),
  ).toBeVisible();
  await expect(page.locator('.svelte-flow__node[data-id^="connector-pitch-"]')).toHaveCount(1);
  await expect(page.locator(".svelte-flow__edge")).toHaveCount(1);
  await page.screenshot({ path: "/private/tmp/score-world-starter-local.png" });
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});
