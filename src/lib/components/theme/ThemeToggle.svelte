<script lang="ts">
  import { onMount } from "svelte";

  import {
    DEFAULT_THEME,
    initTheme,
    nextTheme,
    setStoredTheme,
    THEME_STORAGE_KEY,
    type ThemeMode,
  } from "$lib/theme/theme";

  let theme = $state<ThemeMode>(DEFAULT_THEME);
  const isLight = $derived(theme === "light");
  const label = $derived(isLight ? "Switch to dark theme" : "Switch to light theme");

  const syncTheme = () => {
    theme = initTheme();
  };

  const handleToggle = () => {
    theme = setStoredTheme(nextTheme(theme));
  };

  onMount(() => {
    syncTheme();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) syncTheme();
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  });
</script>

<button
  class="theme-toggle"
  type="button"
  aria-label={label}
  aria-pressed={isLight}
  title={label}
  onclick={handleToggle}
>
  <span class="theme-toggle-glyph" aria-hidden="true">{isLight ? "☀" : "☾"}</span>
</button>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .theme-toggle {
    position: fixed;
    top: 0.625rem;
    right: 0.625rem;
    z-index: 70;
    display: inline-grid;
    width: 2.25rem;
    height: 2.25rem;
    place-items: center;
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
    background: var(--surface-floating);
    color: var(--text-primary);
    box-shadow: var(--shadow-soft);
    backdrop-filter: blur(14px);
    transition:
      background-color 160ms ease,
      border-color 160ms ease,
      color 160ms ease,
      transform 160ms ease;
  }

  .theme-toggle:hover {
    border-color: var(--border-strong);
    background: var(--surface-floating-hover);
    transform: translateY(-1px);
  }

  .theme-toggle:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .theme-toggle-glyph {
    display: block;
    font-size: 1rem;
    line-height: 1;
  }
</style>
