import { expect, test, type Page } from "@playwright/test";

const ownerA = `0x${"12".repeat(20)}`;
const ownerB = `0x${"34".repeat(20)}`;
const chainAddress = `0x${"ab".repeat(20)}`;
type Entity = {
  name: string;
  owner: string;
  address: string;
  dimensions?: Array<{
    transformations: Array<{ name: string; args: number[] }>;
    composite?: string;
  }>;
  args_count?: number;
};

async function setup(
  page: Page,
  mixed = false,
  session: "authenticated" | "services-only" | "anonymous" = "authenticated",
) {
  let owner = ownerA;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const entities: Record<string, Entity> = {
    LocalChild: {
      name: "LocalChild",
      owner: ownerA,
      address: "0x0",
      dimensions: [{ transformations: [] }],
    },
    OtherLocal: {
      name: "OtherLocal",
      owner: ownerB,
      address: "0x0",
      dimensions: [{ transformations: [] }],
    },
    NetworkChild: {
      name: "NetworkChild",
      owner: ownerB,
      address: chainAddress,
      dimensions: [{ transformations: [] }],
    },
    pitch: {
      name: "pitch",
      owner: ownerB,
      address: chainAddress,
      dimensions: [{ transformations: [{ name: "add", args: [1] }] }],
    },
    add: { name: "add", owner: ownerB, address: chainAddress, args_count: 1 },
    LocalTransform: { name: "LocalTransform", owner: ownerA, address: "0x0", args_count: 0 },
    LocalCondition: { name: "LocalCondition", owner: ownerA, address: "0x0", args_count: 0 },
    NetworkTransform: {
      name: "NetworkTransform",
      owner: ownerB,
      address: chainAddress,
      args_count: 0,
    },
    NetworkCondition: {
      name: "NetworkCondition",
      owner: ownerB,
      address: chainAddress,
      args_count: 0,
    },
  };
  const creates: Array<{ name: string; dimensions?: Entity["dimensions"] }> = [];
  const runs: string[] = [];
  const runRequests: Array<{ path: string; body: Record<string, unknown> }> = [];
  const chainAuthRequests: string[] = [];
  const publications: string[] = [];
  const publishedNames: string[] = [];
  const user = () => ({
    id: owner,
    ethereum_address: owner,
    display_name: "Local test user",
    profile_json: { public: { ethereum_address: owner } },
  });
  await page.route(/.*\/(?:services|chain)\/.*/, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    let body: unknown = [];
    if (path.includes("/chain/nonce/") || path.endsWith("/chain/auth")) {
      chainAuthRequests.push(path);
      // Public runs must work even when the auth service returns an incompatible challenge.
      body = { nonce: "393930" };
    } else if (path.endsWith("/auth/me")) body = { user: user() };
    else if (path.includes("/services/users/")) body = { user: user() };
    else if (path.endsWith("/services/users")) body = [user()];
    else if (path.includes("/chain/account/"))
      body = {
        // Mixed account discovery responses must be filtered by actual address and owner.
        owned_connectors: Object.values(entities)
          .filter((item) => item.dimensions)
          .map((item) => item.name),
        owned_transformations: ["LocalTransform", "NetworkTransform"],
        owned_conditions: ["LocalCondition", "NetworkCondition"],
      };
    else if (path.endsWith("/chain/feed"))
      body = {
        limit: 100,
        cursor: { has_more: false },
        items: ["NetworkChild", "pitch", "NetworkTransform", "NetworkCondition"].map((name, i) => {
          const kind = entities[name].dimensions
            ? "connector"
            : name.includes("Transform")
              ? "transformation"
              : "condition";
          return {
            feed_id: name,
            event_type: `${kind}_added`,
            status: "safe",
            visible: true,
            tx_hash: `0x${"cd".repeat(32)}`,
            block_number: 1,
            tx_index: i,
            log_index: 0,
            history_cursor: `0000000000000001:000${i}:0000`,
            created_at_ms: 1000 - i,
            updated_at_ms: 1000,
            projector_version: 1,
            payload: { type: kind, name, owner: ownerA },
          };
        }),
      };
    else if (path.endsWith("/chain/connector") && req.method() === "POST") {
      const input = req.postDataJSON();
      creates.push(input);
      if (entities[input.name])
        return route.fulfill({ status: 400, json: { message: "Already created" } });
      entities[input.name] = { ...input, owner, address: "0x0" };
      body = { name: input.name, owner, address: "0x0" };
    } else if (/\/chain\/(?:transformation|condition)$/.test(path) && req.method() === "POST") {
      const input = req.postDataJSON();
      creates.push(input);
      entities[input.name] = { name: input.name, owner, address: "0x0", args_count: 0 };
      body = entities[input.name];
    } else if (/\/chain\/(?:connector|transformation|condition)\//.test(path)) {
      body = entities[decodeURIComponent(path.split("/").at(-1)!)];
      if (!body) return route.fulfill({ status: 404, json: { message: "Not found" } });
    } else if (path.endsWith("/simulate") || path.endsWith("/execute")) {
      runs.push(path);
      const input = req.postDataJSON();
      runRequests.push({ path, body: input });
      const name = input.connector_name;
      const particles = [
        {
          path: `/${name}:0`,
          data:
            name === "pitch"
              ? Array.from({ length: Number(input.particles_count) }, (_, i) => i)
              : [0, 1, 2],
        },
      ];
      body = path.endsWith("/simulate")
        ? particles
        : {
            block_number: 10,
            block_hash: `0x${"ef".repeat(32)}`,
            runner: chainAddress,
            registry: chainAddress,
            particles,
          };
    } else if (path.includes("/publish/")) {
      publications.push(path);
      const input = req.postDataJSON();
      const kind = path.includes("/prepare") ? path.split("/").at(-2) : path.split("/").at(-1);
      if (path.endsWith("/prepare"))
        body = {
          status: "prepared",
          kind,
          name: input.name,
          address: chainAddress,
          content_hash: `0x${"cd".repeat(32)}`,
          publication_nonce: 0,
          deadline: 4000000000,
          transaction: {
            from: owner,
            to: chainAddress,
            chainId: "0xaa36a7",
            gas: "0x10000",
            data: "0xabcd",
          },
        };
      else {
        publishedNames.push(input.name);
        entities[input.name].address = chainAddress;
        body = {
          status: "mined",
          kind,
          name: input.name,
          owner,
          address: chainAddress,
          tx_hash: input.tx_hash,
          content_hash: input.content_hash,
          block_number: 9,
        };
      }
    }
    await route.fulfill({ status: 200, json: body });
  });
  await page.addInitScript(
    ({ ownerA, mixed, session }) => {
      if (session !== "anonymous") localStorage.setItem("hypermusic_token", "local-test-services");
      if (session === "authenticated") {
        localStorage.setItem("hypermusic_chain_token", "local-test-chain");
        localStorage.setItem("hypermusic_chain_token_user_id", `wallet:${ownerA}`);
      }
      Object.assign(window, {
        walletSends: 0,
        walletCalls: [] as string[],
        ethereum:
          session === "anonymous"
            ? undefined
            : {
                request: async ({ method }: { method: string }) => {
                  (window as unknown as { walletCalls: string[] }).walletCalls.push(method);
                  if (method === "eth_accounts" || method === "eth_requestAccounts")
                    return [ownerA];
                  if (method === "eth_chainId") return "0xaa36a7";
                  if (method === "eth_sendTransaction") {
                    (window as unknown as { walletSends: number }).walletSends++;
                    return `0x${"ab".repeat(32)}`;
                  }
                  throw new Error(`Unexpected wallet call ${method}`);
                },
              },
      });
      const connector = (name: string, root = false) => ({
        id: name,
        type: "connector",
        position: { x: root ? 300 : 200, y: root ? 100 : 400 },
        data: {
          label: name,
          kind: "connector",
          dimensions: root && mixed ? 2 : 1,
          connectorRows: Array.from({ length: root && mixed ? 2 : 1 }, (_, i) => ({
            dimension: i + 1,
            transformations: [],
          })),
          fromNetwork: !root,
          ...(root ? { tabRoot: true } : { networkId: name }),
          riPosition: 0,
          riStart: 0,
          riShift: 0,
          riLocked: false,
        },
      });
      const nodes = [
        connector("StudioRoot", true),
        ...(mixed ? [connector("LocalChild"), connector("NetworkChild")] : []),
      ];
      const edges = mixed
        ? ["LocalChild", "NetworkChild"].map((name, i) => ({
            id: `edge-${i}`,
            source: "StudioRoot",
            sourceHandle: `dim-${i}`,
            target: name,
            targetHandle: "in",
            data: { relation: "composite" },
          }))
        : [];
      sessionStorage.setItem(
        `dcn_studio_tabs_session_v1:https://api.decentralised.art/chain/:${ownerA}`,
        JSON.stringify({
          version: 1,
          tabs: [{ id: "draft", label: "StudioRoot" }],
          activeTabId: "draft",
          tabGraphs: { draft: { nodes, edges } },
          connectorTreeModels: {},
        }),
      );
    },
    { ownerA, mixed, session },
  );
  const openPublished = session !== "authenticated";
  await page.goto(openPublished ? "/studio?network_kind=connector&network_id=pitch" : "/studio");
  await expect(
    page.getByRole("tab", { name: openPublished ? /pitch/ : /StudioRoot/ }),
  ).toBeVisible();
  return {
    creates,
    runs,
    runRequests,
    chainAuthRequests,
    publications,
    publishedNames,
    errors,
    entities,
    switchOwner: async () => {
      owner = ownerB;
      await page.evaluate((ownerB) => {
        localStorage.setItem("hypermusic_token", "local-test-services-b");
        localStorage.setItem("hypermusic_chain_token_user_id", `wallet:${ownerB}`);
        window.dispatchEvent(new Event("auth:change"));
      }, ownerB);
    },
  };
}

const card = (page: Page, name: string) =>
  page
    .locator(".library-card")
    .filter({ has: page.locator(".item-name", { hasText: new RegExp(`^${name}$`) }) });

for (const session of ["anonymous", "services-only"] as const) {
  test(`published pitch supports simulation and execution without chain sign-in (${session})`, async ({
    page,
  }) => {
    const state = await setup(page, false, session);
    await page.getByRole("button", { name: "Toggle run panel", exact: true }).click();
    await expect(page.getByRole("button", { name: "Create locally", exact: true })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Publish to the Network", exact: true }),
    ).toBeDisabled();
    const simulate = page.getByRole("button", { name: "Simulate", exact: true });
    const execute = page.getByRole("button", { name: "Execute on the Network", exact: true });
    await expect(simulate).toBeEnabled();
    await expect(execute).toBeEnabled();
    await page.locator("#run-samples-panel").fill("4");
    await simulate.click();
    const output = page.locator(".runner-output");
    await expect(output).toContainText("/pitch:0");
    await expect(page.locator(".runner-status.is-success")).toContainText("Simulation completed");
    expect(JSON.parse(await output.innerText())).toEqual([
      { path: "/pitch:0", data: [0, 1, 2, 3] },
    ]);
    await expect(output).not.toContainText("block_number");
    await execute.click();
    await expect(output).toContainText('"block_number": 10');
    expect(JSON.parse(await output.innerText()).particles).toEqual([
      { path: "/pitch:0", data: [0, 1, 2, 3] },
    ]);
    // Switching back must discard the chain provenance from the previous execution.
    await simulate.click();
    await expect(page.locator(".runner-status.is-success")).toContainText("Simulation completed");
    await expect(output).not.toContainText("block_number");
    expect(state.runs).toEqual(["/chain/simulate", "/chain/execute", "/chain/simulate"]);
    for (const request of state.runRequests) {
      expect(request.body.connector_name).toBe("pitch");
      expect(Number(request.body.particles_count)).toBe(4);
    }
    expect(state.chainAuthRequests).toEqual([]);
    expect(state.creates).toEqual([]);
    expect(state.publications).toEqual([]);
    const walletCalls = await page.evaluate(
      () => (window as unknown as { walletCalls: string[] }).walletCalls,
    );
    expect(walletCalls).not.toContain("personal_sign");
    expect(walletCalls).not.toContain("eth_sendTransaction");
    expect(state.errors).toEqual([]);
  });
}

test("Local lists only owned server entities and Network lists only published entities", async ({
  page,
}) => {
  const state = await setup(page);
  await page.getByRole("button", { name: "Local", exact: true }).click();
  await expect(page.getByText("Your entities on the simulation server.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Refresh Local" })).toHaveClass(/runner-action/);
  await expect(card(page, "LocalChild")).toBeVisible();
  await expect(card(page, "OtherLocal")).toHaveCount(0);
  await expect(card(page, "NetworkChild")).toHaveCount(0);
  await expect(card(page, "LocalChild").getByTitle("Add to toolbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Transformations", exact: true }).click();
  await expect(card(page, "LocalTransform")).toBeVisible();
  await expect(card(page, "NetworkTransform")).toHaveCount(0);
  await page.getByRole("button", { name: "Conditions", exact: true }).click();
  await expect(card(page, "LocalCondition")).toBeVisible();
  await page.getByRole("button", { name: "Published", exact: true }).click();
  await expect(card(page, "NetworkCondition")).toBeVisible();
  await expect(card(page, "LocalCondition")).toHaveCount(0);
  expect(state.errors).toEqual([]);
});

test("creates once, simulates without gas, then explicitly publishes and executes on Sepolia", async ({
  page,
}) => {
  const state = await setup(page);
  await page.getByRole("button", { name: "Toggle run panel", exact: true }).click();
  const actionRows = page.locator(".runner-action-row");
  await expect(actionRows).toHaveCount(2);
  await expect(actionRows.nth(0).getByRole("button")).toHaveText(["Create locally", "Simulate"]);
  await expect(actionRows.nth(1).getByRole("button")).toHaveText([
    "Publish to the Network",
    "Execute on the Network",
  ]);
  await expect(page.getByRole("button", { name: "Simulate", exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Execute on the Network", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Create locally", exact: true }).click();
  await expect(card(page, "StudioRoot")).toBeVisible();
  await expect(page.getByRole("tab", { name: /StudioRoot/ })).toContainText("Local");
  await expect(page.locator(".connector-readonly-chip")).toHaveText("Created (read-only)");
  for (const [width, imageName] of [
    [1440, "local-wide.png"],
    [900, "local-compact.png"],
  ] as const) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole("button", { name: "Zoom to fit", exact: true }).click();
    const controls = page.locator(".runner-controls");
    await expect
      .poll(() => controls.evaluate((element) => element.scrollWidth <= element.clientWidth))
      .toBe(true);
    await expect(
      controls.getByRole("button", { name: "Publish to the Network", exact: true }),
    ).toBeInViewport();
    await page.screenshot({ path: test.info().outputPath(imageName), animations: "disabled" });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(page.locator(".runner-output")).toContainText("StudioRoot");
  expect(state.creates.map((item) => item.name)).toEqual(["StudioRoot"]);
  expect(state.runs).toEqual(["/chain/simulate"]);
  expect(
    await page.evaluate(() => (window as unknown as { walletSends: number }).walletSends),
  ).toBe(0);
  await page
    .locator(".runner-controls")
    .getByRole("button", { name: "Publish to the Network", exact: true })
    .click();
  await expect(page.getByRole("link", { name: "View transaction" })).toHaveAttribute(
    "href",
    `https://sepolia.etherscan.io/tx/0x${"ab".repeat(32)}`,
  );
  await expect(page.getByRole("link", { name: "View address" })).toHaveAttribute(
    "href",
    `https://sepolia.etherscan.io/address/${chainAddress}`,
  );
  await page.screenshot({
    path: test.info().outputPath("published.png"),
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  const receiptColors = await page.locator(".runner-publications").evaluate((receipt) => {
    const link = receipt.querySelector("a");
    return {
      background: getComputedStyle(receipt).backgroundColor,
      text: getComputedStyle(receipt).color,
      link: link ? getComputedStyle(link).color : "",
    };
  });
  expect(receiptColors).toMatchObject({
    background: "rgba(255, 255, 255, 0.86)",
    text: "rgb(16, 24, 39)",
    link: "rgb(6, 78, 59)",
  });
  await page.screenshot({
    path: test.info().outputPath("published-light.png"),
    animations: "disabled",
  });
  await expect(
    page.getByRole("button", { name: "Execute on the Network", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Execute on the Network", exact: true }).click();
  await expect(page.locator(".runner-output")).toContainText('"block_number": 10');
  expect(
    await page.evaluate(() => (window as unknown as { walletSends: number }).walletSends),
  ).toBe(1);
  expect(state.creates).toHaveLength(1);
  expect(state.errors).toEqual([]);
  await page.reload();
  await page.getByRole("button", { name: "Toggle run panel", exact: true }).click();
  await expect(page.getByRole("link", { name: "View transaction" })).toHaveAttribute(
    "href",
    `https://sepolia.etherscan.io/tx/0x${"ab".repeat(32)}`,
  );
});

test("account switching hides the previous owner's Local entries and open graph", async ({
  page,
}) => {
  const state = await setup(page);
  await page.getByRole("button", { name: "Local", exact: true }).click();
  await expect(card(page, "LocalChild")).toBeVisible();
  await card(page, "LocalChild").getByTitle("Open in Studio").click();
  await expect(page.getByRole("tab", { name: /LocalChild/ })).toBeVisible();
  await state.switchOwner();
  await expect(card(page, "OtherLocal")).toBeVisible();
  await expect(card(page, "LocalChild")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /LocalChild/ })).toHaveCount(0);
  expect(state.errors).toEqual([]);
});

test("mixed trees reuse existing Local and Network children without recreating or publishing them", async ({
  page,
}) => {
  const state = await setup(page, true);
  await page.getByRole("button", { name: "Toggle run panel", exact: true }).click();
  await page.getByRole("button", { name: "Create locally", exact: true }).click();
  await expect(page.getByRole("button", { name: "Simulate", exact: true })).toBeEnabled();
  expect(state.creates.map((item) => item.name)).toEqual(["StudioRoot"]);
  expect(state.creates[0].dimensions?.map((dimension) => dimension.composite)).toEqual([
    "LocalChild",
    "NetworkChild",
  ]);
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(page.locator(".runner-output")).toContainText("StudioRoot");
  expect(state.publications).toEqual([]);
  await page
    .locator(".runner-controls")
    .getByRole("button", { name: "Publish to the Network", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Execute on the Network", exact: true }),
  ).toBeEnabled();
  expect(state.publishedNames).toEqual(["LocalChild", "StudioRoot"]);
  expect(state.creates).toHaveLength(1);
  expect(state.errors).toEqual([]);
});

for (const kind of ["transformation", "condition"] as const) {
  test(`the ${kind} editor creates locally without sending a transaction`, async ({ page }) => {
    const state = await setup(page);
    await page.getByRole("button", { name: "Local", exact: true }).click();
    await page
      .getByRole("button", {
        name: kind === "transformation" ? "Transformations" : "Conditions",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: `New ${kind}`, exact: true }).click();
    const dialog = page.getByRole("dialog");
    const name = kind === "transformation" ? "MadeLocalTransform" : "MadeLocalCondition";
    await dialog.locator(kind === "transformation" ? "#tx-name" : "#condition-name").fill(name);
    await dialog.getByRole("button", { name: "Create locally", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(card(page, name)).toBeVisible();
    expect(state.creates.map((item) => item.name)).toEqual([name]);
    expect(state.publications).toEqual([]);
    expect(
      await page.evaluate(() => (window as unknown as { walletSends: number }).walletSends),
    ).toBe(0);
    expect(state.errors).toEqual([]);
  });
}
