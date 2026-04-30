import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyTheme,
  DEFAULT_THEME,
  initTheme,
  nextTheme,
  readStoredTheme,
  resolveTheme,
  setStoredTheme,
  THEME_STORAGE_KEY,
} from "../src/lib/theme/theme";

describe("theme utilities", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.themeTransition;
    document.documentElement.style.removeProperty("color-scheme");
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    delete document.documentElement.dataset.themeTransition;
  });

  it("defaults to the dark theme when storage is empty or invalid", () => {
    expect(resolveTheme(null)).toBe(DEFAULT_THEME);
    expect(resolveTheme("solarized")).toBe(DEFAULT_THEME);

    localStorage.setItem(THEME_STORAGE_KEY, "solarized");
    expect(readStoredTheme()).toBeNull();
    expect(initTheme()).toBe(DEFAULT_THEME);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("applies and persists the selected theme", () => {
    expect(applyTheme("light")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");

    expect(setStoredTheme("dark")).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("initializes from stored theme and toggles deterministically", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");

    expect(initTheme()).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("light");
  });

  it("suppresses transitions while applying stored theme changes", () => {
    vi.useFakeTimers();

    expect(setStoredTheme("light")).toBe("light");
    expect(document.documentElement.dataset.themeTransition).toBe("disabled");

    vi.advanceTimersByTime(120);
    expect(document.documentElement.dataset.themeTransition).toBeUndefined();
  });
});
