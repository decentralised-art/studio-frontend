// The language tab a reader picked (for example "JavaScript" or "Python"), shared by every code
// block on the page and remembered between visits.
const STORAGE_KEY = "decentralised-art-docs-language";

let preferred = $state<string | null>(null);

export const languagePreference = {
  get value() {
    return preferred;
  },
  set(label: string) {
    preferred = label;
    try {
      localStorage.setItem(STORAGE_KEY, label);
    } catch {
      // Storage can be unavailable (private mode, blocked site data); the choice still applies.
    }
  },
  restore() {
    try {
      preferred = localStorage.getItem(STORAGE_KEY) ?? preferred;
    } catch {
      // Keep the default.
    }
  },
};
