export type ThemeMode = "dark" | "light";

export const THEME_STORAGE_KEY = "hypermusic-theme";
export const DEFAULT_THEME: ThemeMode = "dark";
export const THEME_TRANSITION_ATTR = "themeTransition";
const THEME_TRANSITION_SUPPRESSION_MS = 120;

let themeTransitionSuppressionTimeout: ReturnType<typeof setTimeout> | null = null;

export const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "dark" || value === "light";

export const resolveTheme = (storedTheme: string | null | undefined): ThemeMode =>
  isThemeMode(storedTheme) ? storedTheme : DEFAULT_THEME;

export const nextTheme = (theme: ThemeMode): ThemeMode => (theme === "dark" ? "light" : "dark");

export const suppressThemeTransitions = (root: HTMLElement = document.documentElement) => {
  root.dataset[THEME_TRANSITION_ATTR] = "disabled";
  // Force the transition override to apply before theme variables change.
  void root.offsetHeight;

  if (themeTransitionSuppressionTimeout !== null) {
    clearTimeout(themeTransitionSuppressionTimeout);
  }

  themeTransitionSuppressionTimeout = setTimeout(() => {
    delete root.dataset[THEME_TRANSITION_ATTR];
    themeTransitionSuppressionTimeout = null;
  }, THEME_TRANSITION_SUPPRESSION_MS);
};

export const applyTheme = (
  theme: ThemeMode,
  root: HTMLElement = document.documentElement,
  options: { suppressTransitions?: boolean } = {},
): ThemeMode => {
  if (options.suppressTransitions) suppressThemeTransitions(root);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  return theme;
};

export const readStoredTheme = (storage: Storage = localStorage): ThemeMode | null => {
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : null;
  } catch {
    return null;
  }
};

export const initTheme = (): ThemeMode => applyTheme(readStoredTheme() ?? DEFAULT_THEME);

export const setStoredTheme = (theme: ThemeMode, storage: Storage = localStorage): ThemeMode => {
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Some browsers can deny storage access; the in-memory document theme still updates.
  }

  return applyTheme(theme, document.documentElement, { suppressTransitions: true });
};
