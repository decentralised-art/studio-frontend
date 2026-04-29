import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/svelte";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { StudioPluginRuntimeData } from "../src/lib/studio/plugins/runtime";

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

const renderPluginNode = async (selected = true) => {
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
        pluginData: runtimeData,
        pluginTargets: ["midi_root"],
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
    expect(screen.getByRole("region", { name: "MIDI piano roll preview" })).toBeInTheDocument();

    const notes = container.querySelectorAll(".roll-note");
    expect(notes).toHaveLength(3);
    expect(notes[0]).toHaveAttribute(
      "title",
      "C4 · beat 0 · duration 1 · velocity 80 · /midi_root:0",
    );
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
});
