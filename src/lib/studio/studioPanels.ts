export type StudioPanelMode = "open" | "hidden";
export type StudioPanelSide = "left" | "right";

export type StudioPanelBounds = {
  min: number;
  max: number;
};

const COMPACT_VIEWPORT_PX = 900;

export const isCompactStudioViewport = (viewportWidthPx: number) =>
  viewportWidthPx <= COMPACT_VIEWPORT_PX;

export const panelSize = (mode: StudioPanelMode, open: string) =>
  mode === "hidden" ? "0px" : open;

export const getStudioPanelBounds = (
  side: StudioPanelSide,
  viewportWidthPx: number,
): StudioPanelBounds => {
  const compact = isCompactStudioViewport(viewportWidthPx);
  const min = side === "left" ? (compact ? 176 : 220) : compact ? 192 : 240;
  const widthFactor = side === "left" ? (compact ? 0.84 : 0.5) : compact ? 0.88 : 0.55;
  const max = Math.max(min, Math.floor(viewportWidthPx * widthFactor));
  return { min, max };
};

export const clampPanelWidth = (value: number, bounds: StudioPanelBounds) =>
  Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));

export const getDefaultStudioPanelWidth = (side: StudioPanelSide, viewportWidthPx: number) => {
  const compact = isCompactStudioViewport(viewportWidthPx);
  return side === "left" ? (compact ? 220 : 280) : compact ? 240 : 300;
};

export const getStudioPanelScale = (
  side: StudioPanelSide,
  viewportWidthPx: number,
  widthPx: number,
) => {
  const compact = isCompactStudioViewport(viewportWidthPx);
  const baseline = side === "left" ? (compact ? 240 : 280) : compact ? 260 : 300;
  return Math.max(0.74, Math.min(1.08, widthPx / baseline));
};

export const resolveResponsivePanelWidth = ({
  side,
  viewportWidthPx,
  currentWidthPx,
  userSized,
}: {
  side: StudioPanelSide;
  viewportWidthPx: number;
  currentWidthPx: number;
  userSized: boolean;
}) => {
  const candidate = userSized ? currentWidthPx : getDefaultStudioPanelWidth(side, viewportWidthPx);
  return clampPanelWidth(candidate, getStudioPanelBounds(side, viewportWidthPx));
};
