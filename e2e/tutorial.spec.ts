import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const errorsByPage = new WeakMap<Page, string[]>();

// Browser tests use local previews and mocked public API responses, without a wallet.
test.beforeEach(async ({ page, baseURL }) => {
  const errors: string[] = [];
  errorsByPage.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) {
      errors.push(message.text());
    }
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const origin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  );
});

test.afterEach(async ({ page }) => {
  expect(errorsByPage.get(page)).toEqual([]);
});

// Wait for a working route control before interacting with the server-rendered diagrams.
async function openTutorial(page: Page) {
  await page.goto("/tutorial");
  await expect(async () => {
    await page.getByRole("button", { name: "Use an AI agent", exact: true }).first().click();
    await expect(
      page.getByRole("heading", { name: "Run four values with your agent" }),
    ).toBeVisible();
  }).toPass();
  await page.getByRole("button", { name: "Use Studio", exact: true }).first().click();
}

const examples = [
  {
    name: "Music",
    connector: "pitch",
    variants: [
      { name: "Semitones +1", indexes: [60, 61, 62, 63], meanings: ["C4", "C♯4", "D4", "D♯4"] },
      { name: "Whole tones +2", indexes: [60, 62, 64, 66], meanings: ["C4", "D4", "E4", "F♯4"] },
      { name: "Octaves +12", indexes: [60, 72, 84, 96], meanings: ["C4", "C5", "C6", "C7"] },
    ],
  },
  {
    name: "Graphics",
    connector: "colour",
    variants: [
      {
        name: "Adjacent +1",
        indexes: [0, 1, 2, 3],
        meanings: ["#ffd36b", "#f077a1", "#73c8ef", "#98d6ba"],
      },
      {
        name: "Every second +2",
        indexes: [0, 2, 4, 6],
        meanings: ["#ffd36b", "#73c8ef", "#ca9bff", "#bfd265"],
      },
      {
        name: "Spread +3",
        indexes: [0, 3, 6, 9],
        meanings: ["#ffd36b", "#98d6ba", "#bfd265", "#6bddd2"],
      },
    ],
  },
  {
    name: "Game",
    connector: "pose",
    variants: [
      { name: "Warm up +1", indexes: [0, 1, 2, 3], meanings: ["Idle", "Wave", "Stretch", "Kick"] },
      {
        name: "Defence +2",
        indexes: [0, 2, 4, 6],
        meanings: ["Idle", "Stretch", "Crouch", "Turn"],
      },
      { name: "Combo +3", indexes: [0, 3, 6, 9], meanings: ["Idle", "Kick", "Turn", "Jump"] },
    ],
  },
];

const assertNoHorizontalOverflow = async (page: Page) => {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const surfaces = [document.documentElement, ...document.querySelectorAll("main, figure")];
        return Math.max(...surfaces.map((element) => element.scrollWidth - element.clientWidth));
      }),
    )
    .toBeLessThanOrEqual(1);
};

test("the first exercise switches between Studio instructions and an agent prompt", async ({
  page,
}) => {
  await openTutorial(page);
  const route = page.getByRole("group", { name: "Follow the tutorial with" });
  const studio = page.getByRole("heading", { name: "Run four values in Studio" });
  const agent = page.getByRole("heading", { name: "Run four values with your agent" });
  await expect(studio).toBeVisible();
  await expect(agent).toBeHidden();
  const contents = page.getByRole("navigation", { name: "On this page" });
  await expect(contents).toBeVisible();
  await expect(contents.getByRole("link")).toHaveCount(11);
  for (const id of [
    "first-run",
    "palettes",
    "running-settings",
    "formats",
    "create-draft",
    "publish",
    "world-editors",
    "conditions",
    "custom-elements",
    "networks",
    "economies",
  ]) {
    await expect(contents.locator(`a[href="#${id}"]`)).toHaveCount(1);
    await expect(page.locator(`:is(h2, h3)#${id}`)).toHaveCount(1);
  }
  await expect(page.locator(".screen-mark")).toHaveCount(0);
  await route.getByRole("button", { name: "Use an AI agent" }).click();
  await expect(agent).toBeVisible();
  await expect(studio).toBeHidden();
  await expect(page.getByRole("button", { name: "Copy exploration prompt" })).toBeVisible();
  await expect(route.getByRole("button", { name: "Use an AI agent" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await route.getByRole("button", { name: "Use Studio" }).click();
  await expect(studio).toBeVisible();
  await expect(agent).toBeHidden();
});

test("all four learning routes continue through the starting-value and draft exercises", async ({
  page,
}) => {
  await openTutorial(page);
  const routes = page.locator(".learning-route");
  await expect(routes).toHaveCount(9);
  for (const group of await routes.all()) {
    await expect(group.getByRole("button")).toHaveCount(4);
  }
  await page
    .getByRole("group", { name: "Choose how to change the starting value" })
    .getByRole("button", { name: "Use API calls", exact: true })
    .click();
  await expect(routes.getByRole("button", { name: "Use API calls", pressed: true })).toHaveCount(9);
  for (const name of [
    "Run four values with API calls",
    "Change Start with an API call",
    "Build the relationship with API calls",
  ]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Run four values in Studio" })).toBeHidden();
  await page
    .getByRole("group", { name: "Choose how to create a draft" })
    .getByRole("button", { name: "Use the SDK", exact: true })
    .click();
  await expect(routes.getByRole("button", { name: "Use the SDK", pressed: true })).toHaveCount(9);
  for (const name of [
    "Run four values with the SDK",
    "Change Start in your code",
    "Build the relationship in your code",
  ]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("group", { name: "Tutorial API console" }).first()).toBeHidden();
  const install = page.locator(".follow-panel:visible").first().locator(".code-block").first();
  await install.getByRole("tab", { name: "Python", exact: true }).click();
  const draft = page
    .locator('section[aria-labelledby="create-draft"] .follow-panel:visible')
    .first();
  await expect(
    draft.locator("pre:visible").filter({ hasText: "sdk.connector_post" }),
  ).toContainText('"2": {"start_point": 60, "transformation_shift": 0}');
  await expect(draft.locator("pre:visible").filter({ hasText: "python draft.py" })).toBeVisible();
  await install.getByRole("tab", { name: "JavaScript", exact: true }).click();
  await expect(draft.locator("pre:visible").filter({ hasText: "sdk.connectorPost" })).toBeVisible();
  await expect(draft.locator("pre:visible").filter({ hasText: "node draft.mjs" })).toBeVisible();
  await page
    .getByRole("group", { name: "Choose how to publish a contribution" })
    .getByRole("button", { name: "Use Studio", exact: true })
    .click();
  await expect(routes.getByRole("button", { name: "Use Studio", pressed: true })).toHaveCount(9);
  await expect(page.getByRole("heading", { name: "Run four values in Studio" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Build your World" })).toHaveAttribute(
    "href",
    "/sdk#worlds",
  );
});

test("the embedded console only sends selected public tutorial requests and displays their results", async ({
  page,
}) => {
  const requests: { path: string; body: unknown; authorization: string | undefined }[] = [];
  await page.route("https://api.decentralised.art/chain/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const body = request.method() === "POST" ? request.postDataJSON() : null;
    requests.push({ path, body, authorization: request.headers().authorization });
    await route.fulfill({
      json:
        body === null
          ? { name: "pitch", dimensions: [{ transformations: [{ name: "add", args: [1] }] }] }
          : {
              block_number: 123,
              block_hash: "0xexample",
              particles: [
                {
                  path: "/pitch:0",
                  data: [0, 1, 2, 3].map((n) => n + body.dynamic_ri["0"].start_point),
                },
              ],
            },
    });
  });
  await openTutorial(page);
  await page.getByRole("button", { name: "Use API calls", exact: true }).first().click();
  expect(requests).toEqual([]);
  const first = page.getByRole("group", { name: "Tutorial API console", exact: true }).first();
  const commandField = first.getByRole("textbox", { name: "Selected curl command" });
  const colors = [];
  for (const theme of ["dark", "light"]) {
    await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
    colors.push(
      await commandField.evaluate((field) => {
        const style = getComputedStyle(field);
        return { foreground: style.color, background: style.backgroundColor };
      }),
    );
  }
  expect(colors[1]).toEqual(colors[0]);
  await expect(first.getByRole("textbox", { name: "Selected curl command" })).toHaveAttribute(
    "readonly",
    "",
  );
  await first.getByRole("button", { name: "Run request" }).click();
  await expect(first.getByRole("textbox", { name: "API response" })).toHaveValue(/"name": "pitch"/);
  await first.getByRole("button", { name: "Run four values", exact: true }).click();
  await first.getByRole("button", { name: "Run request" }).click();
  await expect(first.getByRole("status")).toContainText("Result matches: 0, 1, 2, 3");
  const starting = page
    .locator('section[aria-labelledby="palettes"]')
    .getByRole("group", { name: "Tutorial API console", exact: true });
  await starting.getByRole("button", { name: "Run request" }).click();
  await expect(starting.getByRole("status")).toContainText("Result matches: 10, 11, 12, 13");
  expect(requests).toEqual([
    { path: "/chain/connector/pitch", body: null, authorization: undefined },
    ...[0, 10].map((start) => ({
      path: "/chain/execute",
      body: {
        connector_name: "pitch",
        particles_count: 4,
        dynamic_ri: { "0": { start_point: start, transformation_shift: 0 } },
      },
      authorization: undefined,
    })),
  ]);
});

test("the console shows API errors and can retry without claiming success", async ({ page }) => {
  let attempts = 0;
  await page.route("https://api.decentralised.art/chain/execute", (route) => {
    attempts++;
    return route.fulfill({
      status: attempts === 1 ? 503 : 200,
      json:
        attempts === 1
          ? { message: "Chain endpoint unavailable" }
          : { particles: [{ path: "/pitch:0", data: [0, 1, 2, 3] }] },
    });
  });
  await openTutorial(page);
  await page.getByRole("button", { name: "Use API calls", exact: true }).first().click();
  const console = page.getByRole("group", { name: "Tutorial API console", exact: true }).first();
  await console.getByRole("button", { name: "Run four values", exact: true }).click();
  await console.getByRole("button", { name: "Run request" }).click();
  await expect(console.getByRole("status")).toHaveText(/HTTP 503.*Request failed/);
  await expect(console.getByRole("textbox", { name: "API response" })).toHaveValue(
    /Chain endpoint unavailable/,
  );
  await console.getByRole("button", { name: "Run request" }).click();
  await expect(console.getByRole("status")).toContainText("Result matches: 0, 1, 2, 3");
});

for (const example of examples) {
  test(`${example.name} selections connect indexes, palette values and the World’s interpretation`, async ({
    page,
  }) => {
    await openTutorial(page);
    const palette = page.locator(".palette-diagram");
    await palette.getByRole("tab", { name: example.name, exact: true }).click();
    const panel = palette.getByRole("tabpanel", { name: example.name, exact: true });
    const variants = panel.getByRole("group", { name: "Selection variation" });
    for (const variant of example.variants) {
      const button = variants.getByRole("button", { name: variant.name, exact: true });
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(variants.getByRole("button", { pressed: true })).toHaveCount(1);
      const description = `${example.name}: indexes ${variant.indexes.join(", ")} select the same numbered values from ${example.connector}, a sequence starting at zero and adding one. The World interprets them as ${variant.meanings.join(", ")}.`;
      await expect(panel.getByRole("img", { name: description, exact: true })).toBeVisible();
      const last = variant.indexes[3];
      await panel.getByRole("button", { name: `Inspect index ${last}`, exact: true }).click();
      await expect(panel.locator("output")).toHaveText(
        `Index ${last} → ${example.connector} value ${last} → ${variant.meanings[3]}`,
      );
      await expect(palette.getByRole("button", { name: "Pause", exact: true })).toBeDisabled();
    }
  });
}

test("autoplay advances indexes, variations and Worlds; manual selection pauses it and Start resumes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 400 });
  await page.clock.install({ time: new Date("2026-10-06T08:00:00Z") });
  await openTutorial(page);
  await expect(
    page.locator(".palette-diagram").getByRole("button", { name: "Pause", exact: true }),
  ).toBeEnabled();
  await page.clock.pauseAt(new Date("2026-10-06T09:00:00Z"));
  const palette = page.locator(".palette-diagram");
  await palette.scrollIntoViewIfNeeded();
  await palette.evaluate(
    (figure) =>
      new Promise<void>((resolve) => {
        const observer = new IntersectionObserver(([entry]) => {
          if (!entry.isIntersecting) return;
          observer.disconnect();
          resolve();
        });
        observer.observe(figure);
      }),
  );
  await page.clock.runFor(100);
  await expect(palette.getByRole("tab", { name: "Music", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(palette.getByRole("button", { name: "Whole tones +2" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.clock.runFor(1500);
  await expect(palette.locator("output")).toHaveText("Index 62 → pitch value 62 → D4");
  await page.clock.runFor(4200);
  await expect(palette.getByRole("button", { name: "Octaves +12" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.clock.runFor(5600);
  await expect(palette.getByRole("button", { name: "Semitones +1" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.clock.runFor(5600);
  await expect(palette.getByRole("tab", { name: "Graphics", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await palette.getByRole("tab", { name: "Game", exact: true }).click();
  await palette.getByRole("button", { name: "Combo +3" }).click();
  await palette.getByRole("button", { name: "Inspect index 6", exact: true }).click();
  await expect(palette.locator("output")).toHaveText("Index 6 → pose value 6 → Turn");
  await expect(palette.getByRole("button", { name: "Pause", exact: true })).toBeDisabled();
  await page.clock.runFor(20_000);
  await expect(palette.locator("output")).toHaveText("Index 6 → pose value 6 → Turn");
  await palette.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.runFor(1500);
  await expect(palette.locator("output")).toHaveText("Index 9 → pose value 9 → Jump");
  await expect(palette.getByRole("button", { name: "Pause", exact: true })).toBeEnabled();
});

test("reduced motion leaves the palette paused until the reader starts it", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-06T08:00:00Z") });
  await openTutorial(page);
  const palette = page.locator(".palette-diagram");
  await expect(palette.getByRole("button", { name: "Pause", exact: true })).toBeDisabled();
  await expect(palette.getByRole("button", { name: "Start", exact: true })).toBeEnabled();
  await palette.scrollIntoViewIfNeeded();
  await page.clock.pauseAt(new Date("2026-10-06T09:00:00Z"));
  await page.clock.runFor(20_000);
  await expect(palette.locator("output")).toHaveText("Index 60 → pitch value 60 → C4");
  await expect(palette.locator("output")).toHaveAttribute("aria-live", "polite");
});

test("running instances change the first value and cyclic order, and fixing a pair disables both", async ({
  page,
}) => {
  await openTutorial(page);
  const workbench = page.locator(".ri-workbench");
  const start = workbench.getByRole("slider", { name: /^Starting value/ });
  const firstOne = workbench.getByRole("button", { name: "Start the cycle with +1" });
  const firstThree = workbench.getByRole("button", { name: "Start the cycle with +3" });
  const lock = workbench.getByRole("button", { name: "Preview creator-fixed running instance" });
  const output = workbench.locator(".sequence-output");
  await expect(output).toHaveText("Output 0 → 1 → 4 → 5 → 8 → 9");
  await start.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(output).toHaveText("Output 2 → 3 → 6 → 7 → 10 → 11");
  await firstThree.click();
  await expect(output).toHaveText("Output 2 → 5 → 6 → 9 → 10 → 13");
  await lock.click();
  await expect(start).toBeDisabled();
  await expect(firstOne).toBeDisabled();
  await expect(firstThree).toBeDisabled();
  await expect(workbench.getByRole("status").filter({ hasText: "fixed together" })).toBeVisible();
  await expect(output).toHaveText("Output 2 → 5 → 6 → 9 → 10 → 13");
  await lock.click();
  await expect(start).toBeEnabled();
  await expect(firstOne).toBeEnabled();
  await expect(firstThree).toBeEnabled();
});

test("musical and painting examples combine streams by object and change only the selected property", async ({
  page,
}) => {
  await openTutorial(page);
  const art = page.getByRole("figure", {
    name: "Several streams describe each note or brush mark",
  });
  await expect(art.locator("tbody tr")).toHaveCount(4);
  await expect(art.locator("output")).toContainText("C4 · beat 0 · 1 beat long · strength 80");
  await art.getByRole("button", { name: "Note 2", exact: true }).click();
  const pitch = art.locator("ellipse.note").nth(1);
  const before = await pitch.getAttribute("cy");
  await art.getByRole("slider", { name: "Duration (beats)" }).press("End");
  await expect(art.locator("output")).toContainText("D4 · beat 1 · 4 beats long · strength 96");
  await expect(pitch).toHaveAttribute("cy", before!);
  await art.getByRole("slider", { name: "Pitch (MIDI number)" }).press("End");
  await expect(art.locator("output")).toContainText("C5 · beat 1 · 4 beats long · strength 96");
  await art.getByRole("tab", { name: "Painting · RGB" }).click();
  await expect(art.locator("tbody tr")).toHaveCount(3);
  await expect(art.locator("output")).toHaveText("Mark 2: red 62 + green 120 + blue 180");
  await art.getByRole("slider", { name: "Red" }).press("End");
  await expect(art.locator("output")).toHaveText("Mark 2: red 255 + green 120 + blue 180");
  await expect(art.locator("path.chosen")).toHaveAttribute("fill", "rgb(255,120,180)");
  await art.getByRole("button", { name: "Mark 1", exact: true }).click();
  await expect(art.locator("output")).toHaveText("Mark 1: red 60 + green 80 + blue 200");
});

test("the opening and real starting-value exercise are wallet-free and offer optional guides", async ({
  page,
}) => {
  await openTutorial(page);
  await expect(page.locator("[data-markdown-root]")).not.toContainText("shelf of materials");
  await expect(page.locator("[data-markdown-root]")).not.toContainText("know music");
  await expect(
    page.getByRole("link", { name: "Try the guided Studio walkthrough" }),
  ).toHaveAttribute("href", "/studio?network_kind=connector&network_id=pitch&lesson=first-run");
  await expect(
    page.getByRole("link", { name: "Change the starting value in Studio" }),
  ).toHaveAttribute(
    "href",
    "/studio?network_kind=connector&network_id=pitch&lesson=starting-value",
  );
  await expect(page.locator(".palette-diagram .example-tabs").getByRole("tab")).toHaveCount(3);
  await expect(
    page.locator(".palette-diagram .example-tabs").getByRole("tab", { name: "Movement" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Use an AI agent" }).first().click();
  await expect(page.getByRole("button", { name: "Copy starting-value prompt" })).toBeVisible();
});

test("the integration comparison distinguishes hosted read/run actions from standalone authoring", async ({
  page,
}) => {
  await openTutorial(page);
  const integration = page.getByRole("figure", { name: "Two ways to integrate a World editor" });
  const capabilities = integration.getByRole("list", {
    name: "Actions available through this integration",
  });
  await expect(capabilities.getByText("Available", { exact: true })).toHaveCount(4);
  await integration.getByRole("button", { name: "Hosted World" }).click();
  for (const action of ["Create drafts", "Publish"]) {
    await expect(capabilities.getByRole("listitem").filter({ hasText: action })).toContainText(
      "Needs extension",
    );
  }
  for (const action of ["Simulate", "Execute"]) {
    await expect(capabilities.getByRole("listitem").filter({ hasText: action })).toContainText(
      "Available",
    );
  }
  await expect(integration.locator("output")).toContainText(
    "extended host bridge and trusted signing",
  );
  await integration.getByRole("button", { name: "Standalone app" }).click();
  await expect(capabilities.getByText("Available", { exact: true })).toHaveCount(4);
  await expect(integration.locator("output")).toContainText("full SDK and a signing account");
});

test("the condition preview explains both accepted and rejected execution", async ({ page }) => {
  await openTutorial(page);
  const condition = page.getByRole("figure", { name: "A condition gates an execution request" });
  const passes = condition.getByRole("button", { name: "Preview pass" });
  const fails = condition.getByRole("button", { name: "Preview fail" });
  const result = condition.getByRole("status");
  await fails.click();
  await expect(fails).toHaveAttribute("aria-pressed", "true");
  await expect(passes).toHaveAttribute("aria-pressed", "false");
  await expect(result).toHaveText("Preview: the check fails, so this request is rejected.");
  await passes.click();
  await expect(result).toHaveText("Preview: the check passes, so this request returns output.");
});

test("each diagram preserves its own foreground palette in both site themes", async ({ page }) => {
  await openTutorial(page);
  const selectors = [
    ".palette-diagram .diagram-title",
    ".palette-diagram .diagram-intro",
    ".palette-diagram .diagram-note",
    ".ri-workbench .workbench-title",
    ".ri-workbench .control-heading",
    ".ri-workbench .cycle-note",
    ".interpretation-artboard .intro strong",
    ".interpretation-artboard .world-contract strong",
    ".interpretation-artboard .reading",
    ".editor-blueprint .intro strong",
    ".editor-blueprint .cap-name",
    ".editor-blueprint .station-copy",
    ".lifecycle h3",
    ".lifecycle .step-label",
    ".lifecycle .step-text",
    ".conditions .node-title",
    ".conditions .outcome-label",
    ".conditions .node-detail",
    ".conditions .example-intro",
    ".conditions .address span:not(.avatar)",
    ".conditions .avatar",
    ".conditions .amount",
    ".conditions .transfer-state",
    ".economy-artboard figcaption > strong",
    ".economy-artboard .fee-note",
    ".economy-artboard .material-label",
    ".network-card h3",
    ".network-card dd",
    ".network-comparison .network-label",
  ];
  for (const selector of selectors) await expect(page.locator(selector).first()).toBeVisible();
  const foregroundColors = () =>
    Promise.all(
      selectors.map(async (selector) => ({
        selector,
        color: await page
          .locator(selector)
          .first()
          .evaluate((element) => window.getComputedStyle(element).color),
      })),
    );
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  const darkColors = await foregroundColors();
  await page.evaluate(() => (document.documentElement.dataset.theme = "light"));
  expect(await foregroundColors()).toEqual(darkColors);
  const condition = page.getByRole("figure", { name: "A condition gates an execution request" });
  await condition.getByRole("tab", { name: "Non-financial", exact: true }).click();
  const calculationIntro = condition.locator(".example-intro");
  await expect(calculationIntro).toContainText("A condition can also be a calculation");
  const foreground = () => calculationIntro.evaluate((element) => getComputedStyle(element).color);
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  const darkForeground = await foreground();
  expect(darkForeground).toBe("rgb(248, 237, 223)");
  await page.evaluate(() => (document.documentElement.dataset.theme = "light"));
  expect(await foreground()).toEqual(darkForeground);
});

for (const width of [390, 1440]) {
  test(`all example Worlds and diagram controls fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openTutorial(page);
    const palette = page.locator(".palette-diagram");
    for (const example of examples) {
      await palette.getByRole("tab", { name: example.name, exact: true }).click();
      await palette.getByRole("button", { name: example.variants[2].name, exact: true }).click();
      await expect(
        palette.getByRole("tabpanel", { name: example.name }).getByRole("img"),
      ).toBeVisible();
      await assertNoHorizontalOverflow(page);
    }
    const drawing = page.getByRole("figure", {
      name: "Several streams describe each note or brush mark",
    });
    await drawing.getByRole("slider", { name: "Duration (beats)" }).press("End");
    await drawing.getByRole("tab", { name: "Painting · RGB" }).click();
    await drawing.getByRole("slider", { name: "Red" }).press("End");
    await assertNoHorizontalOverflow(page);
    const integration = page.getByRole("figure", { name: "Two ways to integrate a World editor" });
    for (const route of ["Hosted World", "Standalone app"]) {
      await integration.getByRole("button", { name: route }).click();
      await assertNoHorizontalOverflow(page);
    }
    await page.getByRole("button", { name: "Preview fail" }).click();
    await assertNoHorizontalOverflow(page);
    for (const route of ["Use API calls", "Use the SDK"]) {
      await page.getByRole("button", { name: route, exact: true }).first().click();
      await assertNoHorizontalOverflow(page);
    }
  });
}

test("published condition examples stay within a mobile viewport when every code disclosure is open", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    Object.assign(window, { ethereum: undefined });
  });
  const apiRequests: string[] = [];
  await page.route(/^https?:\/\/[^/]+\/chain\//, async (route) => {
    apiRequests.push(route.request().url());
    await route.fulfill({ status: 403, json: { message: "Layout inspection only" } });
  });
  await openTutorial(page);
  const section = page.locator('section[aria-labelledby="conditions"]');
  const routeTabs = section.getByRole("group", { name: "Choose how to explore conditions" });
  for (const theme of ["dark", "light"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    }, theme);
    for (const route of ["Use Studio", "Use an AI agent", "Use API calls", "Use the SDK"]) {
      await routeTabs.getByRole("button", { name: route, exact: true }).click();
      const panel = section.locator(".follow-panel:not([hidden])");
      const disclosures = panel.locator("details");
      for (const disclosure of await disclosures.all()) {
        if ((await disclosure.getAttribute("open")) !== null)
          await disclosure.locator(":scope > summary").click();
      }
      await assertNoHorizontalOverflow(page);
      for (const disclosure of await disclosures.all()) {
        await disclosure.locator(":scope > summary").click();
        await expect(disclosure).toHaveAttribute("open", "");
        await assertNoHorizontalOverflow(page);
      }
      if (route === "Use API calls") {
        const console = panel.getByRole("group", { name: "Tutorial API console" });
        for (const command of await console
          .getByRole("group", { name: "Tutorial commands" })
          .getByRole("button")
          .all()) {
          await command.click();
          await expect(command).toHaveAttribute("aria-pressed", "true");
          await assertNoHorizontalOverflow(page);
        }
      }
      if (route === "Use the SDK") {
        for (const language of ["Python", "JavaScript"]) {
          await panel.getByRole("tab", { name: language, exact: true }).click();
          await assertNoHorizontalOverflow(page);
        }
      }
      for (const control of await panel.locator("button:visible, a:visible").all()) {
        await expect(control).toBeVisible();
        const bounds = await control.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
      }
      for (const pre of await panel.locator("pre:visible").all())
        await expect(pre).toHaveCSS("overflow-x", "auto");
    }
  }
  expect(apiRequests).toEqual([]);
});

test("the four paths and concrete exercises continue through every later section", async ({
  page,
}) => {
  await openTutorial(page);
  const groups = [
    "Choose how to check a World’s inputs",
    "Choose how to publish a contribution",
    "Choose how to prototype a World",
    "Choose how to explore conditions",
  ];
  const paths = [
    {
      button: "Use Studio",
      headings: [
        "Inspect what your connector supplies",
        "Publish with your wallet",
        "Use Studio to make the World’s material",
        "See a real condition in Studio",
      ],
    },
    {
      button: "Use an AI agent",
      headings: [
        "Ask your agent to check compatibility",
        "Review the publication with your agent",
        "Make a small prototype with your agent",
        "Ask your agent to compare both outcomes",
      ],
    },
    {
      button: "Use API calls",
      headings: [
        "Read the format with API calls",
        "Prepare, sign, send, then check",
        "Turn an API result into a picture",
        "Try the allowed and blocked requests here",
      ],
    },
    {
      button: "Use the SDK",
      headings: [
        "Read the format in your code",
        "Publish your saved name from code",
        "Make a working local prototype",
        "Compare the published examples in your code",
      ],
    },
  ];
  for (const [i, path] of paths.entries()) {
    await page
      .getByRole("group", { name: groups[i] })
      .getByRole("button", { name: path.button, exact: true })
      .click();
    await expect(
      page.locator(".learning-route").getByRole("button", { name: path.button, pressed: true }),
    ).toHaveCount(9);
    for (const name of path.headings)
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  await page
    .getByRole("group", { name: groups[0] })
    .getByRole("button", { name: "Use Studio" })
    .click();
  for (const lesson of [
    "draft",
    "selection",
    "formats",
    "publish",
    "conditions",
    "custom-elements",
  ]) {
    const preview = page
      .locator(".studio-guide-preview")
      .filter({ has: page.locator(`a[href*="lesson=${lesson}"]`) });
    await preview.locator("img").scrollIntoViewIfNeeded();
    await expect(preview.locator("img")).toBeVisible();
    await expect
      .poll(() => preview.locator("img").evaluate((img) => (img as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
  }
});

test("custom Solidity exercises stay synchronized with every learning route", async ({ page }) => {
  await openTutorial(page);
  const section = page.locator('section[aria-labelledby="custom-elements"]');
  const routes = section.getByRole("group", { name: "Choose how to create custom elements" });
  const paths = [
    ["Use Studio", "Create and try both elements in Studio"],
    ["Use an AI agent", "Build and check the example with your agent"],
    ["Use API calls", "Create local elements with API calls"],
    ["Use the SDK", "Create and test the elements in your code"],
  ];
  for (const [button, heading] of paths) {
    await routes.getByRole("button", { name: button, exact: true }).click();
    await expect(section.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(
      page.locator(".learning-route").getByRole("button", { name: button, pressed: true }),
    ).toHaveCount(9);
  }
  await section.getByRole("tab", { name: "Python", exact: true }).click();
  await expect(
    section.locator("pre:visible").filter({ hasText: "sdk.condition_post" }),
  ).toContainText("[(allowed, 12), (blocked, 8)]");
  await routes.getByRole("button", { name: "Use Studio", exact: true }).click();
  await expect(
    section.getByRole("link", { name: "Create custom elements in Studio ↗" }),
  ).toHaveAttribute("href", "/studio?lesson=custom-elements");
});

test("algorithmic conditions check fixed arguments and reject the whole request", async ({
  page,
}) => {
  await openTutorial(page);
  const condition = page.getByRole("figure", { name: "A condition gates an execution request" });
  await condition.getByRole("tab", { name: "Non-financial", exact: true }).click();
  await expect(condition.getByRole("status")).toContainText("check passes");
  await condition.getByRole("button", { name: "Preview fail" }).click();
  await expect(condition.getByRole("status")).toContainText("request is rejected");
  await condition.getByRole("button", { name: "Preview pass" }).click();
  await expect(condition.getByRole("status")).toContainText("returns output");
  await expect(page.locator('section[aria-labelledby="conditions"]')).toContainText(
    "Solidity does not fetch an API directly",
  );
});

test("economy choices distinguish creator payments, read access and publication gas", async ({
  page,
}) => {
  await openTutorial(page);
  const economy = page.getByRole("figure", {
    name: "Connector creators choose conditions; World creators choose which outputs to use",
  });
  await expect(economy.getByRole("status")).toContainText("no blockchain gas fee");
  await economy.getByRole("button", { name: "Require a recorded payment" }).click();
  await expect(economy.getByRole("status")).toContainText("payment is a separate transaction");
  await expect(economy.getByRole("status")).toContainText(
    "sender pays the required amount and gas",
  );
  await expect(economy).toContainText("Once it is recorded, anyone can run the connector");
  await expect(economy).toContainText("Its creator chooses the connectors and formats it supports");
  await economy.getByRole("button", { name: "Open to everyone" }).click();
  await expect(economy).toContainText("This connector has no condition");
  await expect(economy).toContainText("that connector’s conditions still apply");
  const fees = page.getByRole("table", {
    name: "Blockchain fees for the workflow in this tutorial",
  });
  await expect(fees.getByRole("row")).toHaveCount(7);
  await expect(fees.getByRole("row").filter({ hasText: "Execute on the Network" })).toContainText(
    "without sending a transaction",
  );
  await expect(fees.getByRole("row").filter({ hasText: "Publish a transformation" })).toContainText(
    "publishing account pays gas",
  );
  await expect(page.getByRole("group", { name: "Sepolia and Mainnet comparison" })).toContainText(
    "11155111",
  );
  await expect(page.locator('section[aria-labelledby="networks"]')).toContainText(
    "do not automatically move to Mainnet",
  );
});

test("format and condition consoles send only selected public requests without credentials", async ({
  page,
  context,
}) => {
  const requests: {
    url: string;
    method: string;
    body: unknown;
    authorization?: string;
    cookie?: string;
  }[] = [];
  await context.addCookies([
    {
      name: "tutorial_private_cookie",
      value: "must_not_be_sent",
      url: "https://api.decentralised.art",
      sameSite: "None",
      secure: true,
    },
  ]);
  await page.route("https://api.decentralised.art/chain/**", async (route) => {
    const req = route.request();
    const headers = await req.allHeaders();
    const body = req.method() === "POST" ? req.postDataJSON() : null;
    requests.push({
      url: req.url(),
      method: req.method(),
      body,
      authorization: headers.authorization,
      cookie: headers.cookie,
    });
    if (body === null) {
      await route.fulfill({ json: { items: [] } });
    } else if (body.connector_name.includes("_fail_")) {
      await route.fulfill({
        status: 400,
        json: { message: "Execution rejected: Condition not met" },
      });
    } else {
      await route.fulfill({
        json: {
          block_number: 123,
          block_hash: "0xexample",
          particles: [{ path: "/example:0/pitch:0", data: [60, 62, 64, 66] }],
        },
      });
    }
  });
  await openTutorial(page);
  expect(requests).toEqual([]);
  await page.getByRole("button", { name: "Use API calls", exact: true }).first().click();
  expect(requests).toEqual([]);
  const formats = page
    .locator('section[aria-labelledby="formats"]')
    .getByRole("group", { name: "Tutorial API console" });
  await formats.getByRole("button", { name: "List known formats" }).click();
  expect(requests).toEqual([]);
  await formats.getByRole("button", { name: "Run request" }).click();
  await expect(formats.getByRole("status")).toHaveText("HTTP 200");
  const conditions = page
    .locator('section[aria-labelledby="conditions"]')
    .getByRole("group", { name: "Tutorial API console" });
  const commands = conditions.getByRole("group", { name: "Tutorial commands" });
  await expect(commands.getByRole("button")).toHaveCount(4);
  await expect(conditions.getByRole("textbox", { name: "Selected curl command" })).toHaveAttribute(
    "readonly",
    "",
  );
  const examples = [
    { label: "Threshold · allowed", name: "tutorial_threshold_pass_v1", blocked: false },
    { label: "Threshold · blocked", name: "tutorial_threshold_fail_v1", blocked: true },
    { label: "Divisibility · allowed", name: "tutorial_divisible_pass_v1", blocked: false },
    { label: "Divisibility · blocked", name: "tutorial_divisible_fail_v1", blocked: true },
  ];
  for (const example of examples) {
    await commands.getByRole("button", { name: example.label, exact: true }).click();
    await expect(conditions.getByRole("textbox", { name: "Selected curl command" })).toHaveValue(
      new RegExp(example.name),
    );
  }
  expect(requests).toHaveLength(1);
  for (const [i, example] of examples.entries()) {
    await commands.getByRole("button", { name: example.label, exact: true }).click();
    expect(requests).toHaveLength(i + 1);
    await conditions.getByRole("button", { name: "Run request" }).click();
    await expect(conditions.getByRole("status")).toHaveText(
      example.blocked
        ? "HTTP 400 · Expected result: the condition blocked this run."
        : "HTTP 200 · Result matches: 60, 62, 64, 66",
    );
    await expect(conditions.locator(".result-entry").last()).not.toHaveClass(/failed/);
    if (example.blocked) {
      await expect(conditions.getByRole("textbox", { name: "API response" }).last()).toHaveValue(
        /Execution rejected: Condition not met/,
      );
    }
  }
  expect(requests).toEqual([
    {
      url: "https://api.decentralised.art/chain/formats?limit=10",
      method: "GET",
      body: null,
      authorization: undefined,
      cookie: undefined,
    },
    ...examples.map((example) => ({
      url: "https://api.decentralised.art/chain/execute",
      method: "POST",
      body: { connector_name: example.name, particles_count: 4, dynamic_ri: {} },
      authorization: undefined,
      cookie: undefined,
    })),
  ]);
});

for (const failure of [
  {
    name: "an unavailable server",
    status: 503,
    body: { message: "Execution rejected: Condition not met" },
    expected: "HTTP 503 · A different error occurred. Read the response below.",
  },
  {
    name: "an unrelated HTTP 400 error",
    status: 400,
    body: { message: "Connector not found" },
    expected: "HTTP 400 · A different error occurred. Read the response below.",
  },
  {
    name: "a blocked connector unexpectedly returning values",
    status: 200,
    body: {
      block_number: 123,
      block_hash: "0xexample",
      particles: [{ path: "/example:0/pitch:0", data: [60, 62, 64, 66] }],
    },
    expected: "HTTP 200 · Unexpected result: this condition should block the run.",
  },
]) {
  test(`the condition console does not mistake ${failure.name} for a successful condition test`, async ({
    page,
  }) => {
    const requests: unknown[] = [];
    await page.route("https://api.decentralised.art/chain/**", async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({ status: failure.status, json: failure.body });
    });
    await openTutorial(page);
    await page.getByRole("button", { name: "Use API calls", exact: true }).first().click();
    const conditions = page
      .locator('section[aria-labelledby="conditions"]')
      .getByRole("group", { name: "Tutorial API console" });
    await conditions.getByRole("button", { name: "Threshold · blocked", exact: true }).click();
    expect(requests).toEqual([]);
    await conditions.getByRole("button", { name: "Run request" }).click();
    await expect(conditions.getByRole("status")).toHaveText(failure.expected);
    await expect(conditions.locator(".result-entry").last()).toHaveClass(/failed/);
    await expect(conditions.getByRole("textbox", { name: "API response" })).toHaveValue(
      JSON.stringify(failure.body, null, 2),
    );
    expect(requests).toEqual([
      { connector_name: "tutorial_threshold_fail_v1", particles_count: 4, dynamic_ri: {} },
    ]);
  });
}
