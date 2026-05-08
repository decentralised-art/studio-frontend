import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MUSICXML_SCORE_WORLD, MUSICXML_SCORE_WORLD_ID } from "../src/lib/worlds/registry";
import {
  WORLD_PROTOCOL_VERSION,
  WORLD_STATE_MESSAGE_TYPE,
  type WorldRuntimeInput,
} from "../src/lib/worlds/types";

const osmdMock = vi.hoisted(() => {
  const load = vi.fn(async (_musicXml: string) => ({}));
  const renderScore = vi.fn(async () => undefined);
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
});
