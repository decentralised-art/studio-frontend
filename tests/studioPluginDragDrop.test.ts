import { describe, expect, it, vi } from "vitest";

import type { StudioPluginDescriptor } from "../src/lib/studio/plugins/registry";
import {
  STUDIO_PLUGIN_DRAG_MIME,
  bindStudioCanvasDragDrop,
  readStudioPluginDropData,
  writeStudioPluginDragData,
} from "../src/lib/studio/studioPluginDragDrop";

const plugin: StudioPluginDescriptor = {
  id: "midi-clip-export-v1",
  name: "MIDI Clip Export",
  summary: "Export MIDI clips from connector streams.",
  supportedFormatHashes: ["0xabc"],
  status: "alpha",
};

const createDragEvent = (type: string): DragEvent =>
  new Event(type, { bubbles: true, cancelable: true }) as DragEvent;

describe("studio plugin drag/drop helpers", () => {
  it("writes and reads plugin drag payloads", () => {
    const data = new Map<string, string>();
    const transfer = {
      effectAllowed: "uninitialized" as DataTransfer["effectAllowed"],
      getData: vi.fn((type: string) => data.get(type) ?? ""),
      setData: vi.fn((type: string, value: string) => {
        data.set(type, value);
      }),
    };

    expect(writeStudioPluginDragData(transfer, plugin)).toBe(true);
    expect(transfer.setData).toHaveBeenCalledWith(STUDIO_PLUGIN_DRAG_MIME, JSON.stringify(plugin));
    expect(transfer.setData).toHaveBeenCalledWith("text/plain", plugin.name);
    expect(transfer.effectAllowed).toBe("copy");
    expect(readStudioPluginDropData(transfer)).toEqual(plugin);
  });

  it("returns null for missing or malformed plugin drag payloads", () => {
    expect(readStudioPluginDropData(undefined)).toBeNull();
    expect(readStudioPluginDropData({ getData: () => "" })).toBeNull();
    expect(readStudioPluginDropData({ getData: () => "not json" })).toBeNull();
  });

  it("binds canvas dragover and drop listeners until cleanup", () => {
    const element = document.createElement("div");
    const onDragOver = vi.fn((event: DragEvent) => {
      event.preventDefault();
    });
    const onDrop = vi.fn((event: DragEvent) => {
      event.preventDefault();
    });

    const cleanup = bindStudioCanvasDragDrop(element, { onDragOver, onDrop });

    element.dispatchEvent(createDragEvent("dragover"));
    element.dispatchEvent(createDragEvent("drop"));
    expect(onDragOver).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledTimes(1);

    cleanup();
    element.dispatchEvent(createDragEvent("dragover"));
    element.dispatchEvent(createDragEvent("drop"));
    expect(onDragOver).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledTimes(1);
  });
});
