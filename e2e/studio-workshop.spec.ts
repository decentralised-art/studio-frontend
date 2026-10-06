import { expect, test, type Page } from "@playwright/test";

const owner = `0x${"12".repeat(20)}`;
const address = `0x${"ab".repeat(20)}`;
const hash = `0x${"cd".repeat(32)}`;
type Entity = {
  name: string;
  owner: string;
  address: string;
  dimensions?: unknown[];
  static_ri?: Record<string, unknown>;
  args_count?: number;
  condition_name?: string;
  condition_args?: number[];
  kind?: "connector" | "transformation" | "condition";
};

async function setup(page: Page, lesson: string, signedIn = false, saved = false) {
  const entities: Record<string, Entity> = {
    pitch: {
      name: "pitch",
      owner,
      address,
      dimensions: [{ transformations: [{ name: "add", args: [1] }] }],
    },
    add: { name: "add", owner, address, args_count: 1 },
  };
  if (lesson === "conditions") {
    entities.tutorial_threshold_v1 = {
      name: "tutorial_threshold_v1",
      owner,
      address,
      args_count: 2,
      kind: "condition",
    };
    entities.tutorial_threshold_pass_v1 = {
      name: "tutorial_threshold_pass_v1",
      owner,
      address,
      dimensions: [{ composite: "pitch", transformations: [{ name: "add", args: [2] }] }],
      condition_name: "tutorial_threshold_v1",
      condition_args: [12, 10],
      static_ri: { "2": { start_point: 60, transformation_shift: 0 } },
    };
  }
  if (saved)
    entities.tutorial_saved = {
      name: "tutorial_saved",
      owner,
      address: "0x0",
      dimensions: [{ composite: "pitch", transformations: [{ name: "add", args: [2] }] }],
      static_ri: { "2": { start_point: 60, transformation_shift: 0 } },
    };
  const creates: Record<string, unknown>[] = [];
  const sources: Record<string, string> =
    lesson === "conditions" ? { tutorial_threshold_v1: "return args[0] >= args[1];" } : {};
  const publications: string[] = [];
  const reads: Array<{ path: string; body: Record<string, unknown> }> = [];
  const protectedRequests: string[] = [];
  const errors: string[] = [];
  let wrong = false;
  let rejected = false;
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(
    ({ owner, signedIn, hash }) => {
      localStorage.clear();
      sessionStorage.clear();
      if (signedIn) {
        localStorage.setItem("hypermusic_token", "workshop-services");
        localStorage.setItem("hypermusic_chain_token", "workshop-chain");
        localStorage.setItem("hypermusic_chain_token_user_id", `wallet:${owner}`);
      }
      Object.assign(window, {
        walletSends: 0,
        ethereum: signedIn
          ? {
              request: async ({ method }: { method: string }) => {
                if (method === "eth_accounts" || method === "eth_requestAccounts") return [owner];
                if (method === "eth_chainId") return "0xaa36a7";
                if (method === "eth_sendTransaction") {
                  (window as unknown as { walletSends: number }).walletSends++;
                  return hash;
                }
                throw new Error("Unexpected wallet method " + method);
              },
            }
          : undefined,
      });
    },
    { owner, signedIn, hash },
  );
  await page.route(/.*\/(?:services|chain)\/.*/, async (route) => {
    const request = route.request();
    if (!["fetch", "xhr"].includes(request.resourceType())) return route.continue();
    const path = new URL(request.url()).pathname;
    if (
      lesson === "conditions" &&
      (path.includes("/auth/") ||
        path.includes("/nonce/") ||
        (!["GET", "HEAD"].includes(request.method()) &&
          !path.endsWith("/execute") &&
          !path.endsWith("/simulate")))
    ) {
      protectedRequests.push(`${request.method()} ${path}`);
      return route.fulfill({
        status: 403,
        json: { message: "This lesson only reads the network" },
      });
    }
    let body: unknown = [];
    let status = 200;
    if (path.endsWith("/auth/me") || path.includes("/services/users/"))
      body = { user: { id: owner, ethereum_address: owner, display_name: "Tutorial test user" } };
    else if (path.endsWith("/services/users")) body = [];
    else if (path.includes("/chain/account/"))
      body = {
        owned_connectors: Object.values(entities)
          .filter((e) => e.address === "0x0" && e.dimensions)
          .map((e) => e.name),
        owned_transformations: Object.values(entities)
          .filter((e) => e.address === "0x0" && e.kind === "transformation")
          .map((e) => e.name),
        owned_conditions: Object.values(entities)
          .filter((e) => e.address === "0x0" && e.kind === "condition")
          .map((e) => e.name),
      };
    else if (path.endsWith("/feed"))
      body = {
        limit: 100,
        cursor: { has_more: false },
        items: (lesson === "conditions"
          ? ["pitch", "add", "tutorial_threshold_v1", "tutorial_threshold_pass_v1"]
          : ["pitch", "add"]
        ).map((name, i) => ({
          feed_id: name,
          event_type:
            name === "add"
              ? "transformation_added"
              : entities[name].kind === "condition"
                ? "condition_added"
                : "connector_added",
          status: "safe",
          visible: true,
          tx_hash: hash,
          block_number: 1,
          tx_index: i,
          log_index: 0,
          history_cursor: `0000000000000001:000${i}:0000`,
          created_at_ms: 1,
          updated_at_ms: 1,
          projector_version: 1,
          payload: {
            type:
              name === "add"
                ? "transformation"
                : entities[name].kind === "condition"
                  ? "condition"
                  : "connector",
            name,
            owner,
          },
        })),
      };
    else if (path === "/chain/connector" && request.method() === "POST") {
      const input = request.postDataJSON();
      creates.push(input);
      entities[input.name] = { ...input, owner, address: "0x0" };
      body = entities[input.name];
      status = 201;
    } else if (
      ["/chain/transformation", "/chain/condition"].includes(path) &&
      request.method() === "POST"
    ) {
      const input = request.postDataJSON();
      const kind = path.endsWith("/condition") ? "condition" : "transformation";
      creates.push(input);
      sources[input.name] = input.sol_src;
      entities[input.name] = {
        name: input.name,
        owner,
        address: "0x0",
        kind,
        args_count: kind === "condition" ? 2 : 0,
      };
      body = entities[input.name];
      status = 201;
    } else if (/\/chain\/(?:connector|transformation|condition)\//.test(path)) {
      body = entities[path.split("/").at(-1)!];
      if (!body) return route.fulfill({ status: 404, json: { message: "Not found" } });
    } else if (path.endsWith("/simulate") || path.endsWith("/execute")) {
      const input = request.postDataJSON();
      reads.push({ path, body: input });
      if (rejected)
        return route.fulfill({
          status: 503,
          json: { message: "Temporary tutorial fixture outage" },
        });
      const definition = entities[input.connector_name];
      if (
        definition?.condition_name &&
        sources[definition.condition_name] === "return args[0] >= args[1];" &&
        definition.condition_args &&
        definition.condition_args[0] < definition.condition_args[1]
      )
        return route.fulfill({ status: 400, json: { message: "ConditionNotMet" } });
      const transformation = (
        definition?.dimensions?.[0] as { transformations?: { name: string; args: number[] }[] }
      )?.transformations?.[0];
      const cycle = transformation && sources[transformation.name] === "return (x + 1) % 4;";
      const gap =
        (definition?.dimensions?.[0] as { transformations?: { args: number[] }[] })
          ?.transformations?.[0]?.args[0] ?? 2;
      const particles = [
        {
          path: `/${input.connector_name}:0/pitch:0`,
          data: Array.from(
            { length: input.particles_count },
            (_, i) => 60 + (cycle ? i % 4 : i * gap) + (wrong ? 1 : 0),
          ),
        },
      ];
      body = path.endsWith("/simulate")
        ? particles
        : { block_number: 10, block_hash: hash, runner: address, registry: address, particles };
    } else if (path.includes("/publish/")) {
      publications.push(path);
      const input = request.postDataJSON();
      if (path.endsWith("/prepare"))
        body = {
          status: "prepared",
          kind: "connector",
          name: input.name,
          content_hash: hash,
          publication_nonce: 0,
          deadline: 4_000_000_000,
          address,
          transaction: {
            from: owner,
            to: address,
            chainId: "0xaa36a7",
            gas: "0x10000",
            data: "0xabcd",
          },
        };
      else {
        entities[input.name].address = address;
        body = {
          status: "mined",
          kind: "connector",
          name: input.name,
          owner,
          address,
          tx_hash: hash,
          content_hash: hash,
          block_number: 9,
        };
      }
    } else if (request.method() !== "GET" && request.method() !== "HEAD")
      throw new Error("Unexpected write " + path);
    await route.fulfill({ status, json: body });
  });
  const readOnly = lesson === "formats" || lesson === "conditions";
  const networkId = lesson === "conditions" ? "tutorial_threshold_pass_v1" : "pitch";
  await page.goto(
    `/studio?${readOnly ? `network_kind=connector&network_id=${networkId}&` : ""}lesson=${lesson}`,
  );
  const guide = page.getByRole("region", { name: "Studio guided tutorial" });
  await expect(guide).toBeVisible();
  await expect(guide.locator(".guide-notice")).toHaveCount(0);
  return {
    guide,
    creates,
    publications,
    reads,
    protectedRequests,
    errors,
    setWrong: (v: boolean) => {
      wrong = v;
    },
    setRejected: (v: boolean) => {
      rejected = v;
    },
  };
}
const node = (page: Page, name: string) =>
  page
    .locator(".svelte-flow__node")
    .filter({ has: page.locator(".connector-title", { hasText: new RegExp(`^${name}$`) }) });
const card = (page: Page, name: string) =>
  page
    .locator(".library-card")
    .filter({ has: page.locator(".item-name", { hasText: new RegExp(`^${name}$`) }) });
async function inspector(page: Page) {
  if (!(await page.locator("#node-name").isVisible()))
    await page.getByRole("button", { name: "Toggle inspector panel", exact: true }).click();
  await page.getByRole("tab", { name: "Node", exact: true }).click();
}
async function build(page: Page, guide: ReturnType<Page["getByRole"]>, stride: number) {
  const next = guide.getByRole("button", { name: "Next", exact: true });
  await next.click();
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "Create new connector tab" }).click();
  await next.click();
  const root = page
    .locator(".svelte-flow__node")
    .filter({ has: page.locator(".connector-title", { hasText: /^Untitled/ }) });
  await root.locator(".connector-title").click();
  await inspector(page);
  await page.locator("#node-name").fill("tutorial_step" + stride);
  await page.locator("#node-name").press("Enter");
  await next.click();
  await page.getByRole("button", { name: "Published", exact: true }).click();
  await page.getByRole("button", { name: "Connectors", exact: true }).click();
  await card(page, "pitch").getByRole("button", { name: "Add to flow" }).click();
  await expect(node(page, "pitch")).toBeVisible();
  const source = node(page, "tutorial_step" + stride).locator('[data-handleid="dim-0"]');
  const target = node(page, "pitch").locator('[data-handleid="in"]');
  await source.dragTo(target);
  await next.click();
  await page.getByRole("button", { name: "Transformations", exact: true }).click();
  await card(page, "add").dragTo(
    node(page, "tutorial_step" + stride)
      .locator(".connector-row")
      .first(),
  );
  await next.click();
  await node(page, "tutorial_step" + stride)
    .locator(".connector-title")
    .click();
  await inspector(page);
  await page.locator(".inspector-transform-args-input").fill(String(stride));
  await next.click();
  await node(page, "pitch").locator(".connector-title").click();
  await page.locator("#connector-ri-start").fill("60");
  await page
    .locator('[data-tutorial="running-settings"]')
    .getByRole("button", { name: "open", exact: true })
    .click();
  await next.click();
  await expect(guide.getByRole("heading", { name: "Save four values to test" })).toBeVisible();
}

async function writeSolidityBody(page: Page, kind: "transformation" | "condition", body: string) {
  const modal = page.locator(`[data-tutorial="${kind}-editor"]`);
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: "Generate test name", exact: true }).click();
  const editor = modal.locator(".monaco-editor").last();
  await expect(editor).toBeVisible();
  const input = editor.getByRole("textbox", { name: "Editor content", exact: true });
  await input.focus();
  await input.press("Home");
  await input.press("Shift+End");
  await page.keyboard.insertText(body);
  await expect(editor.locator(".view-lines")).toHaveText(body);
  return modal;
}

async function startCustomElements(page: Page, guide: ReturnType<Page["getByRole"]>) {
  const next = guide.getByRole("button", { name: "Next", exact: true });
  await next.click();
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "Create new connector tab" }).click();
  await next.click();
  const root = page
    .locator(".svelte-flow__node")
    .filter({ has: page.locator(".connector-title", { hasText: /^Untitled/ }) });
  await root.locator(".connector-title").click();
  await inspector(page);
  await page.locator("#node-name").fill("tutorial_custom_cycle");
  await page.locator("#node-name").press("Enter");
  await next.click();
  await page.getByRole("button", { name: "Published", exact: true }).click();
  await page.getByRole("button", { name: "Connectors", exact: true }).click();
  await card(page, "pitch").getByRole("button", { name: "Add to flow" }).click();
  await expect(node(page, "pitch")).toBeVisible();
  await node(page, "tutorial_custom_cycle")
    .locator('[data-handleid="dim-0"]')
    .dragTo(node(page, "pitch").locator('[data-handleid="in"]'));
  await next.click();
  await node(page, "tutorial_custom_cycle").locator(".connector-row").first().click();
  await page.getByRole("button", { name: "Transformations", exact: true }).click();
  await page.getByRole("button", { name: "New transformation", exact: true }).click();
  const modal = page.locator('[data-tutorial="transformation-editor"]');
  await expect(modal).toContainText("attached to the selected dimension");
  await next.click();
  await expect(guide.getByRole("heading", { name: "Write a four-value loop" })).toBeVisible();
  await expect(next).toBeDisabled();
  return writeSolidityBody(page, "transformation", "return (x + 1) % 4;");
}

for (const stride of [2, 12]) {
  test(`the add ${stride} guide observes actual canvas edits, creation and the returned simulation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const state = await setup(page, stride === 2 ? "draft" : "selection", true);
    await build(page, state.guide, stride);
    const next = state.guide.getByRole("button", { name: "Next", exact: true });
    expect(state.creates).toEqual([]);
    await page.getByRole("button", { name: "Toggle run panel", exact: true }).click();
    await page.locator("#run-samples-panel").fill("4");
    await expect(next).toBeDisabled();
    await page.locator('[data-tutorial="create"]').click();
    await expect(next).toBeEnabled();
    expect(state.creates).toHaveLength(1);
    expect(state.creates[0]).toMatchObject({
      dimensions: [{ composite: "pitch", transformations: [{ name: "add", args: [stride] }] }],
      static_ri: { "2": { start_point: 60, transformation_shift: 0 } },
    });
    await next.click();
    state.setWrong(true);
    await page.locator('[data-tutorial="simulate"]').click();
    await expect(state.guide).toContainText("hasn’t matched yet");
    await expect(next).toBeDisabled();
    state.setWrong(false);
    await page.locator('[data-tutorial="simulate"]').click();
    await next.click();
    await expect(state.guide).toContainText(
      [60, 60 + stride, 60 + stride * 2, 60 + stride * 3].join(", "),
    );
    await state.guide.getByRole("button", { name: "Finish walkthrough" }).click();
    await expect(state.guide).toBeHidden();
    expect(state.publications).toEqual([]);
    expect(state.errors).toEqual([]);
  });
}

test("saving lessons explain the account prerequisite before making a draft", async ({ page }) => {
  const state = await setup(page, "draft");
  await expect(
    state.guide.getByRole("heading", { name: "Sign in to save your draft" }),
  ).toBeVisible();
  await expect(state.guide.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  expect(state.creates).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(state.guide).toBeHidden();
  expect(state.errors).toEqual([]);
});

for (const lesson of ["formats"]) {
  test(`${lesson} inspection stays public and follows the actual Inspector`, async ({ page }) => {
    const state = await setup(page, lesson);
    const next = state.guide.getByRole("button", { name: "Next", exact: true });
    await node(page, "pitch").locator(".connector-title").click();
    await next.click();
    await inspector(page);
    if (lesson === "formats") {
      await page.getByRole("tab", { name: "API", exact: true }).click();
      await next.click();
      await page.getByRole("tab", { name: "Protocol JSON", exact: true }).click();
    } else {
      await next.click();
      await page.getByRole("button", { name: "Published", exact: true }).click();
      await page.getByRole("button", { name: "Conditions", exact: true }).click();
    }
    await next.click();
    if (lesson === "formats") {
      await page.getByRole("button", { name: "Worlds", exact: true }).click();
      await next.click();
    }
    await expect(state.guide.getByRole("button", { name: "Finish walkthrough" })).toBeEnabled();
    expect(state.creates).toEqual([]);
    expect(state.publications).toEqual([]);
    expect(state.errors).toEqual([]);
  });
}

test("the conditions guide inspects a published gate and checks a fresh public execution without signing or writing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const state = await setup(page, "conditions");
  const next = state.guide.getByRole("button", { name: "Next", exact: true });
  await expect(
    state.guide.getByRole("heading", { name: "Select the published threshold example" }),
  ).toBeVisible();
  await expect(next).toBeDisabled();
  await node(page, "tutorial_threshold_pass_v1").locator(".connector-title").click();
  await next.click();
  await inspector(page);
  const condition = page.locator('[data-tutorial="condition-settings"]');
  await expect(condition).toContainText("tutorial_threshold_v1");
  await expect(condition).toContainText("12, 10");
  await expect(condition.locator("input")).toHaveCount(0);
  await expect(page.locator('.svelte-flow__node[data-id^="condition-"]')).toBeHidden();
  await next.click();
  await page.getByRole("button", { name: "Toggle run panel", exact: true }).click();
  await page.locator("#run-samples-panel").fill("3");
  await expect(next).toBeDisabled();
  await page.locator("#run-samples-panel").fill("4");
  await next.click();
  const runHeading = state.guide.getByRole("heading", { name: "Run the allowed connector" });
  await expect(runHeading).toBeVisible();
  await expect(next).toBeDisabled();
  await expect(page.locator('[data-tutorial="create"]')).toBeDisabled();
  await expect(page.locator('[data-tutorial="publish"]')).toBeDisabled();

  state.setWrong(true);
  await page.locator('[data-tutorial="execute"]').click();
  await expect(state.guide).toContainText("This result hasn’t matched yet");
  await expect(next).toBeDisabled();
  await expect(runHeading).toBeVisible();

  state.setWrong(false);
  state.setRejected(true);
  await page.locator('[data-tutorial="execute"]').click();
  await expect(state.guide).toContainText("Temporary tutorial fixture outage");
  await expect(next).toBeDisabled();
  await expect(runHeading).toBeVisible();

  state.setRejected(false);
  await page.locator('[data-tutorial="execute"]').click();
  await next.click();
  await expect(
    state.guide.getByRole("heading", { name: "The condition allowed this run" }),
  ).toBeVisible();
  const output = JSON.parse(await page.locator(".runner-output").innerText());
  expect(output.particles[0].data).toEqual([60, 62, 64, 66]);
  expect(output.block_number).toBe(10);
  expect(output.block_hash).toBe(hash);
  expect(state.reads).toHaveLength(3);
  expect(state.reads.every(({ path }) => path === "/chain/execute")).toBe(true);
  state.reads.forEach(({ body }) => {
    expect(body.connector_name).toBe("tutorial_threshold_pass_v1");
    expect(Number(body.particles_count)).toBe(4);
  });
  expect(state.protectedRequests).toEqual([]);
  expect(state.creates).toEqual([]);
  expect(state.publications).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("hypermusic_token"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("hypermusic_chain_token"))).toBeNull();
  expect(
    await page.evaluate(() => (window as unknown as { walletSends: number }).walletSends),
  ).toBe(0);
  expect(state.errors).toEqual([]);
  await state.guide.getByRole("button", { name: "Finish walkthrough" }).click();
  await expect(state.guide).toBeHidden();
});

test("publication guide waits for simulation and explicit wallet publication before a network read", async ({
  page,
}) => {
  const state = await setup(page, "publish", true, true);
  const next = state.guide.getByRole("button", { name: "Next", exact: true });
  await page.getByRole("button", { name: "Local", exact: true }).click();
  await card(page, "tutorial_saved").getByRole("button", { name: "Open in Studio" }).click();
  await next.click();
  await page.getByRole("button", { name: "Toggle run panel", exact: true }).click();
  await page.locator("#run-samples-panel").fill("4");
  await expect(next).toBeDisabled();
  await page.locator('[data-tutorial="simulate"]').click();
  await next.click();
  expect(state.publications).toEqual([]);
  await expect(next).toBeDisabled();
  await page.locator('[data-tutorial="publish"]').click();
  await next.click();
  await expect(
    state.guide.getByRole("heading", { name: "Read it from the network" }),
  ).toBeVisible();
  state.setRejected(true);
  await page.locator('[data-tutorial="execute"]').click();
  await expect(next).toBeDisabled();
  state.setRejected(false);
  await page.locator('[data-tutorial="execute"]').click();
  await next.click();
  await expect(state.guide.getByRole("button", { name: "Finish walkthrough" })).toBeEnabled();
  expect(
    await page.evaluate(() => (window as unknown as { walletSends: number }).walletSends),
  ).toBe(1);
  expect(state.errors).toEqual([]);
});

test("custom-elements guide follows both Solidity editors, fixed arguments and the actual six-value run", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const state = await setup(page, "custom-elements", true);
  const next = state.guide.getByRole("button", { name: "Next", exact: true });
  const transformationModal = await startCustomElements(page, state.guide);
  expect(state.creates).toEqual([]);
  await expect(next).toBeDisabled();
  await transformationModal.getByRole("button", { name: "Create locally", exact: true }).click();
  await expect(transformationModal).toBeHidden();
  expect(state.creates).toHaveLength(1);
  expect(state.creates[0]).toMatchObject({ sol_src: "return (x + 1) % 4;" });
  await expect(next).toBeEnabled();
  const transformationName = state.creates[0].name as string;
  await next.click();
  await node(page, "tutorial_custom_cycle").locator(".connector-title").click();
  await page.getByRole("button", { name: "Conditions", exact: true }).click();
  await page.getByRole("button", { name: "New condition", exact: true }).click();
  const conditionModal = page.locator('[data-tutorial="condition-editor"]');
  await expect(conditionModal).toContainText("attached to tutorial_custom_cycle");
  await next.click();
  await expect(next).toBeDisabled();
  await writeSolidityBody(page, "condition", "return args[0] >= args[1];");
  await expect(next).toBeDisabled();
  await conditionModal.getByRole("button", { name: "Create locally", exact: true }).click();
  await expect(conditionModal).toBeHidden();
  await expect(next).toBeEnabled();
  expect(state.creates).toHaveLength(2);
  expect(state.creates[1]).toMatchObject({ sol_src: "return args[0] >= args[1];" });
  const conditionName = state.creates[1].name as string;
  await next.click();
  await node(page, "tutorial_custom_cycle").locator(".connector-title").click();
  await inspector(page);
  await page.locator('[id^="condition-args-"]').fill("12, 10");
  await next.click();
  await node(page, "pitch").locator(".connector-title").click();
  await page.locator("#connector-ri-start").fill("60");
  await page
    .locator('[data-tutorial="running-settings"]')
    .getByRole("button", { name: "open", exact: true })
    .click();
  await next.click();
  await page.getByRole("button", { name: "Toggle run panel", exact: true }).click();
  await page.locator("#run-samples-panel").fill("6");
  await expect(next).toBeDisabled();
  await page.locator('[data-tutorial="create"]').click();
  await expect(next).toBeEnabled();
  expect(state.creates).toHaveLength(3);
  expect(state.creates[2]).toMatchObject({
    name: "tutorial_custom_cycle",
    condition_name: conditionName,
    condition_args: [12, 10],
    dimensions: [{ composite: "pitch", transformations: [{ name: transformationName, args: [] }] }],
    static_ri: { "2": { start_point: 60, transformation_shift: 0 } },
  });
  await next.click();
  state.setWrong(true);
  await page.locator('[data-tutorial="simulate"]').click();
  await expect(next).toBeDisabled();
  await expect(state.guide).toContainText("hasn’t matched yet");
  state.setWrong(false);
  await page.locator('[data-tutorial="simulate"]').click();
  await next.click();
  await expect(
    state.guide.getByRole("heading", { name: "Your custom rules work together" }),
  ).toBeVisible();
  await state.guide.getByRole("button", { name: "Finish walkthrough" }).click();
  await expect(state.guide).toBeHidden();
  await page.getByRole("button", { name: "Create new connector tab" }).click();
  const blockedRoot = page
    .locator(".svelte-flow__node")
    .filter({ has: page.locator(".connector-title", { hasText: /^Untitled/ }) });
  await blockedRoot.locator(".connector-title").click();
  await inspector(page);
  await page.locator("#node-name").fill("tutorial_custom_blocked");
  await page.locator("#node-name").press("Enter");
  await page.getByRole("button", { name: "Published", exact: true }).click();
  await page.getByRole("button", { name: "Connectors", exact: true }).click();
  await card(page, "pitch").getByRole("button", { name: "Add to flow" }).click();
  await node(page, "tutorial_custom_blocked")
    .locator('[data-handleid="dim-0"]')
    .dragTo(node(page, "pitch").locator('[data-handleid="in"]'));
  await page.getByRole("button", { name: "Local", exact: true }).click();
  await page.getByRole("button", { name: "Transformations", exact: true }).click();
  await card(page, transformationName).dragTo(
    node(page, "tutorial_custom_blocked").locator(".connector-row").first(),
  );
  await node(page, "tutorial_custom_blocked").locator(".connector-title").click();
  await page.getByRole("button", { name: "Conditions", exact: true }).click();
  await card(page, conditionName).getByRole("button", { name: "Add to flow" }).click();
  await page.locator('[id^="condition-args-"]').fill("8, 10");
  await node(page, "pitch").locator(".connector-title").click();
  await page.locator("#connector-ri-start").fill("60");
  await page
    .locator('[data-tutorial="running-settings"]')
    .getByRole("button", { name: "open", exact: true })
    .click();
  await page.getByRole("button", { name: "Toggle run panel", exact: true }).click();
  await page.locator("#run-samples-panel").fill("6");
  await page.locator('[data-tutorial="create"]').click();
  await expect.poll(() => state.creates.length).toBe(4);
  expect(state.creates[3]).toMatchObject({
    name: "tutorial_custom_blocked",
    condition_name: conditionName,
    condition_args: [8, 10],
    dimensions: [{ composite: "pitch", transformations: [{ name: transformationName, args: [] }] }],
    static_ri: { "2": { start_point: 60, transformation_shift: 0 } },
  });
  await page.locator('[data-tutorial="simulate"]').click();
  await expect(page.locator(".runner-status.is-error")).toContainText("ConditionNotMet");
  expect(state.publications).toEqual([]);
  expect(
    await page.evaluate(() => (window as unknown as { walletSends: number }).walletSends),
  ).toBe(0);
  expect(state.errors).toEqual([]);
});
