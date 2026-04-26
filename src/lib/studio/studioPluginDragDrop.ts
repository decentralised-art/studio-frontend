import type { StudioPluginDescriptor } from "$lib/studio/plugins/registry";

export const STUDIO_PLUGIN_DRAG_MIME = "application/x-hypermusic-plugin";

export type StudioPluginDragDataTransfer = Pick<DataTransfer, "setData"> &
  Partial<Pick<DataTransfer, "effectAllowed">>;

export type StudioPluginDropDataTransfer = Pick<DataTransfer, "getData">;

export const writeStudioPluginDragData = (
  dataTransfer: StudioPluginDragDataTransfer | null | undefined,
  plugin: StudioPluginDescriptor,
): boolean => {
  if (!dataTransfer) return false;

  dataTransfer.setData(STUDIO_PLUGIN_DRAG_MIME, JSON.stringify(plugin));
  dataTransfer.setData("text/plain", plugin.name);
  dataTransfer.effectAllowed = "copy";
  return true;
};

export const readStudioPluginDropData = (
  dataTransfer: StudioPluginDropDataTransfer | null | undefined,
): StudioPluginDescriptor | null => {
  const payload = dataTransfer?.getData(STUDIO_PLUGIN_DRAG_MIME) ?? "";
  if (!payload) return null;

  try {
    return JSON.parse(payload) as StudioPluginDescriptor;
  } catch {
    return null;
  }
};

export const bindStudioCanvasDragDrop = (
  element: HTMLElement,
  handlers: {
    onDragOver: (event: DragEvent) => void;
    onDrop: (event: DragEvent) => void;
  },
): (() => void) => {
  const handleDragOverCapture = (event: DragEvent) => {
    handlers.onDragOver(event);
  };
  const handleDropCapture = (event: DragEvent) => {
    handlers.onDrop(event);
  };

  element.addEventListener("dragover", handleDragOverCapture, { capture: true });
  element.addEventListener("drop", handleDropCapture, { capture: true });

  return () => {
    element.removeEventListener("dragover", handleDragOverCapture, { capture: true });
    element.removeEventListener("drop", handleDropCapture, { capture: true });
  };
};
