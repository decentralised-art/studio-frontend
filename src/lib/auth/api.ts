import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { mockCurrentUserId, mockUsers } from "$lib/data/users";
import { buildChainApiUrl, buildServicesApiUrl } from "$lib/url/url";
import { createChainAuthRequest, getOrCreateMockEthereumAccount } from "./mockEthereum";
import {
  clearChainToken,
  clearToken,
  getChainToken,
  getToken,
  setChainToken,
  setToken,
} from "./session";

export type MockChainAuthResult = {
  userId: string;
  nickname: string;
  address: string;
  publicKey: string;
  privateKey: string;
  nonce: string | null;
  message: string | null;
  signature: string | null;
  token: string | null;
  patchedUserId: string | null;
  ethereumAddressPatched: boolean;
  success: boolean;
  error: string | null;
};

const MOCK_USER_PASSWORD = "mock-user-password";

const mockCredentialsForUser = (userId: string) => ({
  email: `${userId}@mock.decentralised.art`,
  password: MOCK_USER_PASSWORD,
});

const redirectToLogin = () => {
  if (!browser) return;
  goto(resolve("/login"));
};

const parseTokenFromPayload = (payload: unknown): string => {
  if (typeof payload === "string") {
    return parseTokenFromResponse(payload);
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const nested =
      record.data && typeof record.data === "object"
        ? (record.data as Record<string, unknown>)
        : null;
    const tokenCandidate =
      record.token ??
      record.jwt ??
      record.access_token ??
      record.accessToken ??
      record.session ??
      nested?.token ??
      nested?.jwt ??
      nested?.access_token ??
      nested?.accessToken ??
      nested?.session;
    if (typeof tokenCandidate === "string") {
      return tokenCandidate.trim();
    }
  }

  return "";
};

const parseTokenFromResponse = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const nested =
        record.data && typeof record.data === "object"
          ? (record.data as Record<string, unknown>)
          : null;
      const tokenCandidate =
        record.token ??
        record.jwt ??
        record.access_token ??
        record.accessToken ??
        record.session ??
        nested?.token ??
        nested?.jwt ??
        nested?.access_token ??
        nested?.accessToken ??
        nested?.session;
      if (typeof tokenCandidate === "string") return tokenCandidate;
    }
  } catch {
    // plain text token
  }

  return trimmed;
};

const parseNonceFromPayload = (payload: unknown): string => {
  if (typeof payload === "string") {
    return payload.trim();
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const nested =
      record.data && typeof record.data === "object"
        ? (record.data as Record<string, unknown>)
        : null;
    const nonceCandidate =
      record.nonce ??
      record.login_nonce ??
      record.loginNonce ??
      record.challenge ??
      record.message ??
      nested?.nonce ??
      nested?.login_nonce ??
      nested?.loginNonce ??
      nested?.challenge;
    if (typeof nonceCandidate === "string") {
      return nonceCandidate.trim();
    }
  }

  return "";
};

const parseResponseBody = async (response: Response) => {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
};

const shouldRetryWithAlternatePayload = (statusCode: number): boolean =>
  statusCode === 400 ||
  statusCode === 404 ||
  statusCode === 405 ||
  statusCode === 415 ||
  statusCode === 422;

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

const requestChainNonce = async (address: string): Promise<string> => {
  const nonceUrl = buildChainApiUrl(`/nonce/${encodeURIComponent(address)}`);
  const response = await fetch(nonceUrl, { method: "GET" });
  const payload = await parseResponseBody(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload));
  }

  const nonce = parseNonceFromPayload(payload);
  if (!nonce) {
    throw new Error("Chain nonce response did not include a nonce.");
  }
  return nonce;
};

const requestChainAuthToken = async (
  authRequest: ReturnType<typeof createChainAuthRequest>,
): Promise<string> => {
  const authUrl = buildChainApiUrl("/auth");

  const primaryResponse = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(authRequest),
  });
  const primaryPayload = await parseResponseBody(primaryResponse);
  if (primaryResponse.ok) {
    const token = parseTokenFromPayload(primaryPayload);
    if (!token) {
      throw new Error("No token returned from chain auth.");
    }
    return token;
  }

  if (!shouldRetryWithAlternatePayload(primaryResponse.status)) {
    throw new Error(extractErrorMessage(primaryPayload));
  }

  const fallbackResponse = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ auth_request: authRequest }),
  });
  const fallbackPayload = await parseResponseBody(fallbackResponse);
  if (!fallbackResponse.ok) {
    throw new Error(extractErrorMessage(fallbackPayload));
  }

  const token = parseTokenFromPayload(fallbackPayload);
  if (!token) {
    throw new Error("No token returned from chain auth.");
  }
  return token;
};

const authenticateMockUserInChain = async (
  userId: string,
  nickname: string,
): Promise<MockChainAuthResult> => {
  const account = getOrCreateMockEthereumAccount(`mock-user:${userId}`);
  const mockUser = mockUsers.find((entry) => entry.id === userId);

  let nonce: string | null = null;
  let message: string | null = null;
  let signature: string | null = null;
  let token: string | null = null;
  let patchedUserId: string | null = null;

  try {
    nonce = await requestChainNonce(account.address);
    const authRequest = createChainAuthRequest(account, nonce);
    message = authRequest.message;
    signature = authRequest.signature;
    token = await requestChainAuthToken(authRequest);
    if (mockUser) {
      mockUser.address = account.address;
    }

    const servicesPatch = await ensureMockUserServicesEthereumAddress(
      userId,
      nickname,
      account.address,
    );
    patchedUserId = servicesPatch.patchedUserId;

    return {
      userId,
      nickname,
      address: account.address,
      publicKey: account.publicKey,
      privateKey: account.privateKey,
      nonce,
      message,
      signature,
      token,
      patchedUserId,
      ethereumAddressPatched: servicesPatch.ethereumAddressPatched,
      success: true,
      error: servicesPatch.error,
    };
  } catch (err) {
    return {
      userId,
      nickname,
      address: account.address,
      publicKey: account.publicKey,
      privateKey: account.privateKey,
      nonce,
      message,
      signature,
      token,
      patchedUserId,
      ethereumAddressPatched: false,
      success: false,
      error: err instanceof Error ? err.message : "Chain auth failed.",
    };
  }
};

const extractUserIdFromUserPayload = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.id === "string") return record.id;
  const user = record.user;
  if (user && typeof user === "object") {
    const nested = user as Record<string, unknown>;
    if (typeof nested.id === "string") return nested.id;
  }
  return null;
};

const ensureMockUserServicesEthereumAddress = async (
  userId: string,
  nickname: string,
  ethereumAddress: string,
): Promise<{
  patchedUserId: string | null;
  ethereumAddressPatched: boolean;
  error: string | null;
}> => {
  const previousToken = getToken();
  const credentials = mockCredentialsForUser(userId);

  try {
    try {
      await login(credentials.email, credentials.password);
    } catch {
      await registerUser(credentials.email, nickname, credentials.password);
      await login(credentials.email, credentials.password);
    }

    const me = await getMe();
    const realUserId = extractUserIdFromUserPayload(me);
    if (!realUserId) {
      throw new Error("Services auth succeeded, but /auth/me did not return a user id.");
    }

    await updateUserById(realUserId, { ethereum_address: ethereumAddress });
    return {
      patchedUserId: realUserId,
      ethereumAddressPatched: true,
      error: null,
    };
  } catch (error) {
    return {
      patchedUserId: null,
      ethereumAddressPatched: false,
      error:
        error instanceof Error
          ? `Chain auth succeeded, but failed to patch services user: ${error.message}`
          : "Chain auth succeeded, but failed to patch services user.",
    };
  } finally {
    if (previousToken) setToken(previousToken);
    else clearToken();
  }
};

export const authenticateAllMockAccountsInChain = async (): Promise<MockChainAuthResult[]> => {
  const results: MockChainAuthResult[] = [];
  for (const user of mockUsers) {
    results.push(await authenticateMockUserInChain(user.id, user.nickname));
  }
  return results;
};

export const loginWithMockChainAccount = async (
  userId: string = mockCurrentUserId,
): Promise<string> => {
  const user = mockUsers.find((entry) => entry.id === userId);
  if (!user) {
    throw new Error(`Mock user not found: ${userId}`);
  }

  const result = await authenticateMockUserInChain(user.id, user.nickname);
  if (!result.success || !result.token) {
    throw new Error(result.error ?? "Mock chain login failed.");
  }

  setChainToken(result.token);
  return result.token;
};

export const chainAuthFetch = async (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  const token = getChainToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(buildChainApiUrl(path), {
    ...init,
    headers,
  });
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
  await authFetch("/auth/logout", { method: "POST" });
  clearToken();
  clearChainToken();
  redirectToLogin();
};

export const getMe = async () => {
  const response = await authFetch("/auth/me");
  if (!response.ok) {
    throw new Error("Failed to load account.");
  }
  return response.json();
};

export const getUserById = async (userId: string) => {
  const response = await fetch(buildServicesApiUrl(`/users/${encodeURIComponent(userId)}`));
  const payload = await parseResponseBody(response);
  if (!response.ok) {
    // Transitional mixed mode: the network feed still uses mock user IDs (user-*, agent-*),
    // while auth/account runs against the real backend. Keep mock profiles functional in prod.
    const mockUser = mockUsers.find((entry) => entry.id === userId);
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
