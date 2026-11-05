import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { largeConnectorFixture } from "./fixtures/large-connector";
const syntheticFixture = largeConnectorFixture();
const fixture: typeof syntheticFixture = process.env.STUDIO_LARGE_CONNECTOR_FIXTURE
  ? JSON.parse(readFileSync(process.env.STUDIO_LARGE_CONNECTOR_FIXTURE, "utf8"))
  : syntheticFixture;

// CI uses synthetic music. An optional private fixture exercises a real saved draft
// without adding its unpublished definitions or music to the frontend repository.
// Both exceed the former 64-connector cap and contain a foreign-owned published leaf.
const rootName = fixture.source.root;
const owner = fixture.owner;
const world = fixture.world;
const connectors = fixture.connectors as Record<
  string,
  {
    name: string;
    owner: string;
    address: string;
    static_ri: Record<string, unknown>;
    dimensions: Array<{ composite?: string; transformations: unknown[] }>;
  }
>;
const transformations = fixture.transformations as Record<string, { owner: string }>;
const scoreDist = process.env.SCORE_WORLD_DIST;
test.use({ viewport: { width: 1600, height: 1100 } });
const connectorNodes = (page: Page) => page.locator(".svelte-flow__node-connector");
const worldNodes = (page: Page) => page.locator('.svelte-flow__node[data-id^="plugin-world:"]');
const connectorNamed = (page: Page, name: string) =>
  connectorNodes(page).filter({
    has: page.locator(".connector-title", { hasText: new RegExp(`^${name}$`) }),
  });
const libraryCard = (page: Page) =>
  page.locator(".library-card").filter({
    has: page.locator(".item-name", { hasText: new RegExp(`^${rootName}$`) }),
  });

async function setup(page: Page) {
  const connectorReads: string[] = [];
  const runs: Array<Record<string, unknown>> = [];
  const writes: string[] = [];
  const errors: string[] = [];
  const rejectedRuns: string[] = [];
  const sdk = async (name: string) =>
    (
      await build({
        entryPoints: [resolve(`submodules/sdk/js/src/worlds/${name}.ts`)],
        bundle: true,
        write: false,
        format: "esm",
        target: "es2022",
        logLevel: "silent",
      })
    ).outputFiles[0].text;
  const [host, runtime] = await Promise.all([sdk("host"), sdk("runtime")]);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(
    ({ owner }) => {
      if (window.top !== window) return;
      localStorage.setItem("hypermusic_token", "large-tree-test-services-session");
      localStorage.setItem("hypermusic_chain_token", "large-tree-test-chain-session");
      localStorage.setItem("hypermusic_chain_token_user_id", `wallet:${owner}`);
      Object.assign(window, {
        ethereum: {
          request: async ({ method }: { method: string }) => {
            if (method === "eth_accounts" || method === "eth_requestAccounts") return [owner];
            if (method === "eth_chainId") return "0xaa36a7";
            throw new Error(`Unexpected wallet request: ${method}`);
          },
        },
      });
    },
    { owner },
  );
  const ownedNames = Object.values(connectors)
    .filter((c) => `0x${c.owner.replace(/^0x/, "")}` === owner)
    .map((c) => c.name);
  const user = {
    id: owner,
    ethereum_address: owner,
    display_name: "Large connector test owner",
    profile_json: { public: { ethereum_address: owner } },
  };
  await page.route(/^https?:\/\/[^/]+\/(?:services|chain)\/.*/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
    };
    if (path.endsWith("/js/sdk/world-host.js") || path.endsWith("/js/sdk/world-runtime.js"))
      return route.fulfill({
        contentType: "text/javascript",
        headers,
        body: path.endsWith("world-host.js") ? host : runtime,
      });
    if (path.endsWith("/studio-starter.json"))
      return route.fulfill({ status: 404, body: "No optional starter" });
    const assetPrefix = `/services/world-assets/${world.id}/`;
    if (path.startsWith(assetPrefix)) {
      const file = decodeURIComponent(path.slice(assetPrefix.length));
      if (scoreDist) {
        const absolute = resolve(scoreDist, file);
        if (!absolute.startsWith(resolve(scoreDist) + sep)) return route.fulfill({ status: 404 });
        const types: Record<string, string> = {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".json": "application/json",
          ".png": "image/png",
          ".mp3": "audio/mpeg",
        };
        try {
          return route.fulfill({
            body: await readFile(absolute),
            contentType: types[extname(file)] ?? "application/octet-stream",
            headers: {
              ...headers,
              "Content-Security-Policy":
                "default-src 'self' blob: data:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'",
            },
          });
        } catch {
          return route.fulfill({ status: 404 });
        }
      }
      // Portable CI still tests the real SDK state boundary. Set SCORE_WORLD_DIST
      // to the independently released World bundle for actual Verovio/piano checks.
      if (file === "index.html")
        return route.fulfill({
          contentType: "text/html",
          headers,
          body: '<!doctype html><output id="received"></output><script type="module" src="receiver.js"></script>',
        });
      if (file === "receiver.js")
        return route.fulfill({
          contentType: "text/javascript",
          headers,
          body: `import {createWorldSdk} from '../../js/sdk/world-runtime.js'; const sdk=createWorldSdk({worldId:${JSON.stringify(world.id)}}); sdk.onState(state=>document.querySelector('output').textContent=JSON.stringify(state.payload)); sdk.ready();`,
        });
      return route.fulfill({ status: 404 });
    }
    if (path.endsWith("/auth/me")) return route.fulfill({ json: { user } });
    if (path.includes("/services/users/")) return route.fulfill({ json: { user } });
    if (path.endsWith("/services/users")) return route.fulfill({ json: [user] });
    if (path.endsWith("/services/worlds")) return route.fulfill({ json: [world] });
    if (path.endsWith(`/services/worlds/${world.id}`)) return route.fulfill({ json: world });
    if (path.includes("/chain/account/")) {
      const after = url.searchParams.get("after_connectors");
      const start = after ? ownedNames.indexOf(after) + 1 : 0;
      const limit = Number(url.searchParams.get("limit") ?? 100);
      const names = ownedNames.slice(start, start + limit);
      const hasMore = start + names.length < ownedNames.length;
      return route.fulfill({
        json: {
          address: owner,
          limit,
          owned_connectors: names,
          owned_transformations: Object.entries(transformations)
            .filter(([, t]) => `0x${t.owner.replace(/^0x/, "")}` === owner)
            .map(([name]) => name),
          owned_conditions: [],
          cursor_connectors: { has_more: hasMore, next_after: hasMore ? names.at(-1) : null },
          cursor_transformations: { has_more: false },
          cursor_conditions: { has_more: false },
        },
      });
    }
    // No published feed cache: pitch must be found by traversing the requested tree.
    if (path.endsWith("/chain/feed"))
      return route.fulfill({ json: { limit: 100, cursor: { has_more: false }, items: [] } });
    if (path.includes("/chain/connector/")) {
      const name = decodeURIComponent(path.split("/").at(-1)!);
      connectorReads.push(name);
      return route.fulfill(
        connectors[name]
          ? { json: connectors[name] }
          : { status: 404, json: { message: "Not found" } },
      );
    }
    if (path.includes("/chain/transformation/")) {
      const name = decodeURIComponent(path.split("/").at(-1)!);
      return route.fulfill(
        transformations[name]
          ? { json: transformations[name] }
          : { status: 404, json: { message: "Not found" } },
      );
    }
    if (path.endsWith("/chain/simulate")) {
      const input = request.postDataJSON();
      runs.push(input);
      const dynamic = input.dynamic_ri ?? {};
      const invalid = Object.entries(dynamic).find(([position, ri]) => {
        const value = ri as { start_point?: number; transformation_shift?: number };
        return (
          !/^(0|[1-9]\d*)$/.test(position) ||
          Number(position) >= fixture.positions.length ||
          Object.hasOwn(connectors[rootName].static_ri, position) ||
          value.start_point !== 0 ||
          value.transformation_shift !== 0
        );
      });
      if (
        input.connector_name !== rootName ||
        Number(input.particles_count) !== fixture.source.N ||
        invalid
      ) {
        const message = `Fixture rejects an altered run contract: ${JSON.stringify({ ...input, dynamic_ri: invalid ?? "valid" })}`;
        rejectedRuns.push(message);
        return route.fulfill({ status: 400, json: { message } });
      }
      return route.fulfill({ json: fixture.simulation });
    }
    if (request.method() !== "GET") {
      writes.push(`${request.method()} ${path}`);
      return route.fulfill({
        status: 403,
        json: { message: "No mutations authorized in this test" },
      });
    }
    return route.fulfill({ json: [] });
  });
  return { connectorReads, runs, writes, errors, rejectedRuns };
}

async function localLibrary(page: Page) {
  await page.getByRole("button", { name: "Local", exact: true }).click();
  await expect(libraryCard(page)).toBeVisible({ timeout: 30_000 });
}

async function addScore(page: Page) {
  await page.getByRole("button", { name: "Worlds", exact: true }).click();
  await page
    .locator(".plugin-card")
    .filter({ has: page.getByRole("heading", { name: "Score", exact: true }) })
    .getByRole("button")
    .click();
  await expect(worldNodes(page)).toHaveCount(1);
}

async function openRunPanel(page: Page) {
  if (!(await page.locator("#run-samples-panel").isVisible()))
    await page.getByRole("button", { name: /^(Toggle run panel|Run panel)$/ }).click();
  await page.locator("#run-root-panel").selectOption({ label: rootName });
  await page.locator("#run-samples-panel").fill(String(fixture.source.N));
}

async function attachScore(page: Page) {
  await openRunPanel(page);
  if (!(await page.locator('.svelte-flow__edge[data-id*="plugin-world:"]').count())) {
    // Arrange an ordinary persisted workspace so the two handles remain reachable
    // without fitting hundreds of far-away dependency nodes into the same viewport.
    await page.waitForTimeout(250);
    await page.addInitScript(
      ({ rootName }) => {
        if (window.top !== window || !sessionStorage.getItem("__arrangeNextLoad")) return;
        sessionStorage.removeItem("__arrangeNextLoad");
        const key = Object.keys(sessionStorage).find((k) =>
          k.startsWith("dcn_studio_tabs_session_v1:"),
        )!;
        const session = JSON.parse(sessionStorage.getItem(key)!);
        const tabId = session.activeTabId;
        for (const graph of [session.tabGraphs[tabId], session.connectorTreeModels[tabId]].filter(
          Boolean,
        )) {
          for (const node of graph.nodes) {
            if (node.data?.kind === "plugin") node.position = { x: 0, y: 0 };
            else if (node.data?.networkId === rootName || node.data?.label === rootName)
              node.position = { x: 30, y: 620 };
            else node.position = { x: node.position.x + 100000, y: node.position.y + 100000 };
          }
        }
        session.tabViewports[tabId] = { x: 120, y: 20, zoom: 0.7 };
        sessionStorage.setItem(key, JSON.stringify(session));
      },
      { rootName },
    );
    await page.evaluate(() => sessionStorage.setItem("__arrangeNextLoad", "1"));
    await page.reload();
    await expect(worldNodes(page)).toHaveCount(1);
    const root = connectorNamed(page, rootName);
    const pluginIn = root.locator('[data-handleid="plugin-in"]');
    const target = (await pluginIn.count()) ? pluginIn : root.locator('[data-handleid="in"]');
    await worldNodes(page).locator('[data-handleid="out"]').dragTo(target, { timeout: 15_000 });
  }
  await expect(page.locator('.svelte-flow__edge[data-id*="plugin-world:"]')).toHaveCount(1);
}

async function simulate(page: Page, state: Awaited<ReturnType<typeof setup>>) {
  await openRunPanel(page);
  await expect(page.getByRole("button", { name: "Simulate", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect.poll(() => state.runs.length, { timeout: 30_000 }).toBe(1);
  await expect(page.locator(".runner-status.is-success")).toContainText("Simulation completed", {
    timeout: 30_000,
  });
  expect(state.rejectedRuns).toEqual([]);
  expect(state.runs[0].connector_name).toBe(rootName);
  expect(Number(state.runs[0].particles_count)).toBe(fixture.source.N);
  const frame = worldNodes(page).frameLocator("iframe");
  if (scoreDist) {
    await expect(frame.locator('g.note[role="button"]')).toHaveCount(fixture.source.noteFragments, {
      timeout: 60_000,
    });
    const renderedIds = await frame
      .locator('g.note[role="button"]')
      .evaluateAll((notes) => notes.map((note) => note.id));
    expect(renderedIds.sort()).toEqual(Object.keys(fixture.noteSources).sort());
    expect(
      new Set(renderedIds.map((id) => (fixture.noteSources as Record<string, string>)[id])).size,
    ).toBe(fixture.source.logicalNotes);
    await expect(frame.getByRole("button", { name: "Play piano", exact: true })).toBeEnabled();
  } else {
    await expect
      .poll(
        async () =>
          JSON.parse((await frame.locator("#received").textContent()) || "{}").executeOutput
            ?.length,
      )
      .toBe(fixture.source.streamCount);
    const received = JSON.parse((await frame.locator("#received").textContent()) || "{}");
    expect(received.executeOutput).toEqual(fixture.simulation);
  }
  expect(state.connectorReads).toContain("pitch");
  expect(state.connectorReads).not.toContain("Loading connector...");
  expect(state.errors).toEqual([]);
  expect(state.writes).toEqual([]);
}

test("dragging the large Local tree preserves the World, hydrates its cold dependency, and remains removable", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const state = await setup(page);
  await page.goto("/studio");
  await addScore(page);
  const originalWorldId = await worldNodes(page).getAttribute("data-id");
  await localLibrary(page);
  expect(state.connectorReads).not.toContain("pitch");
  await expect(libraryCard(page)).toHaveAttribute("draggable", "true");
  await libraryCard(page).dragTo(page.getByRole("application", { name: "Flow canvas" }), {
    targetPosition: { x: 500, y: 300 },
  });
  await expect(connectorNamed(page, rootName)).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator(".graph-loading")).toHaveCount(0);
  await expect(worldNodes(page)).toHaveAttribute("data-id", originalWorldId!);
  await attachScore(page);
  await simulate(page, state);
  const root = connectorNamed(page, rootName);
  await root.locator(".connector-title").click();
  await root.focus();
  await root.press("Enter");
  await root.press("Backspace");
  await expect(connectorNamed(page, rootName)).toHaveCount(0);
  await expect(worldNodes(page)).toHaveAttribute("data-id", originalWorldId!);
});

test("opening the large Local tree cold and adding Score simulates all requested values", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const state = await setup(page);
  await page.goto("/studio");
  await localLibrary(page);
  expect(state.connectorReads).not.toContain("pitch");
  await libraryCard(page).getByTitle("Open in Studio").click();
  await expect(connectorNamed(page, rootName)).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator(".graph-loading")).toHaveCount(0);
  await addScore(page);
  await attachScore(page);
  await simulate(page, state);
});

test("restored partial large graph hydrates the saved dependency without replacing graph IDs, positions or RIs", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const state = await setup(page);
  await page.goto("/studio");
  await localLibrary(page);
  await libraryCard(page).getByTitle("Open in Studio").click();
  await expect(connectorNamed(page, rootName)).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator(".graph-loading")).toHaveCount(0);
  await addScore(page);
  await attachScore(page);
  await openRunPanel(page);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Object.keys(sessionStorage).filter((k) => k.startsWith("dcn_studio_tabs_session_v1:"))
            .length,
      ),
    )
    .toBe(1);
  await page.addInitScript(() => {
    if (window.top !== window || !sessionStorage.getItem("__partialNextLoad")) return;
    sessionStorage.removeItem("__partialNextLoad");
    const key = Object.keys(sessionStorage).find((k) =>
      k.startsWith("dcn_studio_tabs_session_v1:"),
    )!;
    const session = JSON.parse(sessionStorage.getItem(key)!);
    const tabId = session.activeTabId;
    const graph = session.tabGraphs[tabId];
    let placeholders = 0;
    for (const graphModel of [graph, session.connectorTreeModels[tabId]].filter(Boolean)) {
      for (const node of graphModel.nodes) {
        node.position = { x: node.position.x + 47, y: node.position.y + 29 };
        if (node.data?.networkId === "pitch") {
          delete node.data.networkId;
          node.data.label = "Loading connector...";
          placeholders++;
        }
      }
    }
    sessionStorage.setItem(key, JSON.stringify(session));
    sessionStorage.setItem(
      "__partialExpected",
      JSON.stringify({ key, tabId, placeholders, graph }),
    );
  });
  state.connectorReads.length = 0;
  await page.evaluate(() => sessionStorage.setItem("__partialNextLoad", "1"));
  await page.reload();
  const restored = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("__partialExpected")!),
  );
  expect(restored.placeholders).toBeGreaterThan(0);
  await expect(worldNodes(page)).toHaveCount(1);
  await expect(connectorNamed(page, rootName)).toHaveCount(1);
  await simulate(page, state);
  // Persistence is asynchronous; wait for the post-run graph snapshot.
  await page.waitForTimeout(250);
  const after = await page.evaluate(
    ({ key, tabId }) => JSON.parse(sessionStorage.getItem(key)!).tabGraphs[tabId],
    restored,
  );
  const shape = (graph: {
    nodes: Array<{ id: string; position: unknown; data: Record<string, unknown> }>;
    edges: unknown[];
  }) => ({
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      // Dimension cards follow their connector row after text is measured.
      // User-positioned connectors and Worlds must remain byte-identical.
      position: n.data.kind === "dimension" ? undefined : n.position,
      riStart: n.data.riStart,
      riShift: n.data.riShift,
      riLocked: n.data.riLocked,
    })),
    edges: graph.edges,
  });
  expect(shape(after)).toEqual(shape(restored.graph));
  expect(Object.keys(connectors[rootName].static_ri)).toHaveLength(fixture.source.staticRiCount);
});
