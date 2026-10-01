import { expect, test, type Locator, type Page } from "@playwright/test";

const fixtureAddress = "0xb584a15f38c2014cff54fdb1b417428b51999276";
const fixtureFollowerAddress = "0xfa71ff2394596f824d69961293d095a50d322e4e";

type Rgba = {
  r: number;
  g: number;
  b: number;
  a: number;
};

const stubStudioApis = async (page: Page) => {
  const themeUser = {
    id: "theme-user",
    email: "theme-user@example.test",
    display_name: "Theme User",
    ethereum_address: fixtureAddress,
    profile_json: {
      public: {
        nickname: "Theme User",
        ethereum_address: fixtureAddress,
        toolbox: [],
        toolbox_library: {
          connector: [],
          transformation: [],
          condition: [],
        },
        social_preferences: {
          followed_user_addresses: [fixtureFollowerAddress],
          followed_format_hashes: [],
        },
      },
    },
  };
  const followerUser = {
    id: "theme-follower",
    email: "theme-follower@example.test",
    display_name: "Theme Follower",
    ethereum_address: fixtureFollowerAddress,
    profile_json: {
      public: {
        nickname: "Theme Follower",
        ethereum_address: fixtureFollowerAddress,
        toolbox: [],
        toolbox_library: {
          connector: [],
          transformation: [],
          condition: [],
        },
        social_preferences: {
          followed_user_addresses: [fixtureAddress],
          followed_format_hashes: [],
        },
      },
    },
  };

  await page.route("https://api.decentralised.art/**", async (route) => {
    const url = route.request().url();

    if (url.includes("/services/auth/me")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: themeUser,
        }),
      });
      return;
    }

    if (url.includes("/services/users/theme-user")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: themeUser }),
      });
      return;
    }

    if (url.includes("/services/users")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([themeUser, followerUser]),
      });
      return;
    }

    if (url.includes("/chain/feed/stream")) {
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
              feed_id: "feed-theme-connector",
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
                name: "theme_connector",
                owner: fixtureAddress,
              },
            },
          ],
        }),
      });
      return;
    }

    if (url.includes("/chain/connector/theme_connector")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          name: "theme_connector",
          owner: fixtureAddress,
          address: "0x0000000000000000000000000000000000000001",
          dimensions: [
            {
              transformations: [],
              bindings: {},
            },
          ],
          condition_name: "",
          condition_args: [],
          format_hash: "0x" + "1".repeat(64),
          created_at_ms: 1000,
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

const parseRgba = (value: string): Rgba => {
  if (value === "transparent") {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const srgbMatch = value.match(
    /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/,
  );
  if (srgbMatch) {
    return {
      r: Number(srgbMatch[1]) * 255,
      g: Number(srgbMatch[2]) * 255,
      b: Number(srgbMatch[3]) * 255,
      a: srgbMatch[4] === undefined ? 1 : Number(srgbMatch[4]),
    };
  }

  const oklabMatch = value.match(
    /^oklab\(([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)(?:\s*\/\s*([\d.]+))?\)$/,
  );
  if (oklabMatch) {
    const l = Number(oklabMatch[1]);
    const a = Number(oklabMatch[2]);
    const b = Number(oklabMatch[3]);
    const alpha = oklabMatch[4] === undefined ? 1 : Number(oklabMatch[4]);
    const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
    const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
    const sPrime = l - 0.0894841775 * a - 1.291485548 * b;
    const lCone = lPrime ** 3;
    const mCone = mPrime ** 3;
    const sCone = sPrime ** 3;
    const toSrgb = (channel: number) => {
      const clamped = Math.min(1, Math.max(0, channel));
      return (
        (clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055) * 255
      );
    };

    return {
      r: toSrgb(4.0767416621 * lCone - 3.3077115913 * mCone + 0.2309699292 * sCone),
      g: toSrgb(-1.2684380046 * lCone + 2.6097574011 * mCone - 0.3413193965 * sCone),
      b: toSrgb(-0.0041960863 * lCone - 0.7034186147 * mCone + 1.707614701 * sCone),
      a: alpha,
    };
  }

  const parts = value
    .replace(/^rgba?\(/, "")
    .replace(/\)$/, "")
    .split(",")
    .map((part) => Number(part.trim()));

  return {
    r: parts[0] ?? 0,
    g: parts[1] ?? 0,
    b: parts[2] ?? 0,
    a: parts[3] ?? 1,
  };
};

const blendOver = (fg: Rgba, bg: Rgba): Rgba => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
  a: 1,
});

const relativeLuminance = ({ r, g, b }: Rgba) => {
  const toLinear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

const contrastRatio = (a: Rgba, b: Rgba) => {
  const aLum = relativeLuminance(a);
  const bLum = relativeLuminance(b);
  const light = Math.max(aLum, bLum);
  const dark = Math.min(aLum, bLum);
  return (light + 0.05) / (dark + 0.05);
};

const elementColors = async (locator: Locator) =>
  locator.evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return {
      backgroundColor: styles.backgroundColor,
      color: styles.color,
    };
  });

test("theme toggle switches and persists light mode", async ({ page }) => {
  await page.goto("/studio");

  const html = page.locator("html");
  const toggle = page.getByRole("button", { name: "Switch to light theme" });

  await expect(html).toHaveAttribute("data-theme", "dark");
  await toggle.click();
  await expect(html).toHaveAttribute("data-theme", "light");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("button", { name: /Switch to (light|dark) theme/ })).toHaveCount(0);
});

test("light theme restyles the Studio flow canvas and node text", async ({ page }) => {
  await stubStudioApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/studio");
  await page.getByRole("button", { name: "Switch to light theme" }).click();

  const canvas = page.getByRole("application", { name: "Flow canvas" });
  const flowBackground = page.locator(".svelte-flow__background").first();
  const connectorNode = page.locator(".connector-node").first();
  const connectorTitle = connectorNode.locator(".connector-title").first();
  const syncChip = page.locator(".chain-status-chip").first();

  await expect(canvas).toBeVisible();
  await expect(flowBackground).toBeVisible();
  await expect(connectorNode).toBeVisible();
  await expect(syncChip).toBeVisible();

  const canvasColors = await elementColors(canvas);
  const flowColors = await elementColors(flowBackground);
  const nodeColors = await elementColors(connectorNode);
  const titleColors = await elementColors(connectorTitle);
  const syncChipColors = await elementColors(syncChip);

  expect(canvasColors.backgroundColor).not.toBe("rgb(0, 0, 0)");
  expect(flowColors.backgroundColor).not.toBe("rgb(0, 0, 0)");
  expect(titleColors.color).not.toBe("rgb(255, 255, 255)");
  expect(syncChipColors.backgroundColor).not.toBe("rgb(0, 0, 0)");

  const titleColor = parseRgba(titleColors.color);
  const canvasBg = parseRgba(canvasColors.backgroundColor);
  const nodeBg = blendOver(parseRgba(nodeColors.backgroundColor), canvasBg);
  const ratio = contrastRatio(titleColor, nodeBg);

  expect(
    ratio,
    JSON.stringify({ canvasColors, nodeColors, titleColors, titleColor, nodeBg }),
  ).toBeGreaterThanOrEqual(4.5);
});

test("light theme keeps Account content shells from adding a background band", async ({ page }) => {
  await stubStudioApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/account");
  await page.getByRole("button", { name: "Switch to light theme" }).click();

  const profileCardShell = page.locator(".account-page .profile-card-shell").first();
  const profilePageShell = page.locator(".account-page .profile-page-shell").first();
  const profileSectionShell = page.locator(".account-page .profile-page-shell > .section-shell");
  const feedCardShell = page.locator(".account-page .feed-card-shell").first();
  const feedCard = page.locator(".account-page .feed-card-shell .card-soft").first();

  await expect(profilePageShell).toBeVisible({ timeout: 15_000 });
  await expect(profileSectionShell).toBeVisible();
  await expect(feedCardShell).toBeVisible();
  await expect(feedCard).toBeVisible();

  const cardShellColors = await elementColors(profileCardShell);
  const pageShellColors = await elementColors(profilePageShell);
  const sectionShellColors = await elementColors(profileSectionShell);
  const feedCardShellColors = await elementColors(feedCardShell);
  const feedCardColors = await elementColors(feedCard);

  expect(cardShellColors.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(pageShellColors.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(sectionShellColors.backgroundColor).toBe(feedCardColors.backgroundColor);
  expect(feedCardShellColors.backgroundColor).toBe("rgba(0, 0, 0, 0)");
});

test("light theme keeps public profile social counters readable", async ({ page }) => {
  await stubStudioApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/u/theme-user");
  await page.getByRole("button", { name: "Switch to light theme" }).click();

  const counterPill = page.locator(".social-count-pill").first();
  const counterValue = page.locator(".social-count-value").first();
  const pageBody = page.locator("body");
  const profilePageShell = page.locator(".public-profile-stack .profile-page-shell").first();
  const profileSectionShell = page
    .locator(".public-profile-stack .profile-page-shell > .section-shell")
    .first();
  const feedCardShell = page.locator(".public-profile-stack .feed-card-shell").first();
  const feedCard = page.locator(".public-profile-stack .feed-card-shell .card-soft").first();

  await expect(counterValue).toHaveText("1", { timeout: 15_000 });
  await expect(profilePageShell).toBeVisible();
  await expect(profileSectionShell).toBeVisible();
  await expect(feedCardShell).toBeVisible();
  await expect(feedCard).toBeVisible();

  const pageColors = await elementColors(pageBody);
  const pageShellColors = await elementColors(profilePageShell);
  const sectionShellColors = await elementColors(profileSectionShell);
  const feedCardShellColors = await elementColors(feedCardShell);
  const feedCardColors = await elementColors(feedCard);
  const pillColors = await elementColors(counterPill);
  const valueColors = await elementColors(counterValue);
  const effectivePillBackground = blendOver(
    parseRgba(pillColors.backgroundColor),
    parseRgba(pageColors.backgroundColor),
  );

  expect(pageShellColors.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(sectionShellColors.backgroundColor).toBe(feedCardColors.backgroundColor);
  expect(feedCardShellColors.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(valueColors.color).not.toBe("rgb(255, 255, 255)");
  expect(
    contrastRatio(parseRgba(valueColors.color), effectivePillBackground),
    JSON.stringify({ pageColors, pillColors, valueColors }),
  ).toBeGreaterThanOrEqual(4.5);
});

test("light theme restyles connector page metadata and related feed shell", async ({ page }) => {
  await stubStudioApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/c/theme_connector");
  await page.getByRole("button", { name: "Switch to light theme" }).click();

  const overview = page.locator(".connector-overview").first();
  const authorLink = page.locator(".connector-author-link").first();
  const formatLink = page.locator(".connector-format-link").first();
  const relatedFeedShell = page.locator(".connector-feed-shell").first();

  await expect(overview).toBeVisible({ timeout: 15_000 });
  await expect(authorLink).toBeVisible();
  await expect(formatLink).toBeVisible();
  await expect(relatedFeedShell).toBeVisible();

  const overviewColors = await elementColors(overview);
  const authorColors = await elementColors(authorLink);
  const formatColors = await elementColors(formatLink);
  const feedShellColors = await elementColors(relatedFeedShell);

  expect(authorColors.color).not.toBe("rgb(255, 255, 255)");
  expect(formatColors.color).not.toBe("rgb(255, 255, 255)");
  expect(feedShellColors.backgroundColor).toBe("rgba(0, 0, 0, 0)");

  expect(
    contrastRatio(parseRgba(authorColors.color), parseRgba(overviewColors.backgroundColor)),
    JSON.stringify({ overviewColors, authorColors }),
  ).toBeGreaterThanOrEqual(4.5);
  expect(
    contrastRatio(parseRgba(formatColors.color), parseRgba(overviewColors.backgroundColor)),
    JSON.stringify({ overviewColors, formatColors }),
  ).toBeGreaterThanOrEqual(4.5);
});
