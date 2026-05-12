import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MIDI_CLIP_WORLD_ID } from "../src/lib/worlds/registry";
import {
  WORLD_PROTOCOL_VERSION,
  WORLD_STATE_MESSAGE_TYPE,
  type WorldRuntimeInput,
} from "../src/lib/worlds/types";

vi.mock("$app/environment", () => ({
  browser: true,
  building: false,
  dev: false,
  version: "test",
}));

const loadRuntimePage = async () =>
  (await import("../src/routes/world-runtimes/midi-clip/+page.svelte")).default;

const postWorldState = (payload: WorldRuntimeInput) => {
  window.postMessage(
    {
      type: WORLD_STATE_MESSAGE_TYPE,
      payload,
    },
    "*",
  );
};

const midiWorldInput = (surface: WorldRuntimeInput["surface"]): WorldRuntimeInput => ({
  protocolVersion: WORLD_PROTOCOL_VERSION,
  worldId: MIDI_CLIP_WORLD_ID,
  surface,
  label: "QA MIDI world",
  executeOutput: [
    { path: "/midi_root:0/pitch:0", data: [60] },
    { path: "/midi_root:0/time:0", data: [0] },
    { path: "/midi_root:0/duration:0", data: [1] },
    { path: "/midi_root:0/velocity:0", data: [90] },
  ],
  artifacts: {
    midiStatsText: "1 note | 1 group | 1 channel | 120 BPM",
  },
});

const lineageMidiWorldInput = (): WorldRuntimeInput => ({
  protocolVersion: WORLD_PROTOCOL_VERSION,
  worldId: MIDI_CLIP_WORLD_ID,
  surface: "world-page",
  label: "Lineage MIDI world",
  selectedConnectorContextNames: ["same_child"],
  selectedConnectorContextPathPrefixes: ["/midi_root:1/same_child:*"],
  executeOutput: [
    { path: "/midi_root:0/same_child:0/pitch:0", data: [60] },
    { path: "/midi_root:0/same_child:1/time:0", data: [0] },
    { path: "/midi_root:0/same_child:2/duration:0", data: [1] },
    { path: "/midi_root:0/same_child:3/velocity:0", data: [90] },
    { path: "/midi_root:1/same_child:0/pitch:0", data: [67] },
    { path: "/midi_root:1/same_child:1/time:0", data: [1] },
    { path: "/midi_root:1/same_child:2/duration:0", data: [1] },
    { path: "/midi_root:1/same_child:3/velocity:0", data: [90] },
  ],
});

describe("MIDI world runtime", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a piano roll and exposes MIDI download on world pages", async () => {
    const RuntimePage = await loadRuntimePage();
    render(RuntimePage);

    await new Promise((resolve) => setTimeout(resolve, 0));
    postWorldState(midiWorldInput("world-page"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Download MIDI" })).toBeEnabled();
    });
    expect(screen.getByLabelText("MIDI piano roll preview")).toBeInTheDocument();
    expect(screen.getByText("1 note | 1 group | 1 channel | 120 BPM")).toBeInTheDocument();
  });

  it("hides MIDI download inside Studio plugin previews", async () => {
    const RuntimePage = await loadRuntimePage();
    render(RuntimePage);

    await new Promise((resolve) => setTimeout(resolve, 0));
    postWorldState(midiWorldInput("studio-plugin"));

    await waitFor(() => {
      expect(screen.getByLabelText("MIDI piano roll preview")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Download MIDI" })).not.toBeInTheDocument();
  });

  it("highlights notes from the selected connector lineage like the Studio MIDI plugin", async () => {
    const RuntimePage = await loadRuntimePage();
    const { container } = render(RuntimePage);

    await new Promise((resolve) => setTimeout(resolve, 0));
    postWorldState(lineageMidiWorldInput());

    await waitFor(() => {
      expect(container.querySelectorAll(".roll-note")).toHaveLength(2);
    });

    const notes = container.querySelectorAll(".roll-note");
    expect(notes[0]).toHaveClass("is-lineage-dimmed");
    expect(notes[0]).not.toHaveClass("is-lineage-highlighted");
    expect(notes[1]).toHaveClass("is-lineage-highlighted");
    expect(notes[1]).not.toHaveClass("is-lineage-dimmed");
    expect(notes[1]).toHaveAttribute(
      "title",
      expect.stringContaining("selected connector lineage"),
    );
  });

  it("falls back to connector-name highlighting when no inferred path prefix matches", async () => {
    const RuntimePage = await loadRuntimePage();
    const { container } = render(RuntimePage);

    await new Promise((resolve) => setTimeout(resolve, 0));
    postWorldState({
      ...lineageMidiWorldInput(),
      selectedConnectorContextNames: ["same_child"],
      selectedConnectorContextPathPrefixes: ["/unmatched_root:1/same_child:*"],
    });

    await waitFor(() => {
      expect(container.querySelectorAll(".roll-note")).toHaveLength(2);
    });

    const notes = container.querySelectorAll(".roll-note");
    expect(notes[0]).toHaveClass("is-lineage-highlighted");
    expect(notes[1]).toHaveClass("is-lineage-highlighted");
  });
});
