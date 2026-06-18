import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TONE_WORLD_PLUGIN_ID } from "../src/lib/studio/plugins/registry";
import type { StudioPluginRuntimeData } from "../src/lib/studio/plugins/runtime";
import {
  SALAMANDER_GRAND_PIANO_ATTRIBUTION,
  SALAMANDER_GRAND_PIANO_LICENSE,
  SALAMANDER_GRAND_PIANO_LICENSE_URL,
  SALAMANDER_GRAND_PIANO_SAMPLE_BASE_URL,
  SALAMANDER_GRAND_PIANO_SAMPLE_URLS,
  SALAMANDER_GRAND_PIANO_SOURCE_URL,
} from "../src/lib/studio/plugins/salamanderGrandPiano";
import type { StudioWorldConnectorSetSelection } from "../src/lib/studio/plugins/worldCompatibility";
import { connectorBindingValueKey } from "../src/lib/worlds/runtimeInput";
import type { WorldDescriptor } from "../src/lib/worlds/types";

const toneMock = vi.hoisted(() => {
  const polySynthArgs: unknown[][] = [];
  const samplerArgs: unknown[][] = [];

  const transport = {
    PPQ: 192,
    bpm: { value: 120 },
    loop: false,
    state: "stopped",
    ticks: 0,
    cancel: vi.fn(),
    getTicksAtTime: vi.fn(() => 0),
    schedule: vi.fn(),
    start: vi.fn(() => {
      transport.state = "started";
    }),
    stop: vi.fn((time?: number) => {
      if (typeof time === "number") {
        transport.state = "stopped";
        transport.ticks = 0;
      }
    }),
  };

  class MockInstrument {
    dispose = vi.fn();
    triggerAttackRelease = vi.fn();
    toDestination() {
      return this;
    }
  }

  class MockPolySynth extends MockInstrument {
    constructor(...args: unknown[]) {
      super();
      polySynthArgs.push(args);
    }
  }

  class MockSampler extends MockInstrument {
    constructor(...args: unknown[]) {
      super();
      samplerArgs.push(args);
    }
  }

  return {
    PolySynth: MockPolySynth,
    Sampler: MockSampler,
    Synth: class MockSynth {},
    Transport: transport,
    immediate: vi.fn(() => 0),
    loaded: vi.fn(async () => undefined),
    now: vi.fn(() => 0),
    polySynthArgs,
    samplerArgs,
    start: vi.fn(async () => undefined),
  };
});

const osmdMock = vi.hoisted(() => {
  const instances: unknown[] = [];
  const load = vi.fn(async (_musicXml: string) => ({}));
  const render = vi.fn(async () => undefined);
  const clear = vi.fn();

  class OpenSheetMusicDisplay {
    Zoom = 1;
    load = load;
    render = render;
    clear = clear;

    constructor(
      public container: HTMLElement,
      public options: Record<string, unknown>,
    ) {
      instances.push(this);
    }
  }

  return { OpenSheetMusicDisplay, clear, instances, load, render };
});

const worldHostMock = vi.hoisted(() => {
  const pushState = vi.fn();
  const dispose = vi.fn();
  const createWorldHost = vi.fn(() => ({
    channelToken: "test-channel",
    dispose,
    pushConnectors: vi.fn(),
    pushState,
    worldId: "backend-world-1",
    worldUrl: (url: string) => `${url}${url.includes("?") ? "&" : "?"}dcnWorldChannel=test-channel`,
  }));

  return { createWorldHost, dispose, pushState };
});

vi.mock("tone", () => toneMock);
vi.mock("dcn/worlds/host", () => ({
  createWorldHost: worldHostMock.createWorldHost,
}));
vi.mock("opensheetmusicdisplay", () => ({
  OpenSheetMusicDisplay: osmdMock.OpenSheetMusicDisplay,
}));

vi.mock("$app/environment", () => ({
  browser: true,
  building: false,
  dev: false,
  version: "test",
}));

vi.mock("@xyflow/svelte", async () => {
  const [{ default: Handle }, { default: NodeResizer }] = await Promise.all([
    import("./fixtures/MockHandle.svelte"),
    import("./fixtures/MockNodeResizer.svelte"),
  ]);

  return {
    Handle,
    NodeResizer,
    Position: {
      Bottom: "bottom",
    },
  };
});

beforeEach(() => {
  window.requestAnimationFrame = vi.fn(() => 1);
  window.cancelAnimationFrame = vi.fn();
  toneMock.Transport.PPQ = 192;
  toneMock.Transport.bpm.value = 120;
  toneMock.Transport.loop = false;
  toneMock.Transport.state = "stopped";
  toneMock.Transport.ticks = 0;
  toneMock.Transport.cancel.mockClear();
  toneMock.Transport.getTicksAtTime.mockClear();
  toneMock.Transport.schedule.mockClear();
  toneMock.Transport.start.mockClear();
  toneMock.Transport.stop.mockClear();
  toneMock.immediate.mockClear();
  toneMock.loaded.mockClear();
  toneMock.now.mockClear();
  toneMock.polySynthArgs.length = 0;
  toneMock.samplerArgs.length = 0;
  toneMock.start.mockClear();
  osmdMock.clear.mockClear();
  osmdMock.instances.length = 0;
  osmdMock.load.mockClear();
  osmdMock.render.mockClear();
  worldHostMock.createWorldHost.mockClear();
  worldHostMock.dispose.mockClear();
  worldHostMock.pushState.mockClear();
});

const loadComponent = async () =>
  (await import("../src/lib/components/studio/StudioPluginNode.svelte")).default;

const runtimeData: StudioPluginRuntimeData = {
  pluginId: "midi-clip-export-v1",
  connectorTargets: ["midi_root"],
  streams: [],
  midiGroups: [
    {
      groupPath: "/midi_root:0",
      pitch: { feature_path: "/midi_root:0/pitch:0", data: [60, 64, 67] },
      time: { feature_path: "/midi_root:0/time:0", data: [0, 1, 2] },
      duration: { feature_path: "/midi_root:0/duration:0", data: [1, 1, 2] },
      velocity: { feature_path: "/midi_root:0/velocity:0", data: [80, 96, 112] },
    },
  ],
};

const scoreTemplateStream = (collector: string, field: string, data: number[]) => ({
  feature_path: `/score_root:0/${collector}:0/${field}:0`,
  data,
});

const scoreRuntimeData: StudioPluginRuntimeData = {
  pluginId: "music-score-v1",
  connectorTargets: ["score_root"],
  streams: [
    scoreTemplateStream("notes", "onset_tick", [0]),
    scoreTemplateStream("notes", "duration_tick", [2520]),
    scoreTemplateStream("notes", "pitch_midi", [60]),
  ],
  midiGroups: [],
};

const renderPluginNode = async (
  selected = true,
  pluginData = runtimeData,
  selectedConnectorContextNames: string[] = [],
  selectedConnectorContextPathPrefixes: string[] = [],
) => {
  const StudioPluginNode = await loadComponent();

  return render(StudioPluginNode, {
    props: {
      id: "plugin-node-1",
      type: "plugin",
      selected,
      dragging: false,
      zIndex: 0,
      selectable: true,
      deletable: true,
      draggable: true,
      isConnectable: true,
      positionAbsoluteX: 0,
      positionAbsoluteY: 0,
      width: undefined,
      height: undefined,
      sourcePosition: undefined,
      targetPosition: undefined,
      dragHandle: undefined,
      parentId: undefined,
      data: {
        label: "MIDI Clip Export",
        sourceId: "midi-clip-export-v1",
        pluginData,
        pluginTargets: ["midi_root"],
        selectedConnectorContextNames,
        selectedConnectorContextPathPrefixes,
      },
    },
  });
};

const renderScorePluginNode = async (
  pluginData: StudioPluginRuntimeData | null = scoreRuntimeData,
) => {
  const StudioPluginNode = await loadComponent();

  return render(StudioPluginNode, {
    props: {
      id: "plugin-node-score",
      type: "plugin",
      selected: true,
      dragging: false,
      zIndex: 0,
      selectable: true,
      deletable: true,
      draggable: true,
      isConnectable: true,
      positionAbsoluteX: 0,
      positionAbsoluteY: 0,
      width: undefined,
      height: undefined,
      sourcePosition: undefined,
      targetPosition: undefined,
      dragHandle: undefined,
      parentId: undefined,
      data: {
        label: "Music Score",
        sourceId: "music-score-v1",
        pluginData: pluginData ? { ...pluginData, pluginId: "music-score-v1" } : undefined,
        pluginTargets: pluginData?.connectorTargets ?? ["score_root"],
      },
    },
  });
};

const toneStream = (group: string, field: string, data: number[]) => ({
  feature_path: `/tone_root:0/${group}:0/${field}:0`,
  data,
});

const toneRuntimeData: StudioPluginRuntimeData = {
  pluginId: TONE_WORLD_PLUGIN_ID,
  connectorTargets: ["tone_root"],
  streams: [
    toneStream("notes", "onset_tick", [0, 2520]),
    toneStream("notes", "duration_tick", [2520, 2520]),
    toneStream("notes", "pitch_midi", [58, 61]),
    toneStream("notes", "velocity_midi", [96, 88]),
    toneStream("timbre", "tone_sample_set", [2]),
    toneStream("timbre", "tone_sample_index", [1, 2]),
    toneStream("visual", "tone_visual_variant", [3]),
    toneStream("visual", "tone_color_r", [1.1]),
    toneStream("visual", "tone_color_g", [0.6]),
    toneStream("visual", "tone_color_b", [0.35]),
    toneStream("visual", "tone_shape_sides", [5]),
    toneStream("visual", "tone_reactivity", [2]),
  ],
  midiGroups: [],
};

const renderToneWorldPluginNode = async (
  pluginData: StudioPluginRuntimeData | null = toneRuntimeData,
) => {
  const StudioPluginNode = await loadComponent();

  return render(StudioPluginNode, {
    props: {
      id: "plugin-node-tone",
      type: "plugin",
      selected: true,
      dragging: false,
      zIndex: 0,
      selectable: true,
      deletable: true,
      draggable: true,
      isConnectable: true,
      positionAbsoluteX: 0,
      positionAbsoluteY: 0,
      width: undefined,
      height: undefined,
      sourcePosition: undefined,
      targetPosition: undefined,
      dragHandle: undefined,
      parentId: undefined,
      data: {
        label: "Tone World",
        sourceId: TONE_WORLD_PLUGIN_ID,
        pluginData: pluginData ? { ...pluginData, pluginId: TONE_WORLD_PLUGIN_ID } : undefined,
        pluginTargets: pluginData?.connectorTargets ?? ["tone_root"],
      },
    },
  });
};

const backendWorldDescriptor: WorldDescriptor = {
  id: "backend-world-1",
  source: "backend",
  slug: "backend-world",
  name: "Backend World",
  version: "0.1.0",
  entry: "/world-assets/backend-world-1/index.html",
  entryUrn: "/world-assets/backend-world-1/index.html",
  runtime: "iframe",
  permissions: ["dcn.execute", "browser.downloads"],
  acceptedPluginIds: [],
  acceptedConnectorSets: [{ connectors: ["pitch"], optionalConnectors: [] }],
  surfaces: ["studio-plugin", "world-page"],
  description: "A backend-hosted world.",
  backend: {
    ownerId: "user-1",
    bundleHash: "a".repeat(64),
    manifestHash: "b".repeat(64),
    entryPath: "index.html",
    entryUrn: "/world-assets/backend-world-1/index.html",
    status: "active",
    createdAt: "2026-06-17T12:00:00Z",
    updatedAt: "2026-06-17T12:00:00Z",
  },
};

const backendRuntimeData: StudioPluginRuntimeData = {
  pluginId: "world:backend-world-1",
  connectorTargets: ["pitch"],
  streams: [{ feature_path: "/pitch:0", data: [60, 64, 67] }],
  midiGroups: [],
};

const renderBackendWorldPluginNode = async (
  pluginData: StudioPluginRuntimeData | null = backendRuntimeData,
  worldDescriptor: WorldDescriptor = backendWorldDescriptor,
  worldConnectorSetSelection?: StudioWorldConnectorSetSelection,
) => {
  const StudioPluginNode = await loadComponent();

  return render(StudioPluginNode, {
    props: {
      id: "plugin-node-backend-world",
      type: "plugin",
      selected: true,
      dragging: false,
      zIndex: 0,
      selectable: true,
      deletable: true,
      draggable: true,
      isConnectable: true,
      positionAbsoluteX: 0,
      positionAbsoluteY: 0,
      width: undefined,
      height: undefined,
      sourcePosition: undefined,
      targetPosition: undefined,
      dragHandle: undefined,
      parentId: undefined,
      data: {
        label: "Backend World",
        sourceId: `world:${worldDescriptor.id}`,
        worldDescriptor,
        pluginData: pluginData ?? undefined,
        pluginTargets: pluginData?.connectorTargets ?? ["pitch"],
        ...(worldConnectorSetSelection ? { worldConnectorSetSelection } : {}),
      },
    },
  });
};

describe("StudioPluginNode", () => {
  it("exposes unbounded corner and edge resize controls when selected", async () => {
    await renderPluginNode(true);

    const resizer = screen.getByTestId("mock-node-resizer");
    expect(resizer).toHaveAttribute("data-min-width", "360");
    expect(resizer).toHaveAttribute("data-min-height", "260");
    expect(resizer).toHaveAttribute("data-max-width", "");
    expect(resizer).toHaveAttribute("data-max-height", "");

    for (const edge of ["top", "right", "bottom", "left"]) {
      expect(screen.getByTestId(`resize-line-${edge}`)).toHaveClass(
        "svelte-flow__resize-control",
        "line",
        edge,
        "plugin-resize-line",
      );
    }

    for (const corner of ["top-left", "top-right", "bottom-right", "bottom-left"]) {
      expect(screen.getByTestId(`resize-handle-${corner}`)).toHaveClass(
        "svelte-flow__resize-control",
        "handle",
        "plugin-resize-handle",
      );
    }
  });

  it("does not show resize controls when the plugin node is not selected", async () => {
    await renderPluginNode(false);

    expect(screen.queryByTestId("mock-node-resizer")).not.toBeInTheDocument();
  });

  it("renders generated MIDI content without hiding the playable controls", async () => {
    const { container } = await renderPluginNode(true);

    expect(screen.getByText(/3 notes .* 1 groups .* 1 channels .* 120 BPM/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Stop" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download MIDI" })).toBeEnabled();
    expect(screen.getByRole("spinbutton", { name: "Tempo" })).toHaveValue(120);
    expect(screen.getByRole("button", { name: "Synth" })).toHaveClass("is-active");
    expect(screen.getByRole("button", { name: "Piano" })).not.toHaveClass("is-active");
    expect(screen.getByRole("region", { name: "MIDI piano roll preview" })).toBeInTheDocument();

    const notes = container.querySelectorAll(".roll-note");
    expect(notes).toHaveLength(3);
    expect(notes[0]).toHaveAttribute(
      "title",
      "C4 · beat 0 · duration 1 · velocity 80 · /midi_root:0",
    );
  });

  it("renders score plugin data through the MusicXML world without showing MIDI controls", async () => {
    await renderScorePluginNode();

    expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download MusicXML" })).toBeEnabled();
    expect(screen.getByTitle("Music Score MusicXML world preview")).toBeInTheDocument();
    expect(osmdMock.load).not.toHaveBeenCalled();
    expect(osmdMock.render).not.toHaveBeenCalled();
  });

  it("renders Tone World plugin data through the Tone World iframe runtime", async () => {
    await renderToneWorldPluginNode();

    expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download MIDI" })).not.toBeInTheDocument();
    expect(screen.getByTitle("Tone World preview")).toBeInTheDocument();
    expect(
      screen.getByText(/12 streams .* 17 values .* audio \+ visual layer/),
    ).toBeInTheDocument();
  });

  it("shows a Tone World run prompt before plugin runtime data is available", async () => {
    await renderToneWorldPluginNode(null);

    expect(screen.getByText("Run the flow to generate Tone World data.")).toBeInTheDocument();
    expect(screen.queryByTitle("Tone World preview")).not.toBeInTheDocument();
  });

  it("renders backend world nodes through the SDK-hosted WorldFrame", async () => {
    await renderBackendWorldPluginNode();

    await waitFor(() => expect(worldHostMock.createWorldHost).toHaveBeenCalledTimes(1));
    expect(screen.getByText("1 streams | 3 values | backend world")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "/worlds/backend-world",
    );

    const frame = screen.getByTitle("Backend World preview");
    await waitFor(() => {
      expect(frame).toHaveAttribute(
        "src",
        expect.stringContaining("/services/world-assets/backend-world-1/index.html"),
      );
    });
    expect(frame).toHaveAttribute("src", expect.stringContaining("dcnWorldChannel=test-channel"));
    expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-downloads");

    await fireEvent.load(frame);
    await waitFor(() => expect(worldHostMock.pushState).toHaveBeenCalled());
    expect(worldHostMock.pushState).toHaveBeenLastCalledWith({
      payload: expect.objectContaining({
        worldId: "backend-world-1",
        surface: "studio-plugin",
        label: "Backend World",
        connectorName: "pitch",
        connectorNames: ["pitch"],
        connectorBindings: [{ slot: "pitch", connectorName: "pitch" }],
        connectorSet: {
          index: 0,
          connectors: ["pitch"],
          optionalConnectors: [],
        },
        particlesCount: 3,
        executeOutput: [{ path: "/pitch:0", data: [60, 64, 67] }],
      }),
    });
  });

  it("uses the stored backend connector-set selection instead of recomputing by exact target names", async () => {
    const multiSetBackendWorld: WorldDescriptor = {
      ...backendWorldDescriptor,
      acceptedConnectorSets: [
        { connectors: ["foo", "bar"], optionalConnectors: [] },
        { connectors: ["pitch", "duration"], optionalConnectors: ["velocity"] },
      ],
    };
    const multiSetRuntimeData: StudioPluginRuntimeData = {
      pluginId: "world:backend-world-1",
      connectorTargets: ["lead_pitch", "duration", "velocity"],
      streams: [
        { feature_path: "/lead_pitch:0", data: [60] },
        { feature_path: "/duration:0", data: [1] },
        { feature_path: "/velocity:0", data: [96] },
      ],
      midiGroups: [],
    };

    await renderBackendWorldPluginNode(multiSetRuntimeData, multiSetBackendWorld, {
      connectorSetIndex: 1,
      connectorBindingValues: {
        [connectorBindingValueKey("pitch")]: "lead_pitch",
        [connectorBindingValueKey("duration")]: "duration",
        [connectorBindingValueKey("velocity", true)]: "velocity",
      },
    });

    await waitFor(() => expect(worldHostMock.createWorldHost).toHaveBeenCalledTimes(1));
    const frame = screen.getByTitle("Backend World preview");
    await fireEvent.load(frame);

    await waitFor(() => expect(worldHostMock.pushState).toHaveBeenCalled());
    expect(worldHostMock.pushState).toHaveBeenLastCalledWith({
      payload: expect.objectContaining({
        worldId: "backend-world-1",
        surface: "studio-plugin",
        connectorName: "lead_pitch + duration + velocity",
        connectorNames: ["lead_pitch + duration + velocity", "lead_pitch", "duration", "velocity"],
        connectorBindings: [
          { slot: "pitch", connectorName: "lead_pitch" },
          { slot: "duration", connectorName: "duration" },
          { slot: "velocity", connectorName: "velocity", optional: true },
        ],
        connectorSet: {
          index: 1,
          connectors: ["pitch", "duration"],
          optionalConnectors: ["velocity"],
        },
      }),
    });
  });

  it("renders an empty score staff before plugin runtime data is available", async () => {
    await renderScorePluginNode(null);

    expect(screen.getByLabelText("Empty music score preview")).toBeInTheDocument();
    expect(screen.queryByText("No plugin runtime data yet.")).not.toBeInTheDocument();
    expect(osmdMock.load).not.toHaveBeenCalled();
    expect(osmdMock.render).not.toHaveBeenCalled();
  });

  it("logs complete score diagnostics to the console instead of listing them in the node", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const scoreRuntimeData: StudioPluginRuntimeData = {
      pluginId: "music-score-v1",
      connectorTargets: ["score_root"],
      streams: [
        scoreTemplateStream("notes", "event_id", [42]),
        scoreTemplateStream("notes", "onset_tick", [0]),
        scoreTemplateStream("notes", "duration_tick", [2520]),
        scoreTemplateStream("notes", "pitch_midi", [60]),
        scoreTemplateStream("articulations", "event_id", [42]),
        scoreTemplateStream("articulations", "articulation_code", [999]),
      ],
      midiGroups: [],
    };

    try {
      await renderScorePluginNode(scoreRuntimeData);

      await waitFor(() => expect(consoleWarn).toHaveBeenCalledTimes(1));
      expect(screen.queryByText(/logged to browser console/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/articulation_code is unsupported/i)).not.toBeInTheDocument();
      expect(consoleWarn.mock.calls[0]?.[0]).toContain("2 score diagnostic");
      expect(consoleWarn.mock.calls[0]?.[1]).toMatchObject({
        plugin: "Music Score",
      });
      expect(consoleWarn.mock.calls[0]?.[1]).toEqual(
        expect.objectContaining({
          diagnostics: expect.arrayContaining([
            expect.objectContaining({
              code: "invalid-score-articulation-code",
              message: expect.stringContaining("articulation_code is unsupported"),
            }),
          ]),
        }),
      );
    } finally {
      consoleWarn.mockRestore();
    }
  });

  it("highlights only notes contributed by the selected connector lineage", async () => {
    const lineageRuntimeData: StudioPluginRuntimeData = {
      ...runtimeData,
      midiGroups: [
        {
          groupPath: "/midi_root:0",
          pitch: { feature_path: "/midi_root:0/same_child:0/pitch:0", data: [60] },
          time: { feature_path: "/midi_root:0/same_child:1/time:0", data: [0] },
          duration: { feature_path: "/midi_root:0/same_child:2/duration:0", data: [1] },
          velocity: { feature_path: "/midi_root:0/same_child:3/velocity:0", data: [90] },
        },
        {
          groupPath: "/midi_root:1",
          pitch: { feature_path: "/midi_root:1/same_child:0/pitch:0", data: [67] },
          time: { feature_path: "/midi_root:1/same_child:1/time:0", data: [1] },
          duration: { feature_path: "/midi_root:1/same_child:2/duration:0", data: [1] },
          velocity: { feature_path: "/midi_root:1/same_child:3/velocity:0", data: [90] },
        },
      ],
    };
    const { container } = await renderPluginNode(
      true,
      lineageRuntimeData,
      ["same_child"],
      ["/midi_root:1/same_child:*"],
    );

    const notes = container.querySelectorAll(".roll-note");
    expect(notes).toHaveLength(2);
    expect(notes[0]).toHaveClass("is-lineage-dimmed");
    expect(notes[0]).not.toHaveClass("is-lineage-highlighted");
    expect(notes[1]).toHaveClass("is-lineage-highlighted");
    expect(notes[1]).not.toHaveClass("is-lineage-dimmed");
  });

  it("preserves absolute beat offsets in the piano-roll preview layout", async () => {
    const shiftedRuntimeData: StudioPluginRuntimeData = {
      ...runtimeData,
      midiGroups: [
        {
          ...runtimeData.midiGroups[0],
          time: { feature_path: "/midi_root:0/time:0", data: [1, 2, 3] },
        },
      ],
    };
    const { container } = await renderPluginNode(true, shiftedRuntimeData);

    const notes = container.querySelectorAll(".roll-note");
    expect(notes[0]).toHaveAttribute("style", expect.stringContaining("left: 90px"));
    expect(notes[0]).toHaveAttribute(
      "title",
      "C4 · beat 1 · duration 1 · velocity 80 · /midi_root:0",
    );
  });

  it("allows switching playback preview from synth to grand piano samples", async () => {
    await renderPluginNode(true);

    await fireEvent.click(screen.getByRole("button", { name: "Piano" }));

    expect(screen.getByRole("button", { name: "Synth" })).not.toHaveClass("is-active");
    expect(screen.getByRole("button", { name: "Piano" })).toHaveClass("is-active");
  });

  it("creates analog synth playback with immediate zero-attack notes", async () => {
    await renderPluginNode(true);

    await fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => expect(toneMock.Transport.start).toHaveBeenCalledTimes(1));
    expect(toneMock.polySynthArgs).toHaveLength(1);
    expect(toneMock.polySynthArgs[0][0]).toBe(toneMock.Synth);
    expect(toneMock.polySynthArgs[0][1]).toMatchObject({
      envelope: { attack: 0, decay: 0.1, sustain: 0.4, release: 0.4 },
    });
  });

  it("creates piano sample playback with immediate zero-attack notes", async () => {
    await renderPluginNode(true);

    await fireEvent.click(screen.getByRole("button", { name: "Piano" }));
    await fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => expect(toneMock.Transport.start).toHaveBeenCalledTimes(1));
    expect(toneMock.samplerArgs).toHaveLength(1);
    expect(toneMock.samplerArgs[0][0]).toMatchObject({
      urls: SALAMANDER_GRAND_PIANO_SAMPLE_URLS,
      baseUrl: SALAMANDER_GRAND_PIANO_SAMPLE_BASE_URL,
      attack: 0,
      release: 1,
    });
    expect(toneMock.loaded).toHaveBeenCalledTimes(1);
  });

  it("can start playback after changing tempo", async () => {
    await renderPluginNode(true);

    await fireEvent.input(screen.getByRole("spinbutton", { name: "Tempo" }), {
      target: { value: "90" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => expect(toneMock.start).toHaveBeenCalledTimes(1));
    expect(toneMock.Transport.bpm.value).toBe(90);
    expect(toneMock.Transport.schedule).toHaveBeenCalledTimes(3);
    await waitFor(() => expect(toneMock.Transport.start).toHaveBeenCalledWith(0.05, "0i"));
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
  });

  it("can restart playback after changing tempo while playback is running", async () => {
    await renderPluginNode(true);

    await fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(toneMock.Transport.start).toHaveBeenCalledTimes(1));
    expect(toneMock.Transport.state).toBe("started");

    await fireEvent.input(screen.getByRole("spinbutton", { name: "Tempo" }), {
      target: { value: "90" },
    });

    expect(toneMock.Transport.stop).toHaveBeenLastCalledWith(0);
    expect(toneMock.Transport.state).toBe("stopped");
    expect(screen.getByRole("button", { name: "Play" })).toBeEnabled();

    await fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => expect(toneMock.Transport.start).toHaveBeenCalledTimes(2));
    expect(toneMock.Transport.bpm.value).toBe(90);
    expect(toneMock.Transport.state).toBe("started");
  });

  it("maps the Salamander Grand Piano samples to local audio assets", () => {
    expect(SALAMANDER_GRAND_PIANO_SAMPLE_BASE_URL).toBe("/samples/piano/");
    expect(SALAMANDER_GRAND_PIANO_ATTRIBUTION).toBe(
      "Salamander Grand Piano by Alexander Holm, Creative Commons Attribution 3.0 Unported (CC BY 3.0).",
    );
    expect(SALAMANDER_GRAND_PIANO_LICENSE).toBe(
      "Creative Commons Attribution 3.0 Unported (CC BY 3.0)",
    );
    expect(SALAMANDER_GRAND_PIANO_LICENSE_URL).toBe("https://creativecommons.org/licenses/by/3.0/");
    expect(SALAMANDER_GRAND_PIANO_SOURCE_URL).toBe(
      "https://github.com/sfzinstruments/SalamanderGrandPiano",
    );
    expect(SALAMANDER_GRAND_PIANO_SAMPLE_URLS).toMatchObject({
      C1: "C1.mp3",
      C4: "C4.mp3",
      "D#4": "Ds4.mp3",
      "F#4": "Fs4.mp3",
      C8: "C8.mp3",
    });
    expect(Object.keys(SALAMANDER_GRAND_PIANO_SAMPLE_URLS)).toHaveLength(27);
    for (const samplePath of Object.values(SALAMANDER_GRAND_PIANO_SAMPLE_URLS)) {
      expect(existsSync(resolve("static/samples/piano", samplePath))).toBe(true);
    }

    const notice = readFileSync(resolve("static/samples/piano/README.md"), "utf8");
    expect(notice).toContain("Salamander Grand Piano by Alexander Holm");
    expect(notice).toContain(SALAMANDER_GRAND_PIANO_LICENSE);
    expect(notice).toContain(SALAMANDER_GRAND_PIANO_LICENSE_URL);
    expect(notice).toContain(SALAMANDER_GRAND_PIANO_SOURCE_URL);
  });

  it("keeps resize edge hit areas wider than the visible one-pixel line", () => {
    const source = readFileSync(
      resolve("src/lib/components/studio/StudioPluginNode.svelte"),
      "utf8",
    );

    expect(source).toContain(":global(.plugin-resize-line.svelte-flow__resize-control.line.left),");
    expect(source).toContain("width: 12px;");
    expect(source).toContain(":global(.plugin-resize-line.svelte-flow__resize-control.line.top),");
    expect(source).toContain("height: 12px;");
  });

  it("keeps audio scheduling and the visual playhead on the same clock", () => {
    const source = readFileSync(
      resolve("src/lib/components/studio/StudioPluginNode.svelte"),
      "utf8",
    );

    expect(source).toContain("showPlayhead");
    expect(source).toContain("beatsToTransportTicks");
    expect(source).toContain("transport.schedule(");
    expect(source).toContain("beatsToTransportTicks(tone, note.time)");
    expect(source).toContain('tone.Transport.start(tone.now() + 0.05, "0i")');
    expect(source).toContain("tone.Transport.stop(resetTime)");
    expect(source).toContain("envelope: { attack: 0, decay: 0.1, sustain: 0.4, release: 0.4 }");
    expect(source).toContain("attack: 0");
    expect(source).toContain("transport.getTicksAtTime(toneModule.immediate())");
    expect(source).toContain("currentTicks / transport.PPQ");
    expect(source).toContain("const currentRuntimeData = runtimeData");
    expect(source).toContain("instrument.triggerAttackRelease(");
    expect(source).not.toContain("getAudibleContextTime");
    expect(source).not.toContain("rawContext.getOutputTimestamp");
    expect(source).not.toContain("rawContext.outputLatency");
    expect(source).not.toContain("attack: 0.01");
    expect(source).not.toContain("toneModule.Transport.stop();");
    expect(source).not.toContain("transport.stop();");
    expect(source).not.toContain("transport.ticks = 0");
    expect(source).not.toContain("playbackVisualLatencySeconds");
    expect(source).not.toContain("playbackStartContextTime");
    expect(source).not.toContain("playbackStartBeat");
    expect(source).not.toContain("playbackStartTimeoutId");
    expect(source).not.toContain("tone.Draw.schedule");
    expect(source).not.toContain('toneModule.Transport.start("+0.05")');
    expect(source).not.toContain("if (!midiClip) return;");
  });
});
