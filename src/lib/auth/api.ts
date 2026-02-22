import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { mockCurrentUserId, mockUsersById } from "$lib/data/users";
import { buildServicesApiUrl } from "$lib/url/url";
import { clearToken, getToken, setToken } from "./session";

const DEV_AUTH_BYPASS =
  import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH_BYPASS?.toString() === "1";
const DEV_AUTH_BYPASS_TOKEN = "dev-auth-bypass-token";

export const isDevAuthBypassEnabled = DEV_AUTH_BYPASS;

const redirectToLogin = () => {
  if (!browser) return;
  goto(resolve("/login"));
};

const buildDevUserPayload = () => {
  const user = mockUsersById[mockCurrentUserId];
  return { user };
};

export const loginWithDevMockAccount = async (): Promise<string> => {
  if (!DEV_AUTH_BYPASS) {
    throw new Error("Dev auth bypass is disabled.");
  }
  setToken(DEV_AUTH_BYPASS_TOKEN);
  return DEV_AUTH_BYPASS_TOKEN;
};

const parseTokenFromResponse = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const tokenCandidate =
        record.token ?? record.access_token ?? record.accessToken ?? record.session;
      if (typeof tokenCandidate === "string") return tokenCandidate;
    }
  } catch {
    // plain text token
  }

  return trimmed;
};

const parseResponseBody = async (response: Response) => {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
};

const extractErrorMessage = (payload: unknown): string => {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const message =
      record.message ?? record.error ?? record.detail ?? record.reason ?? record.status;
    if (typeof message === "string") return message;
  }
  return "Request failed.";
};

export const authFetch = async (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(buildServicesApiUrl(path), {
    ...init,
    headers,
  });

  if (!response.ok && (response.status === 401 || response.status === 403)) {
    clearToken();
    redirectToLogin();
  }

  return response;
};

export const login = async (email: string, password: string): Promise<string> => {
  if (DEV_AUTH_BYPASS) {
    return loginWithDevMockAccount();
  }

  const response = await fetch(buildServicesApiUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const payload = await response.text();
  if (!response.ok) {
    throw new Error(payload || "Login failed");
  }

  const token = parseTokenFromResponse(payload);
  if (!token) {
    throw new Error("No token returned from login.");
  }

  setToken(token);
  return token;
};

export const registerUser = async (email: string, displayName: string, password: string) => {
  if (DEV_AUTH_BYPASS) {
    return {
      ...buildDevUserPayload(),
      mock: true,
      registered_as: { email, displayName, password: password ? "********" : "" },
    };
  }

  const response = await fetch(buildServicesApiUrl("/users"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      display_name: displayName,
      password,
    }),
  });

  const payload = await parseResponseBody(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload));
  }

  return payload;
};

export const logout = async (): Promise<void> => {
  if (DEV_AUTH_BYPASS) {
    clearToken();
    redirectToLogin();
    return;
  }

  await authFetch("/auth/logout", { method: "POST" });
  clearToken();
  redirectToLogin();
};

export const getMe = async () => {
  if (DEV_AUTH_BYPASS) {
    return buildDevUserPayload();
  }

  const response = await authFetch("/auth/me");
  if (!response.ok) {
    throw new Error("Failed to load account.");
  }
  return response.json();
};
