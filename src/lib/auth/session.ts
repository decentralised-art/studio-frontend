import { browser } from "$app/environment";

const TOKEN_KEY = "hypermusic_token";
const CHAIN_TOKEN_KEY = "hypermusic_chain_token";
const CHAIN_TOKEN_USER_ID_KEY = "hypermusic_chain_token_user_id";
const AUTH_EVENT = "auth:change";

const notifyAuthChange = () => {
  if (!browser) return;
  window.dispatchEvent(new CustomEvent(AUTH_EVENT));
};

export const getToken = (): string | null => {
  if (!browser) return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string): void => {
  if (!browser) return;
  localStorage.setItem(TOKEN_KEY, token);
  notifyAuthChange();
};

export const clearToken = (): void => {
  if (!browser) return;
  localStorage.removeItem(TOKEN_KEY);
  notifyAuthChange();
};

export const getChainToken = (): string | null => {
  if (!browser) return null;
  return localStorage.getItem(CHAIN_TOKEN_KEY);
};

export const getChainTokenUserId = (): string | null => {
  if (!browser) return null;
  return localStorage.getItem(CHAIN_TOKEN_USER_ID_KEY);
};

export const setChainToken = (token: string, userId?: string): void => {
  if (!browser) return;
  localStorage.setItem(CHAIN_TOKEN_KEY, token);
  if (userId) {
    localStorage.setItem(CHAIN_TOKEN_USER_ID_KEY, userId);
  } else {
    localStorage.removeItem(CHAIN_TOKEN_USER_ID_KEY);
  }
  notifyAuthChange();
};

export const clearChainToken = (): void => {
  if (!browser) return;
  localStorage.removeItem(CHAIN_TOKEN_KEY);
  localStorage.removeItem(CHAIN_TOKEN_USER_ID_KEY);
  notifyAuthChange();
};

export const hasServicesSession = (): boolean => Boolean(getToken());

export const hasChainSession = (): boolean => Boolean(getChainToken());

export const hasAuthSession = hasServicesSession;
