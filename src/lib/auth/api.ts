import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import {
  extraChainSourceProfiles,
  mockCurrentUserId,
  mockFollowingByUserId,
  mockUsers,
  mockUsersById,
} from "$lib/data/users";
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
const SERVICES_ME_CACHE_KEY = "dcn_services_me_cache_v1";
const servicesPatchCacheByMockUserId = new Map<
  string,
  { ethereumAddress: string; patchedUserId: string | null }
>();
let cachedMePayloadMemory: unknown | null = null;

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

type HttpStatusError = Error & { status?: number };

const createStatusError = (message: string, status: number): HttpStatusError => {
  const error = new Error(message) as HttpStatusError;
  error.status = status;
  return error;
};

const isStatusError = (error: unknown, status: number): boolean => {
  if (!error || typeof error !== "object") return false;
  return (error as { status?: number }).status === status;
};

const shouldAttemptRegistrationAfterLoginError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: number }).status;
  return status === 401 || status === 404;
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

const loginOrRegisterWithServices = async (
  email: string,
  displayName: string,
  password: string,
): Promise<string> => {
  try {
    return await login(email, password);
  } catch (error) {
    if (!shouldAttemptRegistrationAfterLoginError(error)) {
      throw error;
    }

    try {
      await registerUser(email, displayName, password);
    } catch (registerError) {
      if (!isStatusError(registerError, 409)) {
        throw registerError;
      }
    }

    return login(email, password);
  }
};

const readCachedMePayload = (): unknown | null => {
  if (!browser) return cachedMePayloadMemory;
  if (cachedMePayloadMemory !== null) return cachedMePayloadMemory;
  try {
    const raw = window.localStorage.getItem(SERVICES_ME_CACHE_KEY);
    if (!raw) return null;
    cachedMePayloadMemory = JSON.parse(raw);
    return cachedMePayloadMemory;
  } catch {
    return null;
  }
};

const writeCachedMePayload = (payload: unknown) => {
  cachedMePayloadMemory = payload;
  if (!browser) return;
  try {
    window.localStorage.setItem(SERVICES_ME_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore cache write failures
  }
};

const clearCachedMePayload = () => {
  cachedMePayloadMemory = null;
  if (!browser) return;
  try {
    window.localStorage.removeItem(SERVICES_ME_CACHE_KEY);
  } catch {
    // ignore cache clear failures
  }
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
  options?: { patchServicesProfile?: boolean },
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

    const shouldPatchServicesProfile = options?.patchServicesProfile !== false;
    const servicesPatch = shouldPatchServicesProfile
      ? await ensureMockUserServicesEthereumAddress(userId, nickname, account.address)
      : {
          patchedUserId: null,
          ethereumAddressPatched: false,
          error: null,
        };
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
  const cached = servicesPatchCacheByMockUserId.get(userId);
  if (cached && cached.ethereumAddress.toLowerCase() === ethereumAddress.trim().toLowerCase()) {
    return {
      patchedUserId: cached.patchedUserId,
      ethereumAddressPatched: true,
      error: null,
    };
  }

  const previousToken = getToken();
  const credentials = mockCredentialsForUser(userId);

  try {
    await loginOrRegisterWithServices(credentials.email, nickname, credentials.password);

    const me = await getMe();
    const realUserId = extractUserIdFromUserPayload(me);
    if (!realUserId) {
      throw new Error("Services auth succeeded, but /auth/me did not return a user id.");
    }

    await updateUserById(realUserId, { ethereum_address: ethereumAddress });
    servicesPatchCacheByMockUserId.set(userId, {
      ethereumAddress: ethereumAddress.trim(),
      patchedUserId: realUserId,
    });
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

export const authenticateAllMockAccountsInChain = async (options?: {
  patchServicesProfile?: boolean;
}): Promise<MockChainAuthResult[]> => {
  const results: MockChainAuthResult[] = [];
  for (const user of mockUsers) {
    results.push(
      await authenticateMockUserInChain(user.id, user.nickname, {
        patchServicesProfile: options?.patchServicesProfile ?? false,
      }),
    );
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

  // Default login path should not perform services register/login side effects.
  // This keeps chain auth fast and avoids noisy 500/409 errors when services is unstable.
  const result = await authenticateMockUserInChain(user.id, user.nickname, {
    patchServicesProfile: false,
  });
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
  if (!token) {
    // Chain-only prototype sessions are valid for Studio/Network flows.
    // Avoid forced login redirects when services auth is unavailable.
    return new Response(JSON.stringify({ message: "Missing services auth token." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  headers.set("Authorization", `Bearer ${token}`);

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
    throw createStatusError(payload || "Login failed", response.status);
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
    throw createStatusError(extractErrorMessage(payload), response.status);
  }

  return payload;
};

export const loginOrRegisterUser = async (
  email: string,
  displayName: string,
  password: string,
): Promise<string> => loginOrRegisterWithServices(email, displayName, password);

export const logout = async (): Promise<void> => {
  const token = getToken();
  clearToken();
  clearChainToken();
  clearCachedMePayload();
  redirectToLogin();
  if (!token) return;

  // Optimistic logout UX: user is redirected immediately; backend session invalidation runs in background.
  void fetch(buildServicesApiUrl("/auth/logout"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {
    // Ignore background logout failures; local auth state is already cleared.
  });
};

export const getMe = async () => {
  const response = await authFetch("/auth/me");
  if (!response.ok) {
    throw new Error("Failed to load account.");
  }
  const payload = await response.json();
  writeCachedMePayload(payload);
  return payload;
};

export const getCachedMe = (): unknown | null => readCachedMePayload();

export type ServicesUserRecord = {
  id: string;
  email?: string;
  display_name?: string;
  ethereum_address?: string | null;
  [key: string]: unknown;
};

const coerceServicesUserRecord = (value: unknown): ServicesUserRecord | null => {
  if (typeof value === "string") {
    const id = value.trim();
    if (!id) return null;
    return { id };
  }

  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const nestedUser =
    record.user && typeof record.user === "object"
      ? (record.user as Record<string, unknown>)
      : null;
  const base = nestedUser ?? record;
  const id = typeof base.id === "string" ? base.id.trim() : "";
  if (!id) return null;
  return {
    ...base,
    id,
  };
};

const asUserRecordArray = (payload: unknown): ServicesUserRecord[] => {
  const toArray = (value: unknown): ServicesUserRecord[] =>
    Array.isArray(value)
      ? value
          .map((item) => coerceServicesUserRecord(item))
          .filter((item): item is ServicesUserRecord => Boolean(item))
      : [];

  const direct = toArray(payload);
  if (direct.length > 0) return direct;

  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;

  const primaryKeys = ["users", "items", "results", "data"] as const;
  for (const key of primaryKeys) {
    const found = toArray(root[key]);
    if (found.length > 0) return found;
  }

  if (root.data && typeof root.data === "object") {
    const nested = root.data as Record<string, unknown>;
    for (const key of primaryKeys) {
      const found = toArray(nested[key]);
      if (found.length > 0) return found;
    }
  }

  return [];
};

const mergeUserRecords = (
  base: ServicesUserRecord,
  override: ServicesUserRecord | null,
): ServicesUserRecord => {
  if (!override) return base;
  return { ...base, ...override, id: base.id };
};

const hasEthereumAddress = (user: ServicesUserRecord): boolean => {
  const direct = user.ethereum_address;
  if (typeof direct === "string" && direct.trim().length > 0) return true;
  const alt = user.ethereumAddress;
  return typeof alt === "string" && alt.trim().length > 0;
};

const hydrateServicesUsersById = async (
  users: ServicesUserRecord[],
): Promise<ServicesUserRecord[]> => {
  const toHydrate = users.filter((user) => !hasEthereumAddress(user));
  if (toHydrate.length === 0) return users;

  const settled = await Promise.allSettled(
    toHydrate.map(async (user) => {
      const response = await authFetch(`/users/${encodeURIComponent(user.id)}`);
      const payload = await parseResponseBody(response);
      if (!response.ok) return [user.id, null] as const;
      return [user.id, coerceServicesUserRecord(payload)] as const;
    }),
  );

  const hydratedById = new Map<string, ServicesUserRecord>();
  settled.forEach((result) => {
    if (result.status !== "fulfilled") return;
    const [id, maybeUser] = result.value;
    if (maybeUser) hydratedById.set(id, maybeUser);
  });

  return users.map((user) => mergeUserRecords(user, hydratedById.get(user.id) ?? null));
};

export const listServicesUsers = async (): Promise<ServicesUserRecord[]> => {
  const pagedUsers: ServicesUserRecord[] = [];
  const seenIds = new Set<string>();
  const pageLimit = 200;

  for (let page = 0; page < 25; page += 1) {
    const response = await authFetch(`/users?limit=${pageLimit}&page=${page}`);
    const payload = await parseResponseBody(response);
    if (!response.ok) {
      if (page === 0) break;
      throw new Error(extractErrorMessage(payload));
    }
    const batch = asUserRecordArray(payload);
    if (batch.length === 0) break;

    let newlyAdded = 0;
    batch.forEach((user) => {
      if (seenIds.has(user.id)) return;
      seenIds.add(user.id);
      pagedUsers.push(user);
      newlyAdded += 1;
    });

    // If API ignores page param and repeats the same items, stop to avoid looping.
    if (newlyAdded === 0) break;
    if (batch.length < pageLimit) break;
  }

  if (pagedUsers.length > 0) {
    return hydrateServicesUsersById(pagedUsers);
  }

  const fallbackResponse = await authFetch("/users");
  const fallbackPayload = await parseResponseBody(fallbackResponse);
  if (!fallbackResponse.ok) {
    throw new Error(extractErrorMessage(fallbackPayload));
  }
  return hydrateServicesUsersById(asUserRecordArray(fallbackPayload));
};

export const getUserById = async (userId: string) => {
  const response = await fetch(buildServicesApiUrl(`/users/${encodeURIComponent(userId)}`));
  const payload = await parseResponseBody(response);
  if (!response.ok) {
    // Transitional mixed mode: the network feed still uses mock user IDs (user-*, agent-*),
    // while auth/account runs against the real backend. Keep mock profiles functional in prod.
    const mockUser = [...mockUsers, ...extraChainSourceProfiles].find(
      (entry) => entry.id === userId,
    );
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

export type ToolboxLibraryProfile = {
  connector: string[];
  transformation: string[];
  condition: string[];
};

export type ToolboxItemKind = keyof ToolboxLibraryProfile;

export type SocialPreferencesProfile = {
  followedUserIds: string[];
  followedFormatIds: string[];
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const uniqueStrings = (values: string[]) =>
  Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));

const normalizeConnectorToolboxId = (value: string) =>
  value
    .trim()
    .replace(/^particle-/, "")
    .replace(/^feature-/, "");

const defaultToolboxLibrary = (): ToolboxLibraryProfile => ({
  connector: [],
  transformation: [],
  condition: [],
});

const defaultSocialPreferences = (): SocialPreferencesProfile => ({
  followedUserIds: [],
  followedFormatIds: [],
});

const defaultToolboxLibraryForPrototype = (): ToolboxLibraryProfile => {
  const fallbackUser = mockUsersById[mockCurrentUserId];
  if (!fallbackUser) return defaultToolboxLibrary();
  return {
    connector: uniqueStrings(fallbackUser.toolbox.map(normalizeConnectorToolboxId)),
    transformation: [],
    condition: [],
  };
};

const defaultSocialPreferencesForPrototype = (): SocialPreferencesProfile => {
  const explicit = mockFollowingByUserId[mockCurrentUserId] ?? [];
  const allMockUsers = mockUsers
    .map((entry) => entry.id)
    .filter((entry) => entry !== mockCurrentUserId);
  const extraSources = extraChainSourceProfiles
    .map((entry) => entry.id)
    .filter((entry) => entry !== mockCurrentUserId);
  const fallback = [...allMockUsers, ...extraSources];
  return {
    followedUserIds: uniqueStrings(explicit.length > 0 ? explicit : fallback),
    followedFormatIds: [],
  };
};

const deriveMockUserIdFromRecord = (userRecordRaw: unknown): string | null => {
  const userRecord = asRecord(userRecordRaw);

  const id = typeof userRecord.id === "string" ? userRecord.id.trim() : "";
  if (id && mockUsers.some((entry) => entry.id === id)) return id;

  const email = typeof userRecord.email === "string" ? userRecord.email.trim().toLowerCase() : "";
  if (email.endsWith("@mock.decentralised.art")) {
    const candidate = email.replace(/@mock\.decentralised\.art$/i, "");
    if (mockUsers.some((entry) => entry.id === candidate)) return candidate;
  }

  const displayName =
    typeof userRecord.display_name === "string"
      ? userRecord.display_name.trim()
      : typeof userRecord.displayName === "string"
        ? userRecord.displayName.trim()
        : "";
  if (displayName) {
    const matched = mockUsers.find((entry) => entry.nickname === displayName);
    if (matched) return matched.id;
  }

  return null;
};

const resolveSocialUserIdFromRecord = (userRecordRaw: unknown): string => {
  const userRecord = asRecord(userRecordRaw);
  const alias = deriveMockUserIdFromRecord(userRecord);
  if (alias) return alias;
  const id = typeof userRecord.id === "string" ? userRecord.id.trim() : "";
  return id;
};

const parseToolboxLibraryFromProfileJson = (profileJsonRaw: unknown): ToolboxLibraryProfile => {
  const profileJson = asRecord(profileJsonRaw);
  const profilePublic = asRecord(profileJson.public ?? profileJson.profile ?? profileJson);
  const toolboxLibrary = asRecord(profilePublic.toolbox_library ?? profilePublic.toolboxLibrary);
  const legacyConnectors = asStringArray(profilePublic.toolbox);

  return {
    connector: uniqueStrings(
      [
        ...asStringArray(toolboxLibrary.connector),
        ...asStringArray(toolboxLibrary.feature),
        ...legacyConnectors,
      ]
        .map(normalizeConnectorToolboxId)
        .filter((value) => value.length > 0),
    ),
    transformation: uniqueStrings(asStringArray(toolboxLibrary.transformation)),
    condition: uniqueStrings(asStringArray(toolboxLibrary.condition)),
  };
};

const parseSocialPreferencesFromProfileJson = (
  profileJsonRaw: unknown,
): SocialPreferencesProfile => {
  const profileJson = asRecord(profileJsonRaw);
  const profilePublic = asRecord(profileJson.public ?? profileJson.profile ?? profileJson);
  const social = asRecord(profilePublic.social_preferences ?? profilePublic.socialPreferences);

  return {
    followedUserIds: uniqueStrings([
      ...asStringArray(social.followed_user_ids),
      ...asStringArray(social.followedUserIds),
      ...asStringArray(profilePublic.followed_user_ids),
      ...asStringArray(profilePublic.followedUserIds),
      ...asStringArray(profilePublic.following_users),
    ]),
    followedFormatIds: uniqueStrings([
      ...asStringArray(social.followed_format_ids),
      ...asStringArray(social.followedFormatIds),
      ...asStringArray(social.followed_format_hashes),
      ...asStringArray(profilePublic.followed_format_ids),
      ...asStringArray(profilePublic.followedFormatIds),
      ...asStringArray(profilePublic.followed_format_hashes),
    ]),
  };
};

const extractUserEnvelope = (
  payload: unknown,
): {
  userId: string;
  profileJson: Record<string, unknown>;
  rootUser: Record<string, unknown>;
} | null => {
  const root = asRecord(payload);
  const nested = root.user && typeof root.user === "object" ? asRecord(root.user) : root;
  const userId = typeof nested.id === "string" ? nested.id : "";
  if (!userId) return null;
  const profileJson = asRecord(nested.profile_json ?? nested.profileJson);
  return { userId, profileJson, rootUser: nested };
};

const mergeToolboxIntoProfileJson = (
  existingProfileJsonRaw: unknown,
  toolboxLibrary: ToolboxLibraryProfile,
): Record<string, unknown> => {
  const existingProfileJson = asRecord(existingProfileJsonRaw);
  const profilePublic = asRecord(
    existingProfileJson.public ?? existingProfileJson.profile ?? existingProfileJson,
  );

  return {
    ...existingProfileJson,
    public: {
      ...profilePublic,
      toolbox: [...toolboxLibrary.connector],
      toolbox_library: {
        connector: [...toolboxLibrary.connector],
        transformation: [...toolboxLibrary.transformation],
        condition: [...toolboxLibrary.condition],
      },
    },
  };
};

const mergeSocialPreferencesIntoProfileJson = (
  existingProfileJsonRaw: unknown,
  socialPreferences: SocialPreferencesProfile,
): Record<string, unknown> => {
  const existingProfileJson = asRecord(existingProfileJsonRaw);
  const profilePublic = asRecord(
    existingProfileJson.public ?? existingProfileJson.profile ?? existingProfileJson,
  );
  const existingSocial = asRecord(
    profilePublic.social_preferences ?? profilePublic.socialPreferences,
  );

  return {
    ...existingProfileJson,
    public: {
      ...profilePublic,
      followed_user_ids: [...socialPreferences.followedUserIds],
      followed_format_ids: [...socialPreferences.followedFormatIds],
      followed_format_hashes: [...socialPreferences.followedFormatIds],
      social_preferences: {
        ...existingSocial,
        followed_user_ids: [...socialPreferences.followedUserIds],
        followed_format_ids: [...socialPreferences.followedFormatIds],
        followed_format_hashes: [...socialPreferences.followedFormatIds],
      },
    },
  };
};

export const getCurrentUserToolboxLibrary = async (): Promise<ToolboxLibraryProfile> => {
  if (!getToken()) {
    return defaultToolboxLibraryForPrototype();
  }
  const me = await getMe();
  const envelope = extractUserEnvelope(me);
  if (!envelope) {
    return defaultToolboxLibrary();
  }
  return parseToolboxLibraryFromProfileJson(envelope.profileJson);
};

export const saveCurrentUserToolboxLibrary = async (
  toolboxLibrary: ToolboxLibraryProfile,
): Promise<void> => {
  if (!getToken()) return;
  const me = await getMe();
  const envelope = extractUserEnvelope(me);
  if (!envelope) {
    throw new Error("Unable to resolve current user for toolbox save.");
  }

  const normalized: ToolboxLibraryProfile = {
    connector: uniqueStrings(toolboxLibrary.connector),
    transformation: uniqueStrings(toolboxLibrary.transformation),
    condition: uniqueStrings(toolboxLibrary.condition),
  };

  const nextProfileJson = mergeToolboxIntoProfileJson(envelope.profileJson, normalized);
  await updateUserById(envelope.userId, { profile_json: nextProfileJson });
};

export const addItemToCurrentUserToolbox = async (
  kind: ToolboxItemKind,
  itemId: string,
): Promise<void> => {
  if (!getToken()) return;
  const normalizedId = itemId.trim();
  if (!normalizedId) return;
  const toolbox = await getCurrentUserToolboxLibrary();
  if (toolbox[kind].includes(normalizedId)) return;
  await saveCurrentUserToolboxLibrary({
    ...toolbox,
    [kind]: [...toolbox[kind], normalizedId],
  });
};

export const addConnectorToCurrentUserToolbox = async (connectorId: string): Promise<void> =>
  addItemToCurrentUserToolbox("connector", normalizeConnectorToolboxId(connectorId));

export const addTransformationToCurrentUserToolbox = async (
  transformationId: string,
): Promise<void> => addItemToCurrentUserToolbox("transformation", transformationId);

export const addConditionToCurrentUserToolbox = async (conditionId: string): Promise<void> =>
  addItemToCurrentUserToolbox("condition", conditionId);

// Backward-compatible alias used by legacy call sites; "particle" IDs are connector IDs.
export const addParticleToCurrentUserToolbox = async (particleId: string): Promise<void> =>
  addConnectorToCurrentUserToolbox(particleId);

const getPrototypeDefaultFollowedUserIds = async (
  currentSocialUserId: string,
): Promise<string[]> => {
  const followed = new Set<string>();

  mockUsers.forEach((entry) => {
    if (entry.id !== currentSocialUserId) followed.add(entry.id);
  });
  extraChainSourceProfiles.forEach((entry) => {
    if (entry.id !== currentSocialUserId) followed.add(entry.id);
  });

  try {
    const users = await listServicesUsers();
    users.forEach((entry) => {
      const rawId = typeof entry.id === "string" ? entry.id.trim() : "";
      if (rawId && rawId !== currentSocialUserId) followed.add(rawId);
      const socialId = resolveSocialUserIdFromRecord(entry);
      if (socialId && socialId !== currentSocialUserId) followed.add(socialId);
    });
  } catch (error) {
    console.warn("[Auth] Failed to load services users for prototype follow bootstrap.", error);
  }

  return uniqueStrings(Array.from(followed));
};

export const getCurrentUserSocialPreferences = async (options?: {
  bootstrapPrototypeIfEmpty?: boolean;
}): Promise<SocialPreferencesProfile> => {
  if (!getToken()) {
    return defaultSocialPreferencesForPrototype();
  }
  const me = await getMe();
  const envelope = extractUserEnvelope(me);
  if (!envelope) {
    return defaultSocialPreferences();
  }

  const socialUserId = resolveSocialUserIdFromRecord(envelope.rootUser) || envelope.userId;
  let preferences = parseSocialPreferencesFromProfileJson(envelope.profileJson);
  if (options?.bootstrapPrototypeIfEmpty && preferences.followedUserIds.length === 0) {
    const defaults = await getPrototypeDefaultFollowedUserIds(socialUserId);
    if (defaults.length > 0) {
      preferences = {
        ...preferences,
        followedUserIds: defaults,
      };
      try {
        const nextProfileJson = mergeSocialPreferencesIntoProfileJson(
          envelope.profileJson,
          preferences,
        );
        await updateUserById(envelope.userId, { profile_json: nextProfileJson });
      } catch (error) {
        console.warn("[Auth] Failed to persist prototype follow bootstrap.", error);
      }
    }
  }

  return preferences;
};

export const saveCurrentUserSocialPreferences = async (
  preferences: SocialPreferencesProfile,
): Promise<void> => {
  if (!getToken()) return;
  const me = await getMe();
  const envelope = extractUserEnvelope(me);
  if (!envelope) {
    throw new Error("Unable to resolve current user for social preferences save.");
  }

  const normalized: SocialPreferencesProfile = {
    followedUserIds: uniqueStrings(preferences.followedUserIds),
    followedFormatIds: uniqueStrings(preferences.followedFormatIds),
  };

  const nextProfileJson = mergeSocialPreferencesIntoProfileJson(envelope.profileJson, normalized);
  await updateUserById(envelope.userId, { profile_json: nextProfileJson });
};

export const followUserInProfile = async (userId: string): Promise<void> => {
  const normalizedId = userId.trim();
  if (!normalizedId) return;

  if (!getToken()) {
    const current = mockFollowingByUserId[mockCurrentUserId] ?? [];
    if (!current.includes(normalizedId)) {
      mockFollowingByUserId[mockCurrentUserId] = [...current, normalizedId];
    }
    return;
  }

  const preferences = await getCurrentUserSocialPreferences();
  if (preferences.followedUserIds.includes(normalizedId)) return;
  await saveCurrentUserSocialPreferences({
    ...preferences,
    followedUserIds: [...preferences.followedUserIds, normalizedId],
  });
};

export const unfollowUserInProfile = async (userId: string): Promise<void> => {
  const normalizedId = userId.trim();
  if (!normalizedId) return;

  if (!getToken()) {
    const current = mockFollowingByUserId[mockCurrentUserId] ?? [];
    if (!current.includes(normalizedId)) return;
    mockFollowingByUserId[mockCurrentUserId] = current.filter((id) => id !== normalizedId);
    return;
  }

  const preferences = await getCurrentUserSocialPreferences();
  if (!preferences.followedUserIds.includes(normalizedId)) return;
  await saveCurrentUserSocialPreferences({
    ...preferences,
    followedUserIds: preferences.followedUserIds.filter((id) => id !== normalizedId),
  });
};

export const followFormatInProfile = async (formatIdOrSlug: string): Promise<void> => {
  if (!getToken()) return;
  const normalizedId = formatIdOrSlug.trim();
  if (!normalizedId) return;
  const preferences = await getCurrentUserSocialPreferences();
  if (preferences.followedFormatIds.includes(normalizedId)) return;
  await saveCurrentUserSocialPreferences({
    ...preferences,
    followedFormatIds: [...preferences.followedFormatIds, normalizedId],
  });
};

export const unfollowFormatInProfile = async (formatIdOrSlug: string): Promise<void> => {
  if (!getToken()) return;
  const normalizedId = formatIdOrSlug.trim();
  if (!normalizedId) return;
  const preferences = await getCurrentUserSocialPreferences();
  if (!preferences.followedFormatIds.includes(normalizedId)) return;
  await saveCurrentUserSocialPreferences({
    ...preferences,
    followedFormatIds: preferences.followedFormatIds.filter((id) => id !== normalizedId),
  });
};

export const getUserSocialConnections = async (
  targetUserId: string,
): Promise<{ followingIds: string[]; followerIds: string[] }> => {
  if (!getToken()) {
    const normalizedTarget = targetUserId.trim();
    if (!normalizedTarget) return { followingIds: [], followerIds: [] };
    const targetFollowing =
      mockFollowingByUserId[normalizedTarget as keyof typeof mockFollowingByUserId];
    const followerIds = Object.entries(mockFollowingByUserId)
      .filter(([id, followed]) => id !== normalizedTarget && followed.includes(normalizedTarget))
      .map(([id]) => id);
    return {
      followingIds: uniqueStrings([...(targetFollowing ?? [])]),
      followerIds: uniqueStrings(followerIds),
    };
  }
  const normalizedTarget = targetUserId.trim();
  if (!normalizedTarget) return { followingIds: [], followerIds: [] };

  const users = await listServicesUsers();
  const graph = users.map((entry) => {
    const rawId = typeof entry.id === "string" ? entry.id.trim() : "";
    const socialId = resolveSocialUserIdFromRecord(entry);
    const profileJson = entry.profile_json;
    const preferences = parseSocialPreferencesFromProfileJson(profileJson);
    return {
      rawId,
      socialId,
      followedUserIds: preferences.followedUserIds,
    };
  });

  const targetEntry =
    graph.find((entry) => entry.socialId === normalizedTarget) ??
    graph.find((entry) => entry.rawId === normalizedTarget);

  if (!targetEntry) return { followingIds: [], followerIds: [] };

  const targetAliases = new Set([targetEntry.socialId, targetEntry.rawId, normalizedTarget]);
  const followerIds = graph
    .filter((entry) => entry.socialId && entry.socialId !== targetEntry.socialId)
    .filter((entry) => entry.followedUserIds.some((followed) => targetAliases.has(followed)))
    .map((entry) => entry.socialId || entry.rawId)
    .filter((id): id is string => Boolean(id));

  return {
    followingIds: uniqueStrings(targetEntry.followedUserIds),
    followerIds: uniqueStrings(followerIds),
  };
};

// Kept for compatibility with existing non-profile follow integrations.
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
