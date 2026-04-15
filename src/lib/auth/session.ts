import { browser } from "$app/environment";

const TOKEN_KEY = "hypermusic_token";
const CHAIN_TOKEN_KEY = "hypermusic_chain_token";
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

export const setChainToken = (token: string): void => {
  if (!browser) return;
  localStorage.setItem(CHAIN_TOKEN_KEY, token);
  notifyAuthChange();
};

export const clearChainToken = (): void => {
  if (!browser) return;
  localStorage.removeItem(CHAIN_TOKEN_KEY);
  notifyAuthChange();
};

export const hasAuthSession = (): boolean => Boolean(getToken() || getChainToken());
