<script lang="ts">
  import { onMount } from "svelte";
  import { resolve } from "$app/paths";

  import {
    getCurrentUserProfileState,
    loginWithBrowserWalletServicesAccount,
    logout,
  } from "$lib/auth/api";
  import { hasAuthSession } from "$lib/auth/session";
  import Button from "$lib/components/ui/Button.svelte";
  import { normalizeAuthorAddress, shortAuthorAddress } from "$lib/social/authorLabels";
  import { normalizeProfileUser } from "$lib/user/profileModel";

  type Props = {
    className?: string;
    showLogout?: boolean;
  };

  const { className = "", showLogout = true }: Props = $props();

  let isAuthenticated = $state(false);
  let address = $state("");
  let displayLabel = $state("");
  let isBusy = $state(false);
  let error = $state("");
  let menuOpen = $state(false);
  let rootElement: HTMLDivElement | null = null;
  let refreshRequestId = 0;

  const fallbackWalletLabel = (value: string): string =>
    shortAuthorAddress(value) || (value ? "Wallet" : "Account");

  const resolveProfileLabel = (payload: unknown, fallbackAddress: string): string => {
    const normalizedFallback = normalizeAuthorAddress(fallbackAddress);
    if (payload) {
      const profileUser = normalizeProfileUser(payload);
      const nickname = profileUser.nickname.trim();
      const normalizedNickname = normalizeAuthorAddress(nickname);
      if (nickname && nickname !== "Unknown" && normalizedNickname !== normalizedFallback) {
        return nickname;
      }
    }
    return fallbackWalletLabel(normalizedFallback);
  };

  const refresh = async () => {
    const requestId = ++refreshRequestId;
    isAuthenticated = hasAuthSession();
    error = "";
    if (!isAuthenticated) {
      address = "";
      displayLabel = "";
      menuOpen = false;
      return;
    }

    try {
      const profileState = await getCurrentUserProfileState({ preferCached: true });
      if (requestId !== refreshRequestId) return;
      const profileUser = profileState.me ? normalizeProfileUser(profileState.me) : null;
      const profileAddress = normalizeAuthorAddress(profileUser?.address ?? "");
      address = profileAddress || normalizeAuthorAddress(profileState.userId ?? "");
      displayLabel = resolveProfileLabel(profileState.me, address || profileState.userId || "");
      isAuthenticated = hasAuthSession();
    } catch {
      if (requestId !== refreshRequestId) return;
      address = "";
      displayLabel = fallbackWalletLabel("");
      isAuthenticated = hasAuthSession();
    }
  };

  const handleLogin = async () => {
    if (isBusy) return;
    isBusy = true;
    error = "";
    try {
      const result = await loginWithBrowserWalletServicesAccount();
      address = normalizeAuthorAddress(result.address);
      displayLabel = resolveProfileLabel(result.me, address);
      isAuthenticated = true;
      menuOpen = false;
    } catch (loginError) {
      error = loginError instanceof Error ? loginError.message : "MetaMask login failed.";
      isAuthenticated = hasAuthSession();
    } finally {
      isBusy = false;
    }
  };

  const handleLogout = async () => {
    if (isBusy) return;
    isBusy = true;
    error = "";
    try {
      await logout();
      address = "";
      displayLabel = "";
      isAuthenticated = false;
      menuOpen = false;
    } finally {
      isBusy = false;
    }
  };

  const toggleMenu = () => {
    if (isBusy) return;
    menuOpen = !menuOpen;
  };

  const closeMenu = () => {
    menuOpen = false;
  };

  onMount(() => {
    const handleAuthChange = () => {
      void refresh();
    };
    const handleDocumentPointerDown = (event: PointerEvent) => {
      if (!rootElement || !menuOpen) return;
      if (event.target instanceof Node && rootElement.contains(event.target)) return;
      menuOpen = false;
    };
    const handleDocumentKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") menuOpen = false;
    };

    void refresh();
    window.addEventListener("auth:change", handleAuthChange);
    window.addEventListener("profile:change", handleAuthChange);
    window.addEventListener("storage", handleAuthChange);
    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    document.addEventListener("keydown", handleDocumentKeydown);
    return () => {
      refreshRequestId += 1;
      window.removeEventListener("auth:change", handleAuthChange);
      window.removeEventListener("profile:change", handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
      document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
      document.removeEventListener("keydown", handleDocumentKeydown);
    };
  });
</script>

<div class={`wallet-auth ${className}`} bind:this={rootElement}>
  {#if isAuthenticated}
    <div class="wallet-menu">
      <button
        type="button"
        class="wallet-menu-trigger"
        title={address}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onclick={toggleMenu}
        disabled={isBusy}
      >
        <span>{isBusy ? "Signing out..." : displayLabel || fallbackWalletLabel(address)}</span>
        <span class="wallet-menu-caret" aria-hidden="true"></span>
      </button>

      {#if menuOpen}
        <div class="wallet-menu-list" role="menu">
          <a
            class="wallet-menu-item"
            role="menuitem"
            href={resolve("/account")}
            onclick={closeMenu}
          >
            Account page
          </a>
          {#if showLogout}
            <button
              class="wallet-menu-item"
              role="menuitem"
              type="button"
              onclick={() => void handleLogout()}
              disabled={isBusy}
            >
              Logout
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <Button
      variant="primary"
      type="button"
      className="wallet-login-trigger"
      onclick={handleLogin}
      disabled={isBusy}
    >
      {isBusy ? "Signing in..." : "Login with MetaMask"}
    </Button>
  {/if}

  {#if error}
    <span class="wallet-error" title={error}>{error}</span>
  {/if}
</div>

<style lang="postcss">
  @reference "$lib/styles/style.css";

  .wallet-auth {
    @apply flex min-w-0 flex-wrap items-center justify-end gap-2;
  }

  .wallet-menu {
    @apply relative min-w-0;
  }

  .wallet-menu-trigger {
    @apply flex max-w-[13rem] items-center gap-2 rounded-md border px-3 py-2 text-sm transition disabled:cursor-default disabled:opacity-70;
    background: var(--surface-panel-soft);
    border-color: var(--border-subtle);
    color: var(--text-secondary);
  }

  .wallet-menu-trigger:hover:not(:disabled),
  .wallet-menu-trigger[aria-expanded="true"] {
    background: var(--surface-card-hover);
    border-color: var(--border-strong);
    color: var(--text-primary);
  }

  .wallet-menu-trigger span:first-child {
    @apply min-w-0 truncate;
  }

  .wallet-menu-caret {
    @apply shrink-0;
    width: 0;
    height: 0;
    border-left: 0.25rem solid transparent;
    border-right: 0.25rem solid transparent;
    border-top: 0.3rem solid currentColor;
    opacity: 0.7;
  }

  .wallet-menu-list {
    @apply absolute right-0 top-[calc(100%+0.45rem)] z-50 grid min-w-[10rem] overflow-hidden rounded-md border py-1 text-sm;
    background: var(--surface-card);
    border-color: var(--border-subtle);
    box-shadow: var(--shadow-soft);
  }

  .wallet-menu-item {
    @apply block w-full px-3 py-2 text-left transition;
    color: var(--text-secondary);
  }

  .wallet-menu-item:hover,
  .wallet-menu-item:focus-visible {
    background: var(--surface-card-hover);
    color: var(--text-primary);
  }

  .wallet-menu-item:disabled {
    @apply cursor-default opacity-70;
  }

  .wallet-error {
    @apply max-w-[18rem] truncate text-xs;
    color: var(--color-danger, #f87171);
  }
</style>
