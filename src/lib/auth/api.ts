import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { mockCurrentUserId, mockFollowingByUserId, mockUsersById } from "$lib/data/users";
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

export const getUserById = async (userId: string) => {
  if (DEV_AUTH_BYPASS) {
    const user = mockUsersById[userId];
    if (!user) {
      throw new Error("User not found.");
    }
    return { user };
  }

  const response = await fetch(buildServicesApiUrl(`/users/${encodeURIComponent(userId)}`));
  const payload = await parseResponseBody(response);
  if (!response.ok) {
    // Transitional mixed mode: the network feed still uses mock user IDs (user-*, agent-*),
    // while auth/account runs against the real backend. Keep mock profiles functional in prod.
    const mockUser = mockUsersById[userId];
    if (response.status === 404 && mockUser) {
      return { user: mockUser };
    }
    throw new Error(extractErrorMessage(payload));
  }
  return payload;
};

export const updateUserById = async (
  userId: string,
  patch: Record<string, unknown>,
): Promise<unknown> => {
  if (DEV_AUTH_BYPASS) {
    const user = mockUsersById[userId];
    if (!user) throw new Error("User not found.");
    const displayName = typeof patch.display_name === "string" ? patch.display_name : undefined;
    const profileJson =
      patch.profile_json && typeof patch.profile_json === "object"
        ? (patch.profile_json as Record<string, unknown>)
        : undefined;
    const publicProfile =
      profileJson?.public && typeof profileJson.public === "object"
        ? (profileJson.public as Record<string, unknown>)
        : profileJson;
    const bio = typeof publicProfile?.bio === "string" ? publicProfile.bio : undefined;

    if (displayName) user.nickname = displayName;
    if (typeof bio === "string") user.bio = bio;

    return { user };
  }

  const response = await authFetch(`/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const payload = await parseResponseBody(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload));
  }
  return payload;
};

export const getFollowingIds = async (): Promise<string[]> => {
  if (DEV_AUTH_BYPASS) {
    return [...(mockFollowingByUserId[mockCurrentUserId] ?? [])];
  }

  const response = await authFetch("/social/following");
  const payload = await parseResponseBody(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload));
  }
  return Array.isArray(payload)
    ? payload.filter((entry): entry is string => typeof entry === "string")
    : [];
};

export const getFollowersIds = async (): Promise<string[]> => {
  if (DEV_AUTH_BYPASS) {
    return Object.entries(mockFollowingByUserId)
      .filter(([, following]) => (following ?? []).includes(mockCurrentUserId))
      .map(([userId]) => userId);
  }

  const response = await authFetch("/social/followers");
  const payload = await parseResponseBody(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload));
  }
  return Array.isArray(payload)
    ? payload.filter((entry): entry is string => typeof entry === "string")
    : [];
};

export const followUserById = async (followedId: string): Promise<void> => {
  if (DEV_AUTH_BYPASS) {
    const current = mockFollowingByUserId[mockCurrentUserId] ?? [];
    if (!current.includes(followedId)) {
      mockFollowingByUserId[mockCurrentUserId] = [...current, followedId];
    }
    return;
  }

  const response = await authFetch("/social/follow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ followed_id: followedId }),
  });
  if (!response.ok) {
    const payload = await parseResponseBody(response);
    throw new Error(extractErrorMessage(payload));
  }
};

export const unfollowUserById = async (followedId: string): Promise<void> => {
  if (DEV_AUTH_BYPASS) {
    const current = mockFollowingByUserId[mockCurrentUserId] ?? [];
    mockFollowingByUserId[mockCurrentUserId] = current.filter((id) => id !== followedId);
    return;
  }

  const response = await authFetch("/social/unfollow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ followed_id: followedId }),
  });
  if (!response.ok) {
    const payload = await parseResponseBody(response);
    throw new Error(extractErrorMessage(payload));
  }
};
