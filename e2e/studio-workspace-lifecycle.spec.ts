import { expect, test, type Page } from "@playwright/test";

const owner = `0x${"12".repeat(20)}`;
const otherOwner = `0x${"34".repeat(20)}`;
const address = `0x${"ab".repeat(20)}`;
const formatHash = `0x${"cd".repeat(32)}`;
const world = (id: string, name: string) => ({
  id,
  name,
  slug: name.toLowerCase().replaceAll(" ", "-"),
  version: "1.0.0",
  entryUrn: `/world-assets/${id}/index.html`,
  entryPath: "index.html",
  runtime: "iframe",
  surfaces: ["world-page", "studio-plugin"],
  permissions: [],
  description: `${name} test World`,
  acceptedFormatHashes: [formatHash],
  acceptedConnectorSets: [],
  ownerId: owner,
  bundleHash: `${id}-bundle`,
  manifestHash: `${id}-manifest`,
  status: "active",
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
});
const score = world("score-world-id", "Score");
const blueLine = world("blue-line-id", "Blue Line");
const entities = {
  pitch: {
    name: "pitch",
    owner: otherOwner,
    address,
    format_hash: formatHash,
    dimensions: [{ transformations: [{ name: "add", args: [1] }] }],
    static_ri: {},
  },
  score_study_v2: {
    name: "score_study_v2",
    owner,
    address: "0x0",
    format_hash: formatHash,
    dimensions: [{ transformations: [{ name: "add", args: [1] }] }],
    static_ri: {},
  },
  OtherDraft: {
    name: "OtherDraft",
    owner: otherOwner,
    address: "0x0",
    format_hash: formatHash,
    dimensions: [{ transformations: [] }],
    static_ri: {},
  },
};

/** Same wallet/session contract as studio-local-network; every remote request is intercepted. */
async function setup(
  page: Page,
  authenticated = false,
  withStarter = false,
  delayed: { run?: boolean; create?: "delayed" | "immediate" } = {},
) {
  const fixtureEntities: Record<string, Record<string, unknown>> = structuredClone(entities);
  const creates: string[] = [];
  const connectorReads: string[] = [];
  let releaseRun = () => {};
  let releaseCreate = () => {};
  let runStarted = () => {};
  let createStarted = () => {};
  const runGate = new Promise<void>((resolve) => {
    releaseRun = resolve;
  });
  const createGate = new Promise<void>((resolve) => {
    releaseCreate = resolve;
  });
  const runPending = new Promise<void>((resolve) => {
    runStarted = resolve;
  });
  const createPending = new Promise<void>((resolve) => {
    createStarted = resolve;
  });
  const errors: string[] = [];
  const runs: Array<{ path: string; name: string }> = [];
  const writes: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(
    ({ owner, authenticated }) => {
      if (window.top !== window) return;
      if (authenticated) {
        localStorage.setItem("hypermusic_token", "lifecycle-services-session");
        localStorage.setItem("hypermusic_chain_token", "lifecycle-chain-session");
        localStorage.setItem("hypermusic_chain_token_user_id", `wallet:${owner}`);
      }
      Object.assign(window, {
        ethereum: authenticated
          ? {
              request: async ({ method }: { method: string }) => {
                if (method === "eth_accounts" || method === "eth_requestAccounts") return [owner];
                if (method === "eth_chainId") return "0xaa36a7";
                throw new Error(`Unexpected wallet call: ${method}`);
              },
            }
          : undefined,
      });
    },
    { owner, authenticated },
  );
  await page.route(/^https?:\/\/[^/]+\/(?:services|chain)\/.*/, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/js/sdk/world-host.js"))
      return route.fulfill({
        contentType: "text/javascript",
        body: `export class DecentralisedArtClient { constructor() {} }
          export function createWorldHost(options) {
            queueMicrotask(() => options.onReady?.());
            return { worldUrl(url) { const u = new URL(url, location.href); u.searchParams.set('worldChannel', 'test'); return u.href; }, pushState(state) { options.iframe.contentWindow.postMessage({type: 'test-state', payload: state.payload}, '*'); }, dispose() {} };
          }`,
      });
    if (path.endsWith("/studio-starter.json"))
      return route.fulfill(
        withStarter
          ? {
              json: {
                schemaVersion: 1,
                connector: "pitch",
                particlesCount: 3,
                dynamicRi: { "0": { start_point: 60, transformation_shift: 0 } },
                simulate: false,
              },
            }
          : { status: 404, body: "No optional starter" },
      );
    if (path.includes("/world-assets/"))
      return route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><main>Connect material</main><output id="history" hidden></output><script>const states = []; addEventListener('message', event => { if (event.data.type === 'test-state') { states.push(event.data.payload); document.querySelector('main').textContent = JSON.stringify(event.data.payload); document.querySelector('#history').textContent = JSON.stringify(states); } });</script>`,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    if (path.endsWith("/worlds")) return route.fulfill({ json: [score, blueLine] });
    if (path.endsWith(`/worlds/${score.id}`)) return route.fulfill({ json: score });
    if (path.endsWith(`/worlds/${blueLine.id}`)) return route.fulfill({ json: blueLine });
    const user = {
      id: owner,
      ethereum_address: owner,
      display_name: "World lifecycle owner",
      profile_json: { public: { ethereum_address: owner } },
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
        json: {
          // Discovery is deliberately mixed: callers must verify both owner and deployment.
          owned_connectors: Object.keys(fixtureEntities),
          owned_transformations: ["add"],
          owned_conditions: [],
        },
      });
    if (path.endsWith("/chain/feed"))
      return route.fulfill({
        json: {
          limit: 100,
          cursor: { has_more: false },
          // A safe-looking feed row alone is not proof that a definition is published.
          items: Object.values(fixtureEntities).map((entity, index) => ({
            feed_id: entity.name,
            event_type: "connector_added",
            status: "safe",
            visible: true,
            tx_hash: `0x${"ef".repeat(32)}`,
            block_number: 1,
            tx_index: index,
            log_index: 0,
            history_cursor: `0000000000000001:000${index}:0000`,
            created_at_ms: 1000 - index,
            updated_at_ms: 1000,
            projector_version: 1,
            payload: { type: "connector", name: entity.name, owner: entity.owner },
          })),
        },
      });
    if (path.endsWith("/chain/connector") && request.method() === "POST" && delayed.create) {
      const input = request.postDataJSON();
      creates.push(input.name);
      createStarted();
      if (delayed.create === "delayed") await createGate;
      fixtureEntities[input.name] = {
        ...input,
        owner,
        address: "0x0",
        format_hash: formatHash,
        static_ri: {},
      };
      return route.fulfill({ json: { name: input.name, owner, address: "0x0" } });
    }
    if (path.includes("/chain/connector/")) {
      const name = decodeURIComponent(path.split("/").at(-1)!);
      connectorReads.push(name);
      const entity = fixtureEntities[name];
      return route.fulfill(
        entity ? { json: entity } : { status: 404, json: { message: "Not found" } },
      );
    }
    if (path.endsWith("/chain/transformation/add"))
      return route.fulfill({
        json: {
          name: "add",
          owner: otherOwner,
          address,
          args_count: 1,
          sol_src: "return value + args[0];",
        },
      });
    if (path.endsWith("/chain/simulate") || path.endsWith("/chain/execute")) {
      const input = request.postDataJSON();
      runs.push({ path, name: input.connector_name });
      if (delayed.run) {
        runStarted();
        await runGate;
      }
      const particles = [{ path: `/${input.connector_name}:0`, data: [60, 61, 62] }];
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
    if (request.method() !== "GET") {
      writes.push(path);
      return route.fulfill({ status: 403, json: { message: "Unexpected lifecycle mutation" } });
    }
    return route.fulfill({ json: [] });
  });
  return {
    errors,
    runs,
    writes,
    creates,
    connectorReads,
    publishEntity: (name: string) => {
      fixtureEntities[name].address = address;
    },
    releaseRun,
    releaseCreate,
    waitForRun: () => runPending,
    waitForCreate: () => createPending,
  };
}

const connectorNodes = (page: Page) => page.locator(".svelte-flow__node-connector");
const worldNodes = (page: Page) => page.locator('.svelte-flow__node[data-id^="plugin-world:"]');
const pluginCard = (page: Page, name: string) =>
  page.locator(".plugin-card").filter({ has: page.getByRole("heading", { name, exact: true }) });
const libraryCard = (page: Page, name: string) =>
  page
    .locator(".library-card")
    .filter({ has: page.locator(".item-name", { hasText: new RegExp(`^${name}$`) }) });

async function openRunPanel(page: Page) {
  if (!(await page.locator("#run-samples-panel").isVisible()))
    await page.getByRole("button", { name: /^(Toggle run panel|Run panel)$/ }).click();
}

async function removeConnector(page: Page) {
  const root = connectorNodes(page).first();
  await root.locator(".connector-title").click();
  await root.focus();
  await root.press("Enter");
  await expect(root).toHaveClass(/selected/);
  await root.press("Backspace");
  await expect(connectorNodes(page)).toHaveCount(0);
}

test("World panel contains only active API Worlds and inserts Score despite an untyped draft root", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/studio");
  await expect(connectorNodes(page)).toHaveCount(1);
  await page.getByRole("button", { name: "Worlds", exact: true }).click();
  await expect(page.locator(".plugin-card h4")).toHaveText(["Score", "Blue Line"]);
  const scoreCard = pluginCard(page, "Score");
  await expect(scoreCard.getByRole("button")).toBeEnabled();
  await scoreCard.getByRole("button").click();
  await expect(worldNodes(page)).toHaveCount(1);
  await expect(worldNodes(page)).toContainText("Score");
  await expect(page.locator(".svelte-flow__edge")).toHaveCount(0);
  await removeConnector(page);
  await pluginCard(page, "Blue Line").getByRole("button").click();
  await expect(worldNodes(page)).toHaveCount(2);
  expect(state.errors).toEqual([]);
  expect(state.writes).toEqual([]);
});

test("adding a World auto-connects a compatible published connector", async ({ page }) => {
  const state = await setup(page, true);
  await page.goto("/studio?network_kind=connector&network_id=pitch");
  await expect(connectorNodes(page)).toHaveCount(1);
  await page.getByRole("button", { name: "Worlds", exact: true }).click();
  await pluginCard(page, "Score").getByRole("button").click();
  await expect(worldNodes(page)).toHaveCount(1);
  await expect(page.locator(".svelte-flow__edge")).toHaveCount(1);
  await openRunPanel(page);
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(worldNodes(page).frameLocator("iframe").locator("main")).toContainText(
    '"connectorName":"pitch"',
  );
  expect(state.runs).toEqual([{ path: "/chain/simulate", name: "pitch" }]);
  expect(state.errors).toEqual([]);
});

test("removing the blank project root survives reload and a replacement keeps its published identity", async ({
  page,
}) => {
  const state = await setup(page, true);
  await page.goto("/studio");
  await expect(connectorNodes(page)).toHaveCount(1);
  await removeConnector(page);
  await page.reload();
  await expect(page.getByRole("application", { name: "Flow canvas" })).toBeVisible();
  await expect(connectorNodes(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Published", exact: true }).click();
  await expect(libraryCard(page, "pitch")).toBeVisible();
  await libraryCard(page, "pitch").getByTitle("Add to flow").click();
  await expect(connectorNodes(page)).toHaveCount(1);
  await expect(connectorNodes(page).locator(".connector-title")).toHaveText("pitch");
  await openRunPanel(page);
  const simulate = page.getByRole("button", { name: "Simulate", exact: true });
  const execute = page.getByRole("button", { name: "Execute on the Network", exact: true });
  await expect(simulate).toBeEnabled();
  await expect(execute).toBeEnabled();
  await simulate.click();
  await expect(page.locator(".runner-status.is-success")).toContainText("Simulation completed");
  await execute.click();
  await expect(page.locator(".runner-output")).toContainText('"block_number": 10');
  expect(state.runs).toEqual([
    { path: "/chain/simulate", name: "pitch" },
    { path: "/chain/execute", name: "pitch" },
  ]);
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test("an owner draft in a World workspace can simulate and publish while execution stays disabled", async ({
  page,
}) => {
  const state = await setup(page, true, true);
  await page.goto(`/studio?world=${score.id}`);
  await expect(worldNodes(page)).toHaveCount(1);
  // Replace any default browser draft using the same removal gesture as the real workspace.
  if (await connectorNodes(page).count()) await removeConnector(page);
  await expect(connectorNodes(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Local", exact: true }).click();
  await expect(libraryCard(page, "score_study_v2")).toBeVisible();
  await expect(libraryCard(page, "OtherDraft")).toHaveCount(0);
  await libraryCard(page, "score_study_v2").getByTitle("Add to flow").click();
  await expect(connectorNodes(page)).toHaveCount(1);
  await expect(connectorNodes(page).locator(".connector-title")).toHaveText("score_study_v2");
  await openRunPanel(page);
  await expect(page.getByRole("button", { name: "Simulate", exact: true })).toBeEnabled();
  await expect(
    page
      .locator(".runner-controls")
      .getByRole("button", { name: "Publish to the Network", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Execute on the Network", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(page.locator(".runner-output")).toContainText("score_study_v2");
  expect(state.runs).toEqual([{ path: "/chain/simulate", name: "score_study_v2" }]);
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

for (const authenticated of [false, true]) {
  test(`unpublished feed rows are absent from the public library (${authenticated ? "owner" : "anonymous"})`, async ({
    page,
  }) => {
    const state = await setup(page, authenticated);
    await page.goto("/studio");
    await page.getByRole("button", { name: "Published", exact: true }).click();
    await expect(libraryCard(page, "pitch")).toBeVisible();
    await expect(libraryCard(page, "score_study_v2")).toHaveCount(0);
    await expect(libraryCard(page, "OtherDraft")).toHaveCount(0);
    expect(state.errors).toEqual([]);
  });
}

const connectorNamed = (page: Page, name: string) =>
  connectorNodes(page).filter({
    has: page.locator(".connector-title", { hasText: new RegExp(`^${name}$`) }),
  });

const connectorIdentities = (page: Page) =>
  connectorNodes(page).evaluateAll((elements) =>
    elements
      .map((element) => ({
        id: element.getAttribute("data-id"),
        name: element.querySelector(".connector-title")?.textContent?.trim(),
      }))
      .sort((left, right) => (left.name ?? "").localeCompare(right.name ?? "")),
  );

async function addOwnedDraftAlongsideStarter(page: Page) {
  await page.goto(`/studio?world=${score.id}`);
  await expect(worldNodes(page)).toHaveCount(1);
  await expect(connectorNamed(page, "pitch")).toHaveCount(1);
  await page.getByRole("button", { name: "Local", exact: true }).click();
  await expect(libraryCard(page, "score_study_v2")).toBeVisible();
  await libraryCard(page, "score_study_v2").getByTitle("Add to flow").click();
  await expect(connectorNodes(page)).toHaveCount(2);
  await expect(connectorNamed(page, "score_study_v2")).toHaveCount(1);
}

test("choosing between published and local roots preserves identities, capabilities and selection after reload", async ({
  page,
}) => {
  const state = await setup(page, true, true);
  await addOwnedDraftAlongsideStarter(page);
  const identities = await connectorIdentities(page);
  const localId = await connectorNamed(page, "score_study_v2").getAttribute("data-id");
  const pitchId = await connectorNamed(page, "pitch").getAttribute("data-id");
  await openRunPanel(page);
  const rootSelect = page.getByRole("combobox", { name: "Run connector", exact: true });
  const runner = page.locator(".runner-controls");
  const simulate = runner.getByRole("button", { name: "Simulate", exact: true });
  const publish = runner.getByRole("button", { name: "Publish to the Network", exact: true });
  const execute = runner.getByRole("button", { name: "Execute on the Network", exact: true });
  await rootSelect.selectOption({ label: "score_study_v2" });
  await expect(rootSelect).toHaveValue(localId!);
  await expect(simulate).toBeEnabled();
  await expect(publish).toBeEnabled();
  await expect(execute).toBeDisabled();
  await simulate.click();
  await expect(page.locator(".runner-output")).toContainText("score_study_v2");
  expect(state.runs).toEqual([{ path: "/chain/simulate", name: "score_study_v2" }]);
  await expect
    .poll(() =>
      page.evaluate(() => {
        for (const key of Object.keys(sessionStorage)) {
          if (!key.startsWith("dcn_studio_tabs_session_v1:")) continue;
          const session = JSON.parse(sessionStorage.getItem(key)!);
          const active = session.tabs.find((tab: { id: string }) => tab.id === session.activeTabId);
          if (active?.worldId === "score-world-id") return active.runRootId;
        }
        return null;
      }),
    )
    .toBe(localId);
  await page.reload();
  await expect(connectorNodes(page)).toHaveCount(2);
  await openRunPanel(page);
  await expect(rootSelect).toHaveValue(localId!);
  await expect(simulate).toBeEnabled();
  await expect(publish).toBeEnabled();
  await expect(execute).toBeDisabled();
  expect(await connectorIdentities(page)).toEqual(identities);
  await rootSelect.selectOption({ label: "pitch" });
  await expect(rootSelect).toHaveValue(pitchId!);
  await expect(simulate).toBeEnabled();
  await expect(publish).toBeDisabled();
  await expect(execute).toBeEnabled();
  await execute.click();
  await expect(page.locator(".runner-output")).toContainText('"block_number": 10');
  expect(state.runs).toEqual([
    { path: "/chain/simulate", name: "score_study_v2" },
    { path: "/chain/execute", name: "pitch" },
  ]);
  expect(await connectorIdentities(page)).toEqual(identities);
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test("reconnecting the World to another top-level connector retargets the runner without renaming nodes", async ({
  page,
}) => {
  const state = await setup(page, true, true);
  await addOwnedDraftAlongsideStarter(page);
  const identities = await connectorIdentities(page);
  const localId = await connectorNamed(page, "score_study_v2").getAttribute("data-id");
  const edge = page.locator(".svelte-flow__edge");
  await expect(edge).toHaveCount(1);
  await edge.focus();
  await edge.press("Enter");
  await expect(edge).toHaveClass(/selected/);
  await edge.press("Backspace");
  await expect(edge).toHaveCount(0);
  await page.getByRole("button", { name: "Zoom to fit", exact: true }).click();
  const source = worldNodes(page).locator('[data-handleid="out"]');
  const target = connectorNamed(page, "score_study_v2").locator('[data-handleid="in"]');
  await source.dragTo(target);
  await expect(edge).toHaveCount(1);
  await openRunPanel(page);
  await expect(page.getByRole("combobox", { name: "Run connector", exact: true })).toHaveValue(
    localId!,
  );
  const runner = page.locator(".runner-controls");
  await expect(
    runner.getByRole("button", { name: "Publish to the Network", exact: true }),
  ).toBeEnabled();
  await expect(
    runner.getByRole("button", { name: "Execute on the Network", exact: true }),
  ).toBeDisabled();
  await runner.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(worldNodes(page).frameLocator("iframe").locator("main")).toContainText(
    '"connectorName":"score_study_v2"',
  );
  expect(state.runs).toEqual([{ path: "/chain/simulate", name: "score_study_v2" }]);
  expect(await connectorIdentities(page)).toEqual(identities);
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test("inserting another instance into a saved connector tab survives switching tabs and reload", async ({
  page,
}) => {
  const state = await setup(page, true);
  await page.goto("/studio?network_kind=connector&network_id=pitch");
  await expect(connectorNamed(page, "pitch")).toHaveCount(1);
  const originalPitchId = await connectorNamed(page, "pitch").getAttribute("data-id");
  await page.getByRole("button", { name: "New Connector", exact: true }).click();
  await expect(connectorNodes(page)).toHaveCount(2);
  await expect(connectorNamed(page, "New Connector")).toHaveCount(1);
  const identities = await connectorIdentities(page);
  await openRunPanel(page);
  await expect(page.getByRole("combobox", { name: "Run connector", exact: true })).toHaveValue(
    originalPitchId!,
  );
  await page.getByRole("button", { name: "Create new connector tab", exact: true }).click();
  await expect(connectorNodes(page)).toHaveCount(1);
  await page.getByRole("tab", { name: /^pitch / }).click();
  await expect(connectorNodes(page)).toHaveCount(2);
  expect(await connectorIdentities(page)).toEqual(identities);
  await page.reload();
  await expect(connectorNodes(page)).toHaveCount(2);
  expect(await connectorIdentities(page)).toEqual(identities);
  await openRunPanel(page);
  await expect(page.getByRole("combobox", { name: "Run connector", exact: true })).toHaveValue(
    originalPitchId!,
  );
  const runner = page.locator(".runner-controls");
  await expect(
    runner.getByRole("button", { name: "Execute on the Network", exact: true }),
  ).toBeEnabled();
  await runner.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(page.locator(".runner-output")).toContainText("/pitch:0");
  await runner.getByRole("button", { name: "Execute on the Network", exact: true }).click();
  await expect(page.locator(".runner-output")).toContainText('"block_number": 10');
  expect(state.runs).toEqual([
    { path: "/chain/simulate", name: "pitch" },
    { path: "/chain/execute", name: "pitch" },
  ]);
  expect(state.errors).toEqual([]);
  expect(state.writes).toEqual([]);
});

for (const mode of ["Simulate", "Execute on the Network"]) {
  test(`a delayed ${mode} result cannot resurrect a replaced root or reach the new World input`, async ({
    page,
  }) => {
    const state = await setup(page, true, true, { run: true });
    try {
      await page.goto(`/studio?world=${score.id}`);
      await expect(connectorNamed(page, "pitch")).toHaveCount(1);
      const removedId = await connectorNamed(page, "pitch").getAttribute("data-id");
      await openRunPanel(page);
      await page
        .locator(".runner-controls")
        .getByRole("button", { name: mode, exact: true })
        .click();
      await state.waitForRun();
      await removeConnector(page);
      await page.getByRole("button", { name: "Local", exact: true }).click();
      await libraryCard(page, "score_study_v2").getByTitle("Add to flow").click();
      await expect(connectorNamed(page, "score_study_v2")).toHaveCount(1);
      const replacementId = await connectorNamed(page, "score_study_v2").getAttribute("data-id");
      await page.getByRole("button", { name: "Zoom to fit", exact: true }).click();
      await worldNodes(page)
        .locator('[data-handleid="out"]')
        .dragTo(connectorNamed(page, "score_study_v2").locator('[data-handleid="plugin-in"]'));
      await expect(page.locator(".svelte-flow__edge")).toHaveCount(1);
      const finished = page.waitForResponse((response) =>
        response.url().endsWith(mode === "Simulate" ? "/simulate" : "/execute"),
      );
      state.releaseRun();
      await finished;
      const runner = page.locator(".runner-controls");
      await expect(runner.getByRole("button", { name: "Simulate", exact: true })).toBeEnabled();
      await expect(
        runner.getByRole("button", { name: "Execute on the Network", exact: true }),
      ).toBeDisabled();
      await expect(connectorNodes(page)).toHaveCount(1);
      await expect(connectorNamed(page, "score_study_v2")).toHaveAttribute(
        "data-id",
        replacementId!,
      );
      await expect(page.locator(`.svelte-flow__node[data-id="${removedId}"]`)).toHaveCount(0);
      const frame = worldNodes(page).frameLocator("iframe");
      await expect(frame.locator("#history")).not.toContainText('"/pitch:0"');
      await expect(frame.locator("#history")).not.toContainText('"block_number":10');
      await expect(page.locator(".runner-output")).not.toContainText("/pitch:0");
      await runner.getByRole("button", { name: "Simulate", exact: true }).click();
      await expect(frame.locator("main")).toContainText('"connectorName":"score_study_v2"');
      await expect(frame.locator("main")).toContainText('"path":"/score_study_v2:0"');
      await expect(frame.locator("#history")).not.toContainText('"/pitch:0"');
      await expect(frame.locator("#history")).not.toContainText('"block_number":10');
      expect(state.runs).toEqual([
        { path: mode === "Simulate" ? "/chain/simulate" : "/chain/execute", name: "pitch" },
        { path: "/chain/simulate", name: "score_study_v2" },
      ]);
      expect(state.errors).toEqual([]);
      expect(state.writes).toEqual([]);
    } finally {
      state.releaseRun();
    }
  });
}

test("a delayed Create response saves the entity without replacing a new workspace root", async ({
  page,
}) => {
  const state = await setup(page, true, false, { create: "delayed" });
  try {
    await page.goto("/studio");
    const tab = page.getByRole("tab", { name: /^Untitled Connector / });
    await tab.dblclick();
    await page.locator(".tab-rename").fill("DelayedDraft");
    await page.locator(".tab-rename").press("Enter");
    await expect(connectorNamed(page, "DelayedDraft")).toHaveCount(1);
    await openRunPanel(page);
    await page
      .locator(".runner-controls")
      .getByRole("button", { name: "Create locally", exact: true })
      .click();
    await state.waitForCreate();
    await removeConnector(page);
    await page.getByRole("button", { name: "Published", exact: true }).click();
    await libraryCard(page, "pitch").getByTitle("Add to flow").click();
    await expect(connectorNamed(page, "pitch")).toHaveCount(1);
    const replacementId = await connectorNamed(page, "pitch").getAttribute("data-id");
    const finished = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith("/chain/connector") &&
        response.request().method() === "POST",
    );
    state.releaseCreate();
    await finished;
    await expect(
      page
        .locator(".runner-controls")
        .getByRole("button", { name: "Execute on the Network", exact: true }),
    ).toBeEnabled();
    await expect(connectorNodes(page)).toHaveCount(1);
    await expect(connectorNamed(page, "pitch")).toHaveAttribute("data-id", replacementId!);
    await expect(connectorNamed(page, "DelayedDraft")).toHaveCount(0);
    await page.getByRole("button", { name: "Local", exact: true }).click();
    await page.getByRole("button", { name: "Refresh Local", exact: true }).click();
    await expect(libraryCard(page, "DelayedDraft")).toBeVisible();
    await page.reload();
    await expect(connectorNodes(page)).toHaveCount(1);
    await expect(connectorNamed(page, "pitch")).toHaveAttribute("data-id", replacementId!);
    expect(state.creates).toEqual(["DelayedDraft"]);
    expect(state.errors).toEqual([]);
    expect(state.writes).toEqual([]);
  } finally {
    state.releaseCreate();
  }
});

test("successful Create preserves attached Worlds and unrelated instances through reload", async ({
  page,
}) => {
  const state = await setup(page, true, false, { create: "immediate" });
  await page.goto("/studio");
  await page.getByRole("tab", { name: /^Untitled Connector / }).dblclick();
  await page.locator(".tab-rename").fill("SavedComposition");
  await page.locator(".tab-rename").press("Enter");
  await expect(connectorNamed(page, "SavedComposition")).toHaveCount(1);
  await page.getByRole("button", { name: "Published", exact: true }).click();
  await libraryCard(page, "pitch").getByTitle("Add to flow").click();
  await expect(connectorNodes(page)).toHaveCount(2);
  await page.getByRole("button", { name: "Worlds", exact: true }).click();
  await pluginCard(page, "Score").getByRole("button").click();
  await expect(worldNodes(page)).toHaveCount(1);
  await expect(page.locator(".svelte-flow__edge")).toHaveCount(0);
  await expect(worldNodes(page)).toHaveClass(/selected/);
  await page.getByRole("button", { name: "Zoom to fit", exact: true }).click();
  await worldNodes(page)
    .locator('[data-handleid="out"]')
    .dragTo(connectorNamed(page, "SavedComposition").locator('[data-handleid="plugin-in"]'));
  const edge = page.locator(".svelte-flow__edge");
  await expect(edge).toHaveCount(1);
  const edgeId = await edge.getAttribute("data-id");
  const worldId = await worldNodes(page).getAttribute("data-id");
  const identities = await connectorIdentities(page);
  await openRunPanel(page);
  const runner = page.locator(".runner-controls");
  await runner.getByRole("button", { name: "Create locally", exact: true }).click();
  await expect(runner.getByRole("button", { name: "Simulate", exact: true })).toBeEnabled();
  await expect(
    runner.getByRole("button", { name: "Publish to the Network", exact: true }),
  ).toBeEnabled();
  await expect(
    runner.getByRole("button", { name: "Execute on the Network", exact: true }),
  ).toBeDisabled();
  expect(await connectorIdentities(page)).toEqual(identities);
  await expect(worldNodes(page)).toHaveAttribute("data-id", worldId!);
  await expect(edge).toHaveAttribute("data-id", edgeId!);
  await runner.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(worldNodes(page).frameLocator("iframe").locator("main")).toContainText(
    '"connectorName":"SavedComposition"',
  );
  await page.reload();
  await expect(connectorNodes(page)).toHaveCount(2);
  expect(await connectorIdentities(page)).toEqual(identities);
  await expect(worldNodes(page)).toHaveAttribute("data-id", worldId!);
  await expect(edge).toHaveAttribute("data-id", edgeId!);
  await openRunPanel(page);
  await expect(runner.getByRole("button", { name: "Simulate", exact: true })).toBeEnabled();
  await expect(
    runner.getByRole("button", { name: "Publish to the Network", exact: true }),
  ).toBeEnabled();
  await expect(
    runner.getByRole("button", { name: "Execute on the Network", exact: true }),
  ).toBeDisabled();
  expect(state.creates).toEqual(["SavedComposition"]);
  expect(state.runs).toEqual([{ path: "/chain/simulate", name: "SavedComposition" }]);
  expect(state.errors).toEqual([]);
  expect(state.writes).toEqual([]);
});

test("manual registry refresh rechecks a cached local root when publication becomes visible", async ({
  page,
}) => {
  const state = await setup(page, true);
  await page.goto("/studio?network_kind=connector&network_id=score_study_v2");
  await expect(connectorNamed(page, "score_study_v2")).toHaveCount(1);
  const identities = await connectorIdentities(page);
  await openRunPanel(page);
  const runner = page.locator(".runner-controls");
  await expect(
    runner.getByRole("button", { name: "Publish to the Network", exact: true }),
  ).toBeEnabled();
  await expect(
    runner.getByRole("button", { name: "Execute on the Network", exact: true }),
  ).toBeDisabled();
  const readCount = state.connectorReads.filter((name) => name === "score_study_v2").length;
  // The API initially lagged behind publication; its next definition now has a deployed address.
  state.publishEntity("score_study_v2");
  await page.getByRole("button", { name: "Refresh network library", exact: true }).click();
  await expect
    .poll(() => state.connectorReads.filter((name) => name === "score_study_v2").length)
    .toBeGreaterThan(readCount);
  await expect(
    runner.getByRole("button", { name: "Execute on the Network", exact: true }),
  ).toBeEnabled();
  await expect(
    runner.getByRole("button", { name: "Publish to the Network", exact: true }),
  ).toBeDisabled();
  await runner.getByRole("button", { name: "Execute on the Network", exact: true }).click();
  await expect(page.locator(".runner-output")).toContainText('"block_number": 10');
  expect(await connectorIdentities(page)).toEqual(identities);
  expect(state.runs).toEqual([{ path: "/chain/execute", name: "score_study_v2" }]);
  expect(state.creates).toEqual([]);
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test("Create and simulation use only the selected root while an unrelated unfinished draft stays editable", async ({
  page,
}) => {
  const state = await setup(page, true, false, { create: "immediate" });
  await page.goto("/studio");
  await page.getByRole("tab", { name: /^Untitled Connector / }).dblclick();
  await page.locator(".tab-rename").fill("ScopedComposition");
  await page.locator(".tab-rename").press("Enter");
  await expect(connectorNamed(page, "ScopedComposition")).toHaveCount(1);
  await page.getByRole("button", { name: "New Connector", exact: true }).click();
  await expect(connectorNodes(page)).toHaveCount(2);
  const identities = await connectorIdentities(page);
  await openRunPanel(page);
  const chooseRoot = page.getByRole("combobox", { name: "Run connector", exact: true });
  await chooseRoot.selectOption({ label: "ScopedComposition" });
  const runner = page.locator(".runner-controls");
  await runner.getByRole("button", { name: "Create locally", exact: true }).click();
  await expect(
    runner.getByRole("button", { name: "Publish to the Network", exact: true }),
  ).toBeEnabled();
  await expect(
    runner.getByRole("button", { name: "Execute on the Network", exact: true }),
  ).toBeDisabled();
  expect(state.creates).toEqual(["ScopedComposition"]);
  expect(await connectorIdentities(page)).toEqual(identities);
  await expect(
    connectorNamed(page, "ScopedComposition").locator(".connector-readonly-chip"),
  ).toHaveCount(1);
  await expect(
    connectorNamed(page, "New Connector").locator(".connector-readonly-chip"),
  ).toHaveCount(0);
  await runner.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(page.locator(".runner-output")).toContainText("/ScopedComposition:0");
  expect(state.runs).toEqual([{ path: "/chain/simulate", name: "ScopedComposition" }]);
  await chooseRoot.selectOption({ label: "New Connector" });
  await expect(runner.getByRole("button", { name: "Create locally", exact: true })).toBeEnabled();
  await expect(runner.getByRole("button", { name: "Simulate", exact: true })).toBeDisabled();
  await expect(
    runner.getByRole("button", { name: "Publish to the Network", exact: true }),
  ).toBeDisabled();
  await expect(
    runner.getByRole("button", { name: "Execute on the Network", exact: true }),
  ).toBeDisabled();
  expect(state.errors).toEqual([]);
  expect(state.writes).toEqual([]);
});

test("connector loading shows a cancellable scaffold and a cancelled worker cannot replace the workspace", async ({
  page,
}) => {
  const state = await setup(page, true);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let workerRequests = 0;
  await page.route(/connectorTreeWorker-[^/]+\.js$/, async (route) => {
    workerRequests++;
    if (workerRequests === 1) await gate;
    try {
      await route.continue();
    } catch {
      /* Termination may abort the pending worker fetch. */
    }
  });
  try {
    await page.goto("/studio?network_kind=connector&network_id=pitch");
    const scaffold = page.locator(".graph-loading");
    await expect(scaffold).toBeVisible();
    await expect(scaffold).toContainText("Preparing connector graph");
    await scaffold.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(scaffold).toHaveCount(0);
    release();
    await expect(connectorNodes(page)).toHaveCount(0);
    const pitch = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("link", { name: "pitch", exact: true }) });
    await pitch.getByRole("button", { name: "Open in Studio", exact: true }).click();
    await expect(connectorNodes(page)).toHaveCount(1);
    await expect(connectorNodes(page).locator(".connector-title")).toHaveText("pitch");
    await expect(scaffold).toHaveCount(0);
    expect(workerRequests).toBeGreaterThan(1);
    expect(state.errors).toEqual([]);
    expect(state.writes).toEqual([]);
  } finally {
    release();
  }
});
