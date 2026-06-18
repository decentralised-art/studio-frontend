import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MUSICXML_SCORE_WORLD, MUSICXML_SCORE_WORLD_ID } from "../src/lib/worlds/registry";
import {
  WORLD_PROTOCOL_VERSION,
  WORLD_STATE_MESSAGE_TYPE,
  type WorldDescriptor,
  type WorldRuntimeInput,
} from "../src/lib/worlds/types";

const osmdMock = vi.hoisted(() => {
  const load = vi.fn(async (_musicXml: string) => ({}));
  const renderScore = vi.fn(async function (this: { container: HTMLElement }) {
    this.container.innerHTML = `
      <svg>
        <g class="vf-notehead" data-testid="mock-score-note-1"><path /></g>
        <g class="vf-notehead" data-testid="mock-score-note-2"><path /></g>
      </svg>
    `;
  });
  const clear = vi.fn();

  class OpenSheetMusicDisplay {
    Zoom = 1;
    load = load;
    render = renderScore;
    clear = clear;

    constructor(
      public container: HTMLElement,
      public options: Record<string, unknown>,
    ) {}
  }

  return { OpenSheetMusicDisplay, clear, load, renderScore };
});

vi.mock("opensheetmusicdisplay", () => ({
  OpenSheetMusicDisplay: osmdMock.OpenSheetMusicDisplay,
}));

vi.mock("$app/environment", () => ({
  browser: true,
  building: false,
  dev: false,
  version: "test",
}));

const musicXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1">
      <part-name>Music</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>
      <note>
        <pitch>
          <step>C</step>
          <octave>4</octave>
        </pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>`;

const loadRuntimePage = async () =>
  (await import("../src/routes/world-runtimes/musicxml-score/+page.svelte")).default;

const loadWorldFrame = async () =>
  (await import("../src/lib/components/worlds/WorldFrame.svelte")).default;

const backendWorld: WorldDescriptor = {
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
  surfaces: ["world-page"],
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

const postWorldState = (payload: WorldRuntimeInput) => {
  window.postMessage(
    {
      type: WORLD_STATE_MESSAGE_TYPE,
      payload,
    },
    "*",
  );
};

describe("MusicXML world runtime", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    osmdMock.clear.mockClear();
    osmdMock.load.mockClear();
    osmdMock.renderScore.mockClear();
  });

  it("shows the MusicXML download action for rendered world state", async () => {
    const RuntimePage = await loadRuntimePage();
    render(RuntimePage);

    await new Promise((resolve) => setTimeout(resolve, 0));

    postWorldState({
      protocolVersion: WORLD_PROTOCOL_VERSION,
      worldId: MUSICXML_SCORE_WORLD_ID,
      surface: "world-page",
      label: "QA MusicXML score",
      artifacts: {
        musicXml,
        scoreStatsText: "1 note | 1 measure | 1 part",
      },
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Download MusicXML" })).toBeEnabled();
    });
  });

  it("hides the runtime download action inside Studio plugin previews", async () => {
    const RuntimePage = await loadRuntimePage();
    render(RuntimePage);

    await new Promise((resolve) => setTimeout(resolve, 0));

    postWorldState({
      protocolVersion: WORLD_PROTOCOL_VERSION,
      worldId: MUSICXML_SCORE_WORLD_ID,
      surface: "studio-plugin",
      label: "QA MusicXML score",
      artifacts: {
        musicXml,
        scoreStatsText: "1 note | 1 measure | 1 part",
      },
    });

    await waitFor(() => {
      expect(screen.getByText("1 note | 1 measure | 1 part")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Download MusicXML" })).not.toBeInTheDocument();
  });

  it("highlights MusicXML notes from the selected connector lineage", async () => {
    const RuntimePage = await loadRuntimePage();
    const { container } = render(RuntimePage);

    await new Promise((resolve) => setTimeout(resolve, 0));

    postWorldState({
      protocolVersion: WORLD_PROTOCOL_VERSION,
      worldId: MUSICXML_SCORE_WORLD_ID,
      surface: "world-page",
      label: "Lineage MusicXML score",
      selectedConnectorContextNames: ["note_group"],
      selectedConnectorContextPathPrefixes: ["/score_root:1/note_group:*"],
      artifacts: {
        musicXml,
        scoreStatsText: "2 notes | 1 measure | 1 part",
        scoreRenderedNotes: [
          { sourcePaths: ["/score_root:0/note_group:0/pitch:0"] },
          { sourcePaths: ["/score_root:1/note_group:0/pitch:0"] },
        ],
      },
    });

    await waitFor(() => {
      expect(container.querySelectorAll(".vf-notehead")).toHaveLength(2);
    });

    const notes = container.querySelectorAll(".vf-notehead");
    expect(notes[0]).toHaveClass("hm-score-note-dimmed");
    expect(notes[0]).not.toHaveClass("hm-score-note-highlighted");
    expect(notes[1]).toHaveClass("hm-score-note-highlighted");
    expect(notes[1]).not.toHaveClass("hm-score-note-dimmed");
  });

  it("allows downloads from the sandboxed world iframe", async () => {
    const WorldFrame = await loadWorldFrame();
    render(WorldFrame, {
      props: {
        world: MUSICXML_SCORE_WORLD,
        input: null,
      },
    });

    expect(screen.getByTitle(MUSICXML_SCORE_WORLD.name)).toHaveAttribute(
      "sandbox",
      expect.stringContaining("allow-downloads"),
    );
  });

  it("mounts backend worlds through the SDK host channel", async () => {
    const WorldFrame = await loadWorldFrame();
    render(WorldFrame, {
      props: {
        world: backendWorld,
        input: {
          protocolVersion: WORLD_PROTOCOL_VERSION,
          worldId: backendWorld.id,
          surface: "world-page",
          label: "Backend World",
        },
      },
    });

    const iframe = screen.getByTitle(backendWorld.name);

    await waitFor(() => {
      expect(iframe).toHaveAttribute(
        "src",
        expect.stringContaining("/services/world-assets/backend-world-1/index.html"),
      );
      expect(iframe).toHaveAttribute("src", expect.stringContaining("dcnWorldChannel="));
    });
    expect(iframe).toHaveAttribute("sandbox", "allow-scripts allow-downloads");
    expect(iframe).not.toHaveAttribute("sandbox", expect.stringContaining("allow-same-origin"));
  });

  it("posts updated world input into an already loaded iframe", async () => {
    const WorldFrame = await loadWorldFrame();
    const { rerender } = render(WorldFrame, {
      props: {
        world: MUSICXML_SCORE_WORLD,
        input: null,
      },
    });
    const iframe = screen.getByTitle(MUSICXML_SCORE_WORLD.name) as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");

    await fireEvent.load(iframe);
    await rerender({
      world: MUSICXML_SCORE_WORLD,
      input: {
        protocolVersion: WORLD_PROTOCOL_VERSION,
        worldId: MUSICXML_SCORE_WORLD_ID,
        surface: "world-page",
        selectedConnectorContextNames: ["pitch"],
      },
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WORLD_STATE_MESSAGE_TYPE,
          payload: expect.objectContaining({
            selectedConnectorContextNames: ["pitch"],
          }),
        }),
        "*",
      );
    });
  });
});
