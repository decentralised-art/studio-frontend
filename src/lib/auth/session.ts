import { browser } from "$app/environment";

const TOKEN_KEY = "hypermusic_token";
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
