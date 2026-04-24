import { describe, expect, it } from "vitest";

import {
  clampPanelWidth,
  getDefaultStudioPanelWidth,
  getStudioPanelBounds,
  getStudioPanelScale,
  panelSize,
  resolveResponsivePanelWidth,
} from "../src/lib/studio/studioPanels";

describe("Studio panel helpers", () => {
  it("formats hidden and open panel sizes", () => {
    expect(panelSize("hidden", "320px")).toBe("0px");
    expect(panelSize("open", "320px")).toBe("320px");
  });

  it("computes compact and desktop panel bounds", () => {
    expect(getStudioPanelBounds("left", 800)).toEqual({ min: 176, max: 672 });
    expect(getStudioPanelBounds("right", 800)).toEqual({ min: 192, max: 704 });
    expect(getStudioPanelBounds("left", 1280)).toEqual({ min: 220, max: 640 });
    expect(getStudioPanelBounds("right", 1280)).toEqual({ min: 240, max: 704 });
  });

  it("clamps widths and resolves defaults", () => {
    expect(clampPanelWidth(100, { min: 220, max: 640 })).toBe(220);
    expect(clampPanelWidth(999, { min: 220, max: 640 })).toBe(640);
    expect(clampPanelWidth(279.6, { min: 220, max: 640 })).toBe(280);
    expect(getDefaultStudioPanelWidth("left", 800)).toBe(220);
    expect(getDefaultStudioPanelWidth("right", 1280)).toBe(300);
  });

  it("resolves responsive widths from defaults or user values", () => {
    expect(
      resolveResponsivePanelWidth({
        side: "left",
        viewportWidthPx: 1280,
        currentWidthPx: 900,
        userSized: false,
      }),
    ).toBe(280);
    expect(
      resolveResponsivePanelWidth({
        side: "right",
        viewportWidthPx: 1280,
        currentWidthPx: 900,
        userSized: true,
      }),
    ).toBe(704);
  });

  it("clamps panel scale to the supported visual range", () => {
    expect(getStudioPanelScale("left", 1280, 10)).toBe(0.74);
    expect(getStudioPanelScale("right", 1280, 900)).toBe(1.08);
    expect(getStudioPanelScale("left", 1280, 280)).toBe(1);
  });
});
