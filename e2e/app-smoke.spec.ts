import { expect, test, type Locator, type Page } from "@playwright/test";

const collectPageErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  return () => expect(errors).toEqual([]);
};

const fixtureConnectorToolbox = [
  "pitch",
  "time",
  "test_random_transformation1234",
  "test_random_add_connector_20260420_01",
  "velocity",
  "duration",
  "test_midi_chromatic_in_time_stable_duration_and_velocity12345",
  "test_various_midi_values12345",
  "test_midi_polyphony089768",
  "test_connector_polyphony_every_second12345678456",
  "test_break_add2_56079",
  "A2_breath_return_layer_realized",
  "A2_breath_return_overlay",
  "A2_breath_return_overlay_realized",
];

const fixtureAddress = "0xb584a15f38c2014cff54fdb1b417428b51999276";
const unlistedChainAddress = "0xfa71ff2394596f824d69961293d095a50d322e4e";
const fixtureUserId = "playwright-user";
const fixtureEmail = "playwright-user@example.test";
const fixtureDisplayName = "Playwright User";

type RemoteApiObserver = {
  chainAccountRequests: string[];
  chainFeedRequests: string[];
};

const stubRemoteApis = async (
  page: Page,
  options: {
    authDisplayName?: string;
    missingProfileConnectorDetail?: boolean;
    publicDisplayName?: string;
  } = {},
) => {
  const observer: RemoteApiObserver = {
    chainAccountRequests: [],
    chainFeedRequests: [],
  };
  const authDisplayName = options.authDisplayName ?? fixtureDisplayName;
  const publicDisplayName = options.publicDisplayName ?? fixtureDisplayName;
  const buildFixtureUser = (displayName: string) => ({
    id: fixtureUserId,
    email: fixtureEmail,
    display_name: displayName,
    ethereum_address: fixtureAddress,
    profile_json: {
      public: {
        nickname: displayName,
        ethereum_address: fixtureAddress,
        toolbox: fixtureConnectorToolbox,
        toolbox_library: {
          connector: fixtureConnectorToolbox,
          transformation: [
            "subtract",
            "add",
            "test_add_new1234567",
            "test_random_20260419204115",
            "test_random_add_20260420_01",
          ],
          condition: [],
        },
      },
    },
  });
  const terminalScoreConnector = (name: string, formatHash: string) => ({
    name,
    owner: fixtureAddress,
    format_hash: formatHash,
    condition_name: "",
    condition_args: [],
    static_ri: {},
    dimensions: [
      {
        composite: null,
        transformations: [{ name: "add", args: [1] }],
      },
    ],
  });
  const collectorScoreConnector = (name: string, formatHash: string, composites: string[]) => ({
    name,
    owner: fixtureAddress,
    format_hash: formatHash,
    condition_name: "",
    condition_args: [],
    static_ri: {},
    dimensions: composites.map((composite) => ({
      composite,
      transformations: [{ name: "add", args: [1] }],
      bindings: {},
    })),
  });
  const openSlotScoreConnector = (name: string, formatHash: string, dimensions: number) => ({
    name,
    owner: fixtureAddress,
    format_hash: formatHash,
    condition_name: "",
    condition_args: [],
    static_ri: {},
    dimensions: Array.from({ length: dimensions }, () => ({
      composite: null,
      transformations: [{ name: "add", args: [1] }],
      bindings: {},
    })),
  });
  const scoreConnectors: Record<string, object> = {
    test_position_score_e2e_06052026: collectorScoreConnector(
      "test_position_score_e2e_06052026",
      "0x637d49f0ec85ec68c9abfedb750881d641ebab0bbbe046db6341b128edc42dae",
      ["score_position_note_table_e2e"],
    ),
    score_position_note_table_e2e: collectorScoreConnector(
      "score_position_note_table_e2e",
      "0xc9ea7ced7294c7b4ec0dfe5eebdb36ca1fe082d81ba79a1fc59f244530f99eca",
      ["score_quarter_note_tick_grid", "constant_value", "major_scale_steps"],
    ),
    score_quarter_note_tick_grid: terminalScoreConnector(
      "score_quarter_note_tick_grid",
      "0x0000000000000000000000000000000000000000000000000000000000002520",
    ),
    constant_value: terminalScoreConnector(
      "constant_value",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    ),
    major_scale_steps: terminalScoreConnector(
      "major_scale_steps",
      "0x0000000000000000000000000000000000000000000000000000000000000060",
    ),
    test_full_score_empty_100604052026: collectorScoreConnector(
      "test_full_score_empty_100604052026",
      "0x637d49f0ec85ec68c9abfedb750881d641ebab0bbbe046db6341b128edc42dae",
      ["score_full_v2"],
    ),
    score_full_v2: collectorScoreConnector(
      "score_full_v2",
      "0x637d49f0ec85ec68c9abfedb750881d641ebab0bbbe046db6341b128edc42dae",
      [
        "score_parts_v2",
        "score_meter_v2",
        "score_clefs_v2",
        "score_tempo_v2",
        "score_key_v2",
        "score_notes_v1",
        "score_articulations_v1",
        "score_slurs_v1",
      ],
    ),
    score_parts_v2: collectorScoreConnector(
      "score_parts_v2",
      "0x9ed0ef3e3aa74c0f4c7cf686947c7d87e98ab96f1829d742d834f568a8649e69",
      ["score_part", "score_staff_count"],
    ),
    score_meter_v2: collectorScoreConnector(
      "score_meter_v2",
      "0x30bf53a39f0173459fbc426e731a0f93d92b6bab2d8a14f37d2b84f6a427f891",
      ["score_meter_time_tick", "score_beats", "score_beat_type"],
    ),
    score_clefs_v2: collectorScoreConnector(
      "score_clefs_v2",
      "0xb7b53ff86e20bd391efe43a3da33bf1c7c19e00ce93a46a2394def287f1cabb9",
      [
        "score_clef_time_tick",
        "score_part",
        "score_staff",
        "score_clef_sign_code",
        "score_clef_line",
      ],
    ),
    score_tempo_v2: collectorScoreConnector(
      "score_tempo_v2",
      "0x7c3feb4f8faa57e3e5950ea982e24aeabaab504a774d2ba7e946cb2266e8c6db",
      ["score_tempo_time_tick", "score_tempo_bpm"],
    ),
    score_key_v2: collectorScoreConnector(
      "score_key_v2",
      "0xb5de85796928dc02bacbbd117de5b25f7277d670d37df3a50b5937da2d7343ab",
      ["score_key_time_tick", "score_key_fifths", "score_key_mode_code", "score_part"],
    ),
    score_notes_v1: openSlotScoreConnector(
      "score_notes_v1",
      "0xc9ea7ced7294c7b4ec0dfe5eebdb36ca1fe082d81ba79a1fc59f244530f99eca",
      9,
    ),
    score_articulations_v1: openSlotScoreConnector(
      "score_articulations_v1",
      "0x4b4ff5b5495d7cec306e7c4a6a423ab1d4ba857ba62886c07d4773ba963885ce",
      3,
    ),
    score_slurs_v1: openSlotScoreConnector(
      "score_slurs_v1",
      "0xefa4f226e9e87d8c40856130ba76cc86ed711baa10deba0f264f88d082d4fd8f",
      4,
    ),
    score_event_id: terminalScoreConnector("score_event_id", "0x0001"),
    score_onset: terminalScoreConnector("score_onset", "0x0002"),
    score_duration: terminalScoreConnector("score_duration", "0x0003"),
    score_pitch: terminalScoreConnector("score_pitch", "0x0004"),
    score_dynamic_code: terminalScoreConnector("score_dynamic_code", "0x0005"),
    score_part: terminalScoreConnector("score_part", "0x0006"),
    score_staff: terminalScoreConnector("score_staff", "0x0007"),
    score_voice: terminalScoreConnector("score_voice", "0x0008"),
    score_staff_count: terminalScoreConnector("score_staff_count", "0x0009"),
    score_meter_time_tick: terminalScoreConnector("score_meter_time_tick", "0x0010"),
    score_beats: terminalScoreConnector("score_beats", "0x0011"),
    score_beat_type: terminalScoreConnector("score_beat_type", "0x0012"),
    score_clef_time_tick: terminalScoreConnector("score_clef_time_tick", "0x0013"),
    score_clef_sign_code: terminalScoreConnector("score_clef_sign_code", "0x0014"),
    score_clef_line: terminalScoreConnector("score_clef_line", "0x0015"),
    score_tempo_time_tick: terminalScoreConnector("score_tempo_time_tick", "0x0016"),
    score_tempo_bpm: terminalScoreConnector("score_tempo_bpm", "0x0017"),
    score_key_time_tick: terminalScoreConnector("score_key_time_tick", "0x0018"),
    score_key_fifths: terminalScoreConnector("score_key_fifths", "0x0019"),
    score_key_mode_code: terminalScoreConnector("score_key_mode_code", "0x0020"),
    score_articulation_code: terminalScoreConnector("score_articulation_code", "0x0021"),
    score_placement: terminalScoreConnector("score_placement", "0x0022"),
    score_slur_number: terminalScoreConnector("score_slur_number", "0x0023"),
    score_slur_type: terminalScoreConnector("score_slur_type", "0x0024"),
  };

  await page.route(/.*\/(?:services|chain)\/.*/, async (route) => {
    const url = route.request().url();

    if (url.includes("/services/auth/me")) {
      const isServicesAuthenticated = route
        .request()
        .headers()
        .authorization?.startsWith("Bearer playwright-e2e-services-token");
      if (isServicesAuthenticated) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            user: buildFixtureUser(authDisplayName),
          }),
        });
        return;
      }

      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unauthorized" }),
      });
      return;
    }

    if (url.includes(`/services/users/${fixtureUserId}`)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: buildFixtureUser(publicDisplayName) }),
      });
      return;
    }

    if (url.includes("/services/users")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([buildFixtureUser(publicDisplayName)]),
      });
      return;
    }

    if (url.includes("/chain/feed/stream")) {
      observer.chainFeedRequests.push(url);
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
      observer.chainFeedRequests.push(url);
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
              feed_id: "feed-profile-connector",
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
                name: "profile_connector",
                owner: fixtureAddress,
              },
            },
            {
              feed_id: "feed-pitch",
              event_type: "connector_added",
              status: "safe",
              visible: true,
              tx_hash: "0xdef",
              block_number: 1,
              tx_index: 1,
              log_index: 0,
              history_cursor: "0000000000000001:0001:0000",
              created_at_ms: 900,
              updated_at_ms: 900,
              projector_version: 1,
              payload: {
                type: "connector",
                name: "pitch",
                owner: fixtureAddress,
              },
            },
            {
              feed_id: "feed-time",
              event_type: "connector_added",
              status: "safe",
              visible: true,
              tx_hash: "0x123",
              block_number: 1,
              tx_index: 2,
              log_index: 0,
              history_cursor: "0000000000000001:0002:0000",
              created_at_ms: 800,
              updated_at_ms: 800,
              projector_version: 1,
              payload: {
                type: "connector",
                name: "time",
                owner: fixtureAddress,
              },
            },
            {
              feed_id: "feed-unlisted-connector",
              event_type: "connector_added",
              status: "safe",
              visible: true,
              tx_hash: "0xfaa",
              block_number: 1,
              tx_index: 4,
              log_index: 0,
              history_cursor: "0000000000000001:0004:0000",
              created_at_ms: 600,
              updated_at_ms: 600,
              projector_version: 1,
              payload: {
                type: "connector",
                name: "unlisted_connector",
                owner: unlistedChainAddress,
              },
            },
            {
              feed_id: "feed-full-score",
              event_type: "connector_added",
              status: "safe",
              visible: true,
              tx_hash: "0xf05",
              block_number: 1,
              tx_index: 5,
              log_index: 0,
              history_cursor: "0000000000000001:0005:0000",
              created_at_ms: 500,
              updated_at_ms: 500,
              projector_version: 1,
              payload: {
                type: "connector",
                name: "test_full_score_empty_100604052026",
                owner: fixtureAddress,
              },
            },
            {
              feed_id: "feed-position-score",
              event_type: "connector_added",
              status: "safe",
              visible: true,
              tx_hash: "0xf06",
              block_number: 1,
              tx_index: 6,
              log_index: 0,
              history_cursor: "0000000000000001:0006:0000",
              created_at_ms: 450,
              updated_at_ms: 450,
              projector_version: 1,
              payload: {
                type: "connector",
                name: "test_position_score_e2e_06052026",
                owner: fixtureAddress,
              },
            },
            {
              feed_id: "feed-add",
              event_type: "transformation_added",
              status: "safe",
              visible: true,
              tx_hash: "0x456",
              block_number: 1,
              tx_index: 3,
              log_index: 0,
              history_cursor: "0000000000000001:0003:0000",
              created_at_ms: 700,
              updated_at_ms: 700,
              projector_version: 1,
              payload: {
                type: "transformation",
                name: "add",
                owner: fixtureAddress,
              },
            },
          ],
        }),
      });
      return;
    }

    if (url.includes("/chain/account")) {
      observer.chainAccountRequests.push(url);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    const scoreConnectorMatch = url.match(/\/chain\/connector\/([^/?#]+)/);
    if (scoreConnectorMatch) {
      const connectorName = decodeURIComponent(scoreConnectorMatch[1]);
      const connector = scoreConnectors[connectorName];
      if (connector) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(connector),
        });
        return;
      }
    }

    if (url.includes("/chain/connector/unlisted_connector")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          name: "unlisted_connector",
          owner: unlistedChainAddress,
          format_hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          dimensions: [
            {
              composite: null,
              transformations: [],
            },
          ],
        }),
      });
      return;
    }

    if (url.includes("/chain/connector/profile_connector")) {
      if (options.missingProfileConnectorDetail) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ message: "Not found" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          name: "profile_connector",
          owner: fixtureAddress,
          format_hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          dimensions: [
            {
              composite: null,
              transformations: [],
            },
          ],
        }),
      });
      return;
    }

    if (url.includes("/chain/connector/pitch") || url.includes("/chain/connector/time")) {
      const connectorName = url.includes("/chain/connector/pitch") ? "pitch" : "time";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          name: connectorName,
          owner: fixtureAddress,
          format_hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          dimensions: [
            {
              composite: null,
              transformations: [],
            },
          ],
        }),
      });
      return;
    }

    if (url.includes("/chain/transformation/add")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          name: "add",
          owner: fixtureAddress,
          sol_src: "return x + args[0];",
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

  return observer;
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

const seedRestoredConnectorPluginSession = async (page: Page) => {
  await page.addInitScript(() => {
    const rootNode = {
      id: "connector-profile_connector-restored",
      type: "connector",
      draggable: true,
      position: { x: 360, y: 120 },
      data: {
        label: "profile_connector",
        kind: "connector",
        dimensions: 1,
        connectorRows: [{ dimension: 1, transformations: [] }],
        conditionLabel: null,
        sourceId: "feature-profile_connector",
        networkId: "profile_connector",
        fromNetwork: true,
        tabRoot: true,
        hideOutlets: false,
        riPosition: 0,
        riStart: 0,
        riShift: 0,
        riLocked: false,
      },
    };
    const pluginNode = {
      id: "plugin-midi-clip-export-v1-restored",
      type: "plugin",
      draggable: true,
      position: { x: 360, y: 360 },
      data: {
        label: "MIDI Clip Export",
        kind: "plugin",
        sourceId: "midi-clip-export-v1",
        fromNetwork: true,
      },
    };
    const pluginEdge = {
      id: "edge-plugin-midi-clip-export-v1-restored-profile_connector",
      source: pluginNode.id,
      sourceHandle: "out",
      target: rootNode.id,
      targetHandle: "plugin-in",
      label: "plugin",
      data: { relation: "plugin", pluginId: "midi-clip-export-v1" },
    };

    window.sessionStorage.setItem(
      "dcn_studio_tabs_session_v1",
      JSON.stringify({
        version: 1,
        tabs: [
          {
            id: "tab-profile-connector",
            label: "profile_connector",
            particleId: "profile_connector",
          },
        ],
        activeTabId: "tab-profile-connector",
        tabGraphs: {
          "tab-profile-connector": {
            nodes: [rootNode, pluginNode],
            edges: [pluginEdge],
          },
        },
        connectorTreeModels: {
          "tab-profile-connector": {
            rootConnectorName: "profile_connector",
            nodes: [rootNode],
            edges: [],
          },
        },
      }),
    );
  });
};

const seedRestoredScorePluginSession = async (page: Page) => {
  await page.addInitScript(() => {
    const rootNode = {
      id: "connector-score-root-restored",
      type: "connector",
      draggable: true,
      position: { x: 280, y: 120 },
      data: {
        label: "score_root",
        kind: "connector",
        dimensions: 4,
        connectorRows: [
          { dimension: 1, transformations: [] },
          { dimension: 2, transformations: [] },
          { dimension: 3, transformations: [] },
          { dimension: 4, transformations: [] },
        ],
        conditionLabel: null,
        sourceId: "feature-score_root",
        networkId: "score_root",
        fromNetwork: true,
        tabRoot: true,
        hideOutlets: false,
        riPosition: 0,
        riStart: 0,
        riShift: 0,
        riLocked: false,
      },
    };
    const pluginNode = {
      id: "plugin-music-score-v1-restored",
      type: "plugin",
      draggable: true,
      position: { x: 280, y: 420 },
      data: {
        label: "Music Score",
        kind: "plugin",
        sourceId: "music-score-v1",
        fromNetwork: true,
        pluginTargets: ["score_root"],
        pluginData: {
          pluginId: "music-score-v1",
          connectorTargets: ["score_root"],
          streams: [
            { feature_path: "/score_root:0/pitch_midi:0", data: [60, 64, 67] },
            { feature_path: "/score_root:0/onset_tick:0", data: [0, 2520, 5040] },
            { feature_path: "/score_root:0/duration_tick:0", data: [2520, 2520, 5040] },
            { feature_path: "/score_root:0/velocity_midi:0", data: [64, 80, 96] },
          ],
          midiGroups: [
            {
              groupPath: "/score_root:0",
              pitch: { feature_path: "/score_root:0/pitch:0", data: [60, 64, 67] },
              time: { feature_path: "/score_root:0/time:0", data: [0, 1, 2] },
              duration: { feature_path: "/score_root:0/duration:0", data: [1, 1, 2] },
              velocity: { feature_path: "/score_root:0/velocity:0", data: [64, 80, 96] },
            },
          ],
        },
      },
    };
    const pluginEdge = {
      id: "edge-plugin-music-score-v1-restored-score-root",
      source: pluginNode.id,
      sourceHandle: "out",
      target: rootNode.id,
      targetHandle: "plugin-in",
      label: "plugin",
      data: { relation: "plugin", pluginId: "music-score-v1" },
    };

    window.sessionStorage.setItem(
      "dcn_studio_tabs_session_v1",
      JSON.stringify({
        version: 1,
        tabs: [
          {
            id: "tab-score-root",
            label: "score_root",
            particleId: "score_root",
          },
        ],
        activeTabId: "tab-score-root",
        tabGraphs: {
          "tab-score-root": {
            nodes: [rootNode, pluginNode],
            edges: [pluginEdge],
          },
        },
        connectorTreeModels: {
          "tab-score-root": {
            rootConnectorName: "score_root",
            nodes: [rootNode],
            edges: [],
          },
        },
      }),
    );
  });
};

const seedRawFullScorePluginSession = async (page: Page) => {
  await page.addInitScript(() => {
    const values = Array.from({ length: 12 }, (_, index) => index);
    const stream = (path: string) => ({
      feature_path: `/test_full_score_empty_100604052026:0/score_full_v2:${path}`,
      data: values,
    });
    const rootNode = {
      id: "connector-raw-full-score-restored",
      type: "connector",
      draggable: true,
      position: { x: 280, y: 120 },
      data: {
        label: "test_full_score_empty_100604052026",
        kind: "connector",
        dimensions: 1,
        connectorRows: [{ dimension: 1, transformations: ["add (1)"] }],
        conditionLabel: null,
        sourceId: "feature-test_full_score_empty_100604052026",
        networkId: "test_full_score_empty_100604052026",
        fromNetwork: true,
        tabRoot: true,
        hideOutlets: false,
        riPosition: 0,
        riStart: 0,
        riShift: 0,
        riLocked: false,
      },
    };
    const pluginNode = {
      id: "plugin-music-score-v1-raw-full-score",
      type: "plugin",
      draggable: true,
      position: { x: 280, y: 420 },
      data: {
        label: "Music Score",
        kind: "plugin",
        sourceId: "music-score-v1",
        fromNetwork: true,
        pluginTargets: ["test_full_score_empty_100604052026"],
        pluginData: {
          pluginId: "music-score-v1",
          connectorTargets: ["test_full_score_empty_100604052026"],
          streams: [
            stream("0/score_parts_v2:0/score_part:0"),
            stream("0/score_parts_v2:1/score_staff_count:0"),
            stream("1/score_meter_v2:0/score_meter_time_tick:0"),
            stream("1/score_meter_v2:1/score_beats:0"),
            stream("1/score_meter_v2:2/score_beat_type:0"),
            stream("2/score_clefs_v2:0/score_clef_time_tick:0"),
            stream("2/score_clefs_v2:1/score_part:0"),
            stream("2/score_clefs_v2:2/score_staff:0"),
            stream("2/score_clefs_v2:3/score_clef_sign_code:0"),
            stream("2/score_clefs_v2:4/score_clef_line:0"),
            stream("3/score_tempo_v2:0/score_tempo_time_tick:0"),
            stream("3/score_tempo_v2:1/score_tempo_bpm:0"),
            stream("4/score_key_v2:0/score_key_time_tick:0"),
            stream("4/score_key_v2:1/score_key_fifths:0"),
            stream("4/score_key_v2:2/score_key_mode_code:0"),
            stream("4/score_key_v2:3/score_part:0"),
            stream("5/score_notes_v1:0"),
            stream("5/score_notes_v1:1"),
            stream("5/score_notes_v1:2"),
            stream("5/score_notes_v1:3"),
            stream("5/score_notes_v1:4"),
            stream("5/score_notes_v1:5"),
            stream("5/score_notes_v1:6"),
            stream("5/score_notes_v1:7"),
            stream("5/score_notes_v1:8"),
          ],
          midiGroups: [],
        },
      },
    };
    const pluginEdge = {
      id: "edge-plugin-music-score-v1-raw-full-score",
      source: pluginNode.id,
      sourceHandle: "out",
      target: rootNode.id,
      targetHandle: "plugin-in",
      label: "plugin",
      data: { relation: "plugin", pluginId: "music-score-v1" },
    };

    window.sessionStorage.setItem(
      "dcn_studio_tabs_session_v1",
      JSON.stringify({
        version: 1,
        tabs: [
          {
            id: "tab-raw-full-score",
            label: "test_full_score_empty_100604052026",
            particleId: "test_full_score_empty_100604052026",
          },
        ],
        activeTabId: "tab-raw-full-score",
        tabGraphs: {
          "tab-raw-full-score": {
            nodes: [rootNode, pluginNode],
            edges: [pluginEdge],
          },
        },
        connectorTreeModels: {
          "tab-raw-full-score": {
            rootConnectorName: "test_full_score_empty_100604052026",
            nodes: [rootNode],
            edges: [],
          },
        },
      }),
    );
  });
};

const seedMovableConnectorTreeSession = async (page: Page) => {
  await page.addInitScript(() => {
    const makeConnector = (
      id: string,
      label: string,
      x: number,
      y: number,
      dimensions = 1,
      selected = false,
    ) => ({
      id,
      type: "connector",
      draggable: true,
      position: { x, y },
      selected,
      data: {
        label,
        kind: "connector",
        dimensions,
        connectorRows: Array.from({ length: dimensions }, (_, index) => ({
          dimension: index + 1,
          transformations: [],
        })),
        conditionLabel: null,
        sourceId: `feature-${label}`,
        networkId: label,
        fromNetwork: true,
        tabRoot: false,
        hideOutlets: false,
        riPosition: 0,
        riStart: 0,
        riShift: 0,
        riLocked: false,
      },
    });

    const notesNode = makeConnector(
      "connector-template-notes",
      "score_notes_v1",
      520,
      260,
      2,
      true,
    );
    const eventIdNode = makeConnector(
      "connector-template-event-id",
      "score_event_id",
      420,
      560,
      1,
      true,
    );
    const pitchNode = makeConnector("connector-template-pitch", "score_pitch", 720, 560, 1, true);
    const templateEdges = [
      {
        id: "edge-template-notes-event-id",
        source: notesNode.id,
        sourceHandle: "dim-0",
        target: eventIdNode.id,
        targetHandle: "in",
        label: "composite · D1",
        data: { relation: "composite" },
      },
      {
        id: "edge-template-notes-pitch",
        source: notesNode.id,
        sourceHandle: "dim-1",
        target: pitchNode.id,
        targetHandle: "in",
        label: "composite · D2",
        data: { relation: "composite" },
      },
    ];

    window.sessionStorage.setItem(
      "dcn_studio_tabs_session_v1",
      JSON.stringify({
        version: 1,
        tabs: [{ id: "tab-movable-connectors", label: "template_workbench" }],
        activeTabId: "tab-movable-connectors",
        tabGraphs: {
          "tab-movable-connectors": {
            nodes: [notesNode, eventIdNode, pitchNode],
            edges: templateEdges,
          },
        },
        connectorTreeModels: {},
      }),
    );
  });
};

test("renders the public landing page for anonymous root visitors", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);

  await page.goto("/");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /A decentralised API for/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Worlds" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Login with MetaMask" }).first()).toBeVisible();
  assertNoPageErrors();
});

const protectedRouteCases = ["/studio", "/network", "/account", "/create"];

protectedRouteCases.forEach((path) => {
  test(`gates anonymous ${path} visitors behind MetaMask login`, async ({ page }) => {
    const assertNoPageErrors = collectPageErrors(page);
    await stubRemoteApis(page);

    await page.goto(path);

    if (path === "/create") {
      await expect(page).toHaveURL(/\/studio$/);
    } else {
      await expect(page).toHaveURL(new RegExp(`${path.replace("/", "\\/")}$`));
    }
    await expect(page.getByText("Login with MetaMask to continue.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Login with MetaMask" }).first()).toBeVisible();
    if (path === "/studio") {
      await expect(page.getByRole("application", { name: "Flow canvas" })).toHaveCount(0);
    }
    if (path === "/network") {
      await expect(page.getByRole("region", { name: "Activity feed" })).toHaveCount(0);
    }
    assertNoPageErrors();
  });
});

test("redirects anonymous login visitors to the landing page", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);

  await page.goto("/login");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /A decentralised API for/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Login with MetaMask" }).first()).toBeVisible();
  assertNoPageErrors();
});

test("keeps old /app world links working through redirects", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);

  await page.goto("/app/worlds");

  await expect(page).toHaveURL(/\/worlds$/);
  await expect(page.locator('section[aria-label="Available worlds"]')).toBeVisible();
  assertNoPageErrors();
});

test("redirects authenticated login visitors to Network", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/login");

  await expect(page).toHaveURL(/\/network$/);
  await expect(page.getByRole("region", { name: "Activity feed" })).toBeVisible();
  assertNoPageErrors();
});

test("renders the Studio workspace shell", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/studio");

  await expect(page.getByRole("tab", { name: /Untitled Connector/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "New Connector", exact: true })).toBeVisible();
  await expect(page.getByRole("application", { name: "Flow canvas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Toggle assistant panel" }).first()).toBeVisible();
  assertNoPageErrors();
});

test("opens new connector tabs with a reset root-focused viewport", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/studio");

  const canvas = page.getByRole("application", { name: "Flow canvas" });
  await expect(canvas).toBeVisible();
  await expect(
    page.locator(".connector-node").filter({ hasText: "Untitled Connector" }),
  ).toBeVisible();

  const viewport = page.locator(".svelte-flow__viewport");
  const getViewportScale = async () =>
    viewport.evaluate((element) => {
      const transform = window.getComputedStyle(element).transform;
      if (!transform || transform === "none") return 1;
      return new DOMMatrixReadOnly(transform).a;
    });

  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error("Expected Studio canvas to have a bounding box.");
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
  await page.mouse.wheel(0, 2200);
  await expect.poll(getViewportScale, { timeout: 5_000 }).toBeLessThan(0.85);

  await page.getByRole("button", { name: "Create new connector tab" }).click();

  const newRoot = page.locator(".connector-node").filter({ hasText: "Untitled Connector 2" });
  await expect(newRoot).toBeVisible();
  await expect.poll(getViewportScale, { timeout: 5_000 }).toBeGreaterThan(0.95);
  await expect(newRoot).toBeInViewport();

  await page.getByRole("tab", { name: /Untitled Connector in-progress/ }).click();
  await expect.poll(getViewportScale, { timeout: 5_000 }).toBeLessThan(0.85);

  await page.getByRole("tab", { name: /Untitled Connector 2 in-progress/ }).click();
  await expect.poll(getViewportScale, { timeout: 5_000 }).toBeGreaterThan(0.95);
  assertNoPageErrors();
});

test("attaches worlds to the draft root connector", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/studio");
  await page.getByRole("button", { name: "Worlds", exact: true }).click();

  const musicScorePlugin = page.locator(".plugin-card").filter({ hasText: "MusicXML Score World" });
  await musicScorePlugin.getByRole("button", { name: "+" }).click();

  await expect(page.locator(".plugins-feedback")).toContainText(
    "Connected 'MusicXML Score World' to 'Untitled Connector'.",
  );
  await expect(
    page.locator(".plugin-node").filter({ hasText: "MusicXML Score World" }),
  ).toContainText("connected to Untitled Connector");
  await expect(
    page
      .locator(".plugin-node")
      .filter({ hasText: "MusicXML Score World" })
      .getByLabel("Empty music score preview"),
  ).toBeVisible();
  await expect(
    page.locator('.svelte-flow__edge[data-id^="edge-plugin-music-score-v1"]'),
  ).toHaveCount(1);
  assertNoPageErrors();
});

test("renders the resolvable saved connector toolbox in Studio", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/studio");
  const toolboxTab = page.getByRole("button", { name: "Toolbox", exact: true });
  await expect(toolboxTab).toBeVisible({ timeout: 15_000 });
  await toolboxTab.click();

  await expect(page.getByRole("link", { name: "pitch", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "time", exact: true })).toBeVisible();
  await expect(page.getByText("test_midi_polyphony089768")).toHaveCount(0);
  await expect(page.getByText("A2_breath_return_overlay_realized")).toHaveCount(0);
  await expect(page.getByText("test_random_add_connector_20260420_01")).toHaveCount(0);
  await expect(page.getByText("score-weave")).toHaveCount(0);
  await expect(page.getByText("aurora-still")).toHaveCount(0);
  assertNoPageErrors();
});

test("does not expose the removed Templates source in Studio", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/studio");
  await expect(page.getByRole("button", { name: "Connectors", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: "Templates", exact: true })).toHaveCount(0);
  await expect(page.locator(".templates-panel")).toHaveCount(0);
  assertNoPageErrors();
});

test("renders the Network shell", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  const remoteApis = await stubRemoteApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/network");

  await expect(page.getByRole("region", { name: "Activity feed" })).toBeVisible();
  await expect(page.getByRole("link", { name: "profile_connector" })).toBeVisible({
    timeout: 15_000,
  });
  expect(remoteApis.chainFeedRequests.some((url) => url.includes("/chain/feed"))).toBe(true);
  expect(remoteApis.chainAccountRequests).toEqual([]);
  assertNoPageErrors();
});

test("opens and adds a Studio Network connector discovered from the feed", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  const remoteApis = await stubRemoteApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/studio");

  const profileConnectorCard = page
    .getByRole("listitem")
    .filter({ hasText: "profile_connector" })
    .first();
  await expect(profileConnectorCard).toBeVisible({ timeout: 15_000 });
  await profileConnectorCard.getByTitle("Add to flow").click();
  await expect(
    page.locator(".connector-node").filter({ hasText: "profile_connector" }),
  ).toBeVisible();

  await profileConnectorCard.getByTitle("Open in Studio").click();
  await expect(page.getByRole("tab", { name: /profile_connector/ })).toBeVisible();
  expect(remoteApis.chainFeedRequests.some((url) => url.includes("/chain/feed"))).toBe(true);
  expect(remoteApis.chainAccountRequests).toEqual([]);
  assertNoPageErrors();
});

test("loads deployed positional score connector trees with reusable shapers", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/studio");

  const scoreCard = page
    .getByRole("listitem")
    .filter({ hasText: "test_position_score_e2e_06052026" })
    .first();
  await expect(scoreCard).toBeVisible({ timeout: 15_000 });
  await scoreCard.getByTitle("Add to flow").click();

  await expect(
    page.locator(".connector-node").filter({ hasText: "test_position_score_e2e_06052026" }),
  ).toHaveCount(1);
  await expect(
    page.locator(".connector-node").filter({ hasText: "score_position_note_table_e2e" }),
  ).toHaveCount(1);
  await expect(
    page.locator(".connector-node").filter({ hasText: "score_quarter_note_tick_grid" }),
  ).toHaveCount(1);
  await expect(page.locator(".connector-node").filter({ hasText: "constant_value" })).toHaveCount(
    1,
  );
  await expect(
    page.locator(".connector-node").filter({ hasText: "major_scale_steps" }),
  ).toHaveCount(1);
  await expect(page.locator(".connector-node").filter({ hasText: "score_onset" })).toHaveCount(0);
  await expect(page.locator(".connector-node").filter({ hasText: "score_pitch" })).toHaveCount(0);
  assertNoPageErrors();
});

test("keeps restored Studio connector trees when plugin overlays are present", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page, { missingProfileConnectorDetail: true });
  await authenticateFixtureSession(page);
  await seedRestoredConnectorPluginSession(page);

  const restoredConnector = page
    .locator(".connector-node")
    .filter({ hasText: "profile_connector" });
  const restoredPlugin = page.locator(".plugin-node").filter({ hasText: "MIDI Clip Export" });
  const networkConnectorCard = page
    .getByRole("listitem")
    .filter({ hasText: "profile_connector" })
    .first();

  await page.goto("/studio");
  await expect(networkConnectorCard).toBeVisible({ timeout: 15_000 });
  await expect(restoredConnector).toBeVisible();
  await expect(restoredPlugin).toBeVisible();

  await page.goto("/network");
  await expect(page.getByRole("region", { name: "Activity feed" })).toBeVisible();

  await page.goto("/studio");
  await expect(networkConnectorCard).toBeVisible({ timeout: 15_000 });
  await expect(restoredConnector).toBeVisible();
  await expect(restoredPlugin).toBeVisible();
  assertNoPageErrors();
});

test("keeps multi-selected Studio connector trees at their dragged positions after deselect", async ({
  page,
}) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page);
  await authenticateFixtureSession(page);
  await seedMovableConnectorTreeSession(page);

  await page.goto("/studio");
  const canvas = page.getByRole("application", { name: "Flow canvas" });
  await expect(canvas).toBeVisible({ timeout: 15_000 });

  async function getRequiredBox(locator: Locator, label = "element") {
    const box = await locator.boundingBox();
    if (!box) throw new Error(`Expected ${label} to have a bounding box.`);
    return box;
  }

  const pane = page.locator(".svelte-flow__pane").first();
  await expect(pane).toBeVisible();

  const notesNode = page.locator(".connector-node").filter({ hasText: "score_notes_v1" });
  const eventIdNode = page.locator(".connector-node").filter({ hasText: "score_event_id" });
  const pitchNode = page.locator(".connector-node").filter({ hasText: "score_pitch" });
  await expect(notesNode).toBeVisible();
  await expect(eventIdNode).toBeVisible();
  await expect(pitchNode).toBeVisible();

  const notesBefore = await getRequiredBox(notesNode, "score_notes_v1 connector node");
  const eventIdBefore = await getRequiredBox(eventIdNode, "score_event_id connector node");
  const pitchBefore = await getRequiredBox(pitchNode, "score_pitch connector node");

  await expect(page.locator(".svelte-flow__node.selected")).toHaveCount(3);

  const dragStartX = notesBefore.x + Math.min(notesBefore.width / 2, 120);
  const dragStartY = notesBefore.y + 24;
  await page.mouse.move(dragStartX, dragStartY);
  await page.mouse.down();
  await page.mouse.move(dragStartX + 90, dragStartY + 60, { steps: 8 });
  await page.mouse.up();

  const canvasBox = await getRequiredBox(canvas, "Studio flow canvas");
  const selectedBoxesAfterDrag = await Promise.all(
    [notesNode, eventIdNode, pitchNode].map((locator) => getRequiredBox(locator)),
  );
  const clearCandidates = [
    { x: canvasBox.x + 32, y: canvasBox.y + 32 },
    { x: canvasBox.x + 32, y: canvasBox.y + canvasBox.height - 32 },
    { x: canvasBox.x + canvasBox.width - 32, y: canvasBox.y + 32 },
    { x: canvasBox.x + canvasBox.width - 32, y: canvasBox.y + canvasBox.height - 32 },
    { x: canvasBox.x + canvasBox.width / 2, y: canvasBox.y + 32 },
  ];
  const clearPoint = clearCandidates.find(
    (point) =>
      !selectedBoxesAfterDrag.some(
        (box) =>
          point.x >= box.x - 12 &&
          point.x <= box.x + box.width + 12 &&
          point.y >= box.y - 12 &&
          point.y <= box.y + box.height + 12,
      ),
  );
  if (!clearPoint) throw new Error("Expected an empty canvas point for clearing selection.");
  await page.mouse.click(clearPoint.x, clearPoint.y);
  await expect(page.locator(".svelte-flow__node.selected")).toHaveCount(0);
  await page.waitForTimeout(600);

  const notesAfter = await getRequiredBox(notesNode, "score_notes_v1 connector node after drag");
  const eventIdAfter = await getRequiredBox(
    eventIdNode,
    "score_event_id connector node after drag",
  );
  const pitchAfter = await getRequiredBox(pitchNode, "score_pitch connector node after drag");
  expect(notesAfter.x).toBeGreaterThan(notesBefore.x + 40);
  expect(eventIdAfter.x).toBeGreaterThan(eventIdBefore.x + 40);
  expect(pitchAfter.x).toBeGreaterThan(pitchBefore.x + 40);
  assertNoPageErrors();
});

test("renders restored Music Score plugin notation in Studio", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page);
  await authenticateFixtureSession(page);
  await seedRestoredScorePluginSession(page);

  await page.goto("/studio");

  const restoredPlugin = page.locator(".plugin-node").filter({ hasText: "Music Score" });
  await expect(restoredPlugin).toBeVisible();
  await expect(restoredPlugin.getByRole("button", { name: "Download MusicXML" })).toBeVisible();
  await expect(restoredPlugin.frameLocator("iframe").locator(".score-osmd svg")).toBeVisible({
    timeout: 15_000,
  });
  assertNoPageErrors();
});

test("shows an empty staff for raw unconnected full-score archetype output", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page);
  await authenticateFixtureSession(page);
  await seedRawFullScorePluginSession(page);

  await page.goto("/studio");

  const restoredPlugin = page.locator(".plugin-node").filter({ hasText: "Music Score" });
  await expect(restoredPlugin).toBeVisible();
  await expect(restoredPlugin.getByLabel("Empty music score preview")).toBeVisible();
  await expect(restoredPlugin.locator(".score-osmd svg")).toHaveCount(0);
  await expect(restoredPlugin.locator(".score-render-status.is-error")).toHaveCount(0);
  assertNoPageErrors();
});

test("renders account activity from feed events owned by the current chain address", async ({
  page,
}) => {
  const assertNoPageErrors = collectPageErrors(page);
  const remoteApis = await stubRemoteApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/account");

  await expect(page.getByRole("link", { name: "profile_connector" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("No activity by this user yet.")).toHaveCount(0);
  expect(remoteApis.chainFeedRequests.some((url) => url.includes("/chain/feed"))).toBe(true);
  expect(remoteApis.chainAccountRequests).toEqual([]);
  assertNoPageErrors();
});

test("renders public profile activity from the chain feed", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page);
  await authenticateFixtureSession(page);

  await page.goto(`/u/${fixtureAddress}`);

  await expect(page.getByRole("link", { name: "profile_connector" })).toBeVisible();
  await expect(page.getByText("No activity by this user yet.")).toHaveCount(0);
  assertNoPageErrors();
});

test("uses fresh current profile data for the logged-in user's public page", async ({ page }) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page, {
    authDisplayName: "sunsetsobserver",
    publicDisplayName: "Adam",
  });
  await authenticateFixtureSession(page);

  await page.goto(`/u/${fixtureAddress}`);

  await expect(page.locator(".profile-main input").first()).toHaveValue("sunsetsobserver");
  await expect(page.getByRole("button", { name: "Edit profile" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Follow", exact: true })).toHaveCount(0);
  assertNoPageErrors();
});

test("opens an unlisted chain address from Network search without social counters", async ({
  page,
}) => {
  const assertNoPageErrors = collectPageErrors(page);
  await stubRemoteApis(page);
  await authenticateFixtureSession(page);

  await page.goto("/network");

  await page
    .getByPlaceholder("Search users, connectors, transformations, conditions")
    .fill(unlistedChainAddress);

  const addressResult = page.getByRole("listitem").filter({ hasText: unlistedChainAddress });
  await expect(addressResult).toBeVisible();
  await addressResult.getByRole("link", { name: unlistedChainAddress }).click();

  await expect(page).toHaveURL(new RegExp(`/u/${unlistedChainAddress}$`));
  await expect(page.locator(".profile-main input").first()).toHaveValue(unlistedChainAddress);
  await expect(page.locator(".profile-main input").last()).toHaveValue(unlistedChainAddress);
  await expect(page.getByRole("button", { name: /^Followers/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Following/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Follow" })).toBeVisible();
  await expect(page.getByRole("link", { name: "unlisted_connector" })).toBeVisible();
  assertNoPageErrors();
});
