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
import {
  createEmptyToolboxLibrary,
  normalizeConnectorToolboxId,
  normalizeToolboxIdByKind,
  normalizeToolboxLibrary,
  normalizeToolboxListByKind,
  type ToolboxItemKind as ToolboxItemKindValue,
  type ToolboxLibrary,
} from "$lib/toolbox/toolboxLibrary";
import { buildChainApiUrl, buildServicesApiUrl } from "$lib/url/url";
import {
  createChainAuthRequest,
  getOrCreateMockEthereumAccount,
  getStoredMockEthereumAccount,
} from "./mockEthereum";
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

  // Keep Services profile ethereum_address aligned with active chain signer so
  // account identity, feed source derivation, and authored ownership stay consistent.
  const result = await authenticateMockUserInChain(user.id, user.nickname, {
    patchServicesProfile: true,
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
  const toHydrate = users.filter((user) => {
    if (hasEthereumAddress(user)) return false;
    const id = typeof user.id === "string" ? user.id.trim() : "";
    if (/^0x[0-9a-f]{40}$/i.test(id)) return false;
    return true;
  });
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
  // Profile updates (social/toolbox/nickname) must invalidate /auth/me cache,
  // otherwise cross-page state can remain stale until manual refresh.
  clearCachedMePayload();
  return payload;
};

export type ToolboxLibraryProfile = ToolboxLibrary;

export type ToolboxItemKind = ToolboxItemKindValue;

export type SocialPreferencesProfile = {
  followedUserAddresses: string[];
  followedFormatHashes: string[];
};

export type CurrentUserProfileState = {
  me: unknown | null;
  userId: string | null;
  social: SocialPreferencesProfile;
  toolbox: ToolboxLibraryProfile;
};

const decodeBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  if (typeof atob === "function") {
    return atob(padded);
  }
  return "";
};

const tryParseJwtPayload = (token: string): Record<string, unknown> | null => {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const decoded = decodeBase64Url(parts[1]);
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const resolveAddressFromJwtPayload = (payload: Record<string, unknown>): string => {
  const candidates = [
    payload.address,
    payload.wallet_address,
    payload.walletAddress,
    payload.ethereum_address,
    payload.ethereumAddress,
    payload.sub,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const normalized = normalizeFollowAddress(candidate);
    if (normalized) return normalized;
  }
  return "";
};

const resolveActiveChainSignerAddress = (): string => {
  const token = getChainToken();
  if (!token) return "";
  const payload = tryParseJwtPayload(token);
  if (!payload) return "";
  return resolveAddressFromJwtPayload(payload);
};

export const resolveCurrentUserChainSourceAddresses = (mePayload: unknown): string[] => {
  const sourceSet = new Set<string>();
  const activeSignerAddress = resolveActiveChainSignerAddress();
  if (activeSignerAddress) sourceSet.add(activeSignerAddress);

  const envelope = extractUserEnvelope(mePayload);
  if (!envelope) return Array.from(sourceSet);

  const profileAddress = normalizeFollowAddress(
    typeof envelope.rootUser.ethereum_address === "string"
      ? envelope.rootUser.ethereum_address
      : typeof envelope.rootUser.ethereumAddress === "string"
        ? envelope.rootUser.ethereumAddress
        : "",
  );
  if (profileAddress) {
    sourceSet.add(profileAddress);
  }

  resolveProfileChainSourceAddresses(envelope.profileJson).forEach((address) => {
    sourceSet.add(address);
  });
  resolvePrototypeAccountChainSourceAddresses(envelope).forEach((address) => {
    sourceSet.add(address);
  });

  if (browser) {
    const email =
      typeof envelope.rootUser.email === "string"
        ? envelope.rootUser.email.trim().toLowerCase()
        : "";
    if (email.endsWith("@mock.decentralised.art")) {
      const mockUserId = email.replace(/@mock\.decentralised\.art$/i, "");
      if (mockUserId) {
        const mockChainAddress = normalizeFollowAddress(
          getStoredMockEthereumAccount(`mock-user:${mockUserId}`)?.address ?? "",
        );
        if (mockChainAddress) {
          sourceSet.add(mockChainAddress);
        }
      }
    }
  }

  return Array.from(sourceSet);
};

export type UserSocialConnectionsStatus = "ok" | "address_not_indexed_in_services";

export type UserSocialConnections = {
  followingIds: string[];
  followerIds: string[];
  status: UserSocialConnectionsStatus;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const uniqueStrings = (values: string[]) =>
  Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));

const ETH_ADDRESS_RE = /^0x[0-9a-f]{40}$/;
const FORMAT_HASH_RE = /^0x[0-9a-f]{64}$/;
// Public demo content authored by the prototype account before local mock signers were regenerated.
const PROTOTYPE_TEST_ACCOUNT_CHAIN_SOURCE_ADDRESS = "0xb584a15f38c2014cff54fdb1b417428b51999276";

const normalizeFollowAddress = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return ETH_ADDRESS_RE.test(prefixed) ? prefixed : "";
};

const resolveProfileChainSourceAddresses = (profileJsonRaw: unknown): string[] => {
  const profileJson = asRecord(profileJsonRaw);
  const profilePublic = asRecord(profileJson.public ?? profileJson.profile ?? profileJson);
  const sourceAliases = asRecord(
    profilePublic.source_aliases ?? profilePublic.sourceAliases ?? profilePublic.chain_sources,
  );

  return uniqueStrings(
    [
      ...asStringArray(profilePublic.chain_source_addresses),
      ...asStringArray(profilePublic.chainSourceAddresses),
      ...asStringArray(profilePublic.source_addresses),
      ...asStringArray(profilePublic.sourceAddresses),
      ...asStringArray(profilePublic.author_source_addresses),
      ...asStringArray(profilePublic.authorSourceAddresses),
      ...asStringArray(sourceAliases.chain_source_addresses),
      ...asStringArray(sourceAliases.chainSourceAddresses),
      ...asStringArray(sourceAliases.addresses),
    ]
      .map(normalizeFollowAddress)
      .filter(Boolean),
  );
};

const resolvePrototypeAccountChainSourceAddresses = (envelope: {
  rootUser: Record<string, unknown>;
}): string[] => {
  const email =
    typeof envelope.rootUser.email === "string" ? envelope.rootUser.email.trim().toLowerCase() : "";
  const displayName =
    typeof envelope.rootUser.display_name === "string"
      ? envelope.rootUser.display_name.trim()
      : typeof envelope.rootUser.displayName === "string"
        ? envelope.rootUser.displayName.trim()
        : "";

  if (email !== "user-lyra@mock.decentralised.art" && displayName !== "prototype_test_account") {
    return [];
  }

  return [PROTOTYPE_TEST_ACCOUNT_CHAIN_SOURCE_ADDRESS];
};

const resolveStoredMockUserAddress = (userId: string): string => {
  if (!browser) return "";
  return normalizeFollowAddress(getStoredMockEthereumAccount(`mock-user:${userId}`)?.address ?? "");
};

const resolveKnownPrototypeUserAddress = (userId: string): string => {
  const target = userId.trim();
  if (!target) return "";
  const mockUser = mockUsers.find((entry) => entry.id === target);
  if (mockUser) {
    return resolveStoredMockUserAddress(target) || normalizeFollowAddress(mockUser.address);
  }
  const user = extraChainSourceProfiles.find((entry) => entry.id === target);
  return normalizeFollowAddress(user?.address ?? "");
};

const normalizeFollowTarget = (value: string): string =>
  normalizeFollowAddress(value) || resolveKnownPrototypeUserAddress(value);

const resolveMockUserIdFromMePayload = (mePayload: unknown): string | null => {
  const envelope = extractUserEnvelope(mePayload);
  if (!envelope) return null;

  const email =
    typeof envelope.rootUser.email === "string" ? envelope.rootUser.email.trim().toLowerCase() : "";
  if (email.endsWith("@mock.decentralised.art")) {
    const fromEmail = email.replace(/@mock\.decentralised\.art$/i, "");
    if (mockUsersById[fromEmail as keyof typeof mockUsersById]) return fromEmail;
  }

  const displayName =
    typeof envelope.rootUser.display_name === "string"
      ? envelope.rootUser.display_name.trim()
      : typeof envelope.rootUser.displayName === "string"
        ? envelope.rootUser.displayName.trim()
        : "";
  if (displayName) {
    const byName = mockUsers.find((entry) => entry.nickname === displayName);
    if (byName) return byName.id;
  }

  const address = normalizeFollowAddress(
    typeof envelope.rootUser.ethereum_address === "string"
      ? envelope.rootUser.ethereum_address
      : typeof envelope.rootUser.ethereumAddress === "string"
        ? envelope.rootUser.ethereumAddress
        : "",
  );
  if (address) {
    const byAddress = mockUsers.find((entry) => normalizeFollowAddress(entry.address) === address);
    if (byAddress) return byAddress.id;
  }

  return null;
};

const resolveMockUserIdFromActiveChainSigner = (): string | null => {
  if (!browser) return null;
  const activeSignerAddress = resolveActiveChainSignerAddress();
  if (!activeSignerAddress) return null;

  for (const user of mockUsers) {
    const storedAddress = normalizeFollowAddress(
      getStoredMockEthereumAccount(`mock-user:${user.id}`)?.address ?? "",
    );
    if (storedAddress && storedAddress === activeSignerAddress) return user.id;
  }

  return null;
};

const defaultSocialPreferencesForPrototype = (userId: string): SocialPreferencesProfile => {
  const followedIds = mockFollowingByUserId[userId as keyof typeof mockFollowingByUserId] ?? [];
  const followedUserAddresses = uniqueStrings(
    followedIds.map((id) => resolveKnownPrototypeUserAddress(id)).filter(Boolean),
  );

  return {
    followedUserAddresses,
    followedFormatHashes: [],
  };
};

const normalizeFollowFormatHash = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return FORMAT_HASH_RE.test(prefixed) ? prefixed : "";
};

const defaultToolboxLibrary = (): ToolboxLibraryProfile => createEmptyToolboxLibrary();

const defaultSocialPreferences = (): SocialPreferencesProfile => ({
  followedUserAddresses: [],
  followedFormatHashes: [],
});

const defaultToolboxLibraryForPrototype = (): ToolboxLibraryProfile => {
  const fallbackUser = mockUsersById[mockCurrentUserId];
  if (!fallbackUser) return defaultToolboxLibrary();
  return {
    connector: normalizeToolboxListByKind("connector", fallbackUser.toolbox),
    transformation: [],
    condition: [],
  };
};

const parseToolboxLibraryFromProfileJson = (profileJsonRaw: unknown): ToolboxLibraryProfile => {
  const profileJson = asRecord(profileJsonRaw);
  const profilePublic = asRecord(profileJson.public ?? profileJson.profile ?? profileJson);
  const toolboxLibrary = asRecord(profilePublic.toolbox_library ?? profilePublic.toolboxLibrary);
  const legacyConnectors = asStringArray(profilePublic.toolbox);

  return {
    connector: normalizeToolboxListByKind("connector", [
      ...asStringArray(toolboxLibrary.connector),
      ...asStringArray(toolboxLibrary.feature),
      ...legacyConnectors,
    ]),
    transformation: normalizeToolboxListByKind(
      "transformation",
      asStringArray(toolboxLibrary.transformation),
    ),
    condition: normalizeToolboxListByKind("condition", asStringArray(toolboxLibrary.condition)),
  };
};

const parseSocialPreferencesFromProfileJson = (
  profileJsonRaw: unknown,
): SocialPreferencesProfile => {
  const profileJson = asRecord(profileJsonRaw);
  const profilePublic = asRecord(profileJson.public ?? profileJson.profile ?? profileJson);
  const social = asRecord(profilePublic.social_preferences ?? profilePublic.socialPreferences);

  return {
    followedUserAddresses: uniqueStrings(
      [
        ...asStringArray(social.followed_user_addresses),
        ...asStringArray(social.followedUserAddresses),
        ...asStringArray(social.followed_user_ids),
        ...asStringArray(social.followedUserIds),
        ...asStringArray(profilePublic.followed_user_addresses),
        ...asStringArray(profilePublic.followedUserAddresses),
        ...asStringArray(profilePublic.followed_user_ids),
        ...asStringArray(profilePublic.followedUserIds),
      ]
        .map(normalizeFollowTarget)
        .filter(Boolean),
    ),
    followedFormatHashes: uniqueStrings(
      [
        ...asStringArray(social.followed_format_hashes),
        ...asStringArray(social.followedFormatHashes),
        ...asStringArray(profilePublic.followed_format_hashes),
        ...asStringArray(profilePublic.followedFormatHashes),
      ]
        .map(normalizeFollowFormatHash)
        .filter(Boolean),
    ),
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

const withoutSocialPreferenceAliases = (
  record: Record<string, unknown>,
): Record<string, unknown> => {
  const next = { ...record };
  delete next.followed_user_ids;
  delete next.followedUserIds;
  delete next.followedUserAddresses;
  delete next.followedFormatHashes;
  return next;
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
  const profilePublicCanonical = withoutSocialPreferenceAliases(profilePublic);
  const existingSocialCanonical = withoutSocialPreferenceAliases(existingSocial);

  return {
    ...existingProfileJson,
    public: {
      ...profilePublicCanonical,
      followed_user_addresses: [...socialPreferences.followedUserAddresses],
      followed_format_hashes: [...socialPreferences.followedFormatHashes],
      social_preferences: {
        ...existingSocialCanonical,
        followed_user_addresses: [...socialPreferences.followedUserAddresses],
        followed_format_hashes: [...socialPreferences.followedFormatHashes],
      },
    },
  };
};

const resolveProfileStateFromMePayload = (mePayload: unknown): CurrentUserProfileState => {
  const envelope = extractUserEnvelope(mePayload);
  if (!envelope) {
    return {
      me: mePayload,
      userId: null,
      social: defaultSocialPreferences(),
      toolbox: defaultToolboxLibrary(),
    };
  }

  return {
    me: mePayload,
    userId: envelope.userId,
    social: parseSocialPreferencesFromProfileJson(envelope.profileJson),
    toolbox: parseToolboxLibraryFromProfileJson(envelope.profileJson),
  };
};

const resolvePrototypeFallbackProfileState = (): CurrentUserProfileState | null => {
  const mockUserId = resolveMockUserIdFromActiveChainSigner();
  if (!mockUserId) return null;
  return {
    me: null,
    userId: null,
    social: defaultSocialPreferencesForPrototype(mockUserId),
    toolbox: defaultToolboxLibraryForPrototype(),
  };
};

const bootstrapPrototypeProfileState = async (
  profileState: CurrentUserProfileState,
  options?: { persist?: boolean },
): Promise<CurrentUserProfileState> => {
  if (profileState.social.followedUserAddresses.length > 0) return profileState;

  const mockUserId =
    resolveMockUserIdFromMePayload(profileState.me) ?? resolveMockUserIdFromActiveChainSigner();
  if (!mockUserId) return profileState;

  const prototypeSocial = defaultSocialPreferencesForPrototype(mockUserId);
  if (prototypeSocial.followedUserAddresses.length === 0) return profileState;

  const nextSocial: SocialPreferencesProfile = {
    followedUserAddresses: uniqueStrings([
      ...profileState.social.followedUserAddresses,
      ...prototypeSocial.followedUserAddresses,
    ]),
    followedFormatHashes: profileState.social.followedFormatHashes,
  };
  const nextState = {
    ...profileState,
    social: nextSocial,
  };

  const envelope = extractUserEnvelope(profileState.me);
  if (options?.persist !== false && envelope) {
    try {
      await updateUserById(envelope.userId, {
        profile_json: mergeSocialPreferencesIntoProfileJson(envelope.profileJson, nextSocial),
      });
    } catch (error) {
      console.warn("[Auth] Failed to persist prototype social bootstrap.", error);
    }
  }

  return nextState;
};

export const getCurrentUserProfileState = async (options?: {
  preferCached?: boolean;
  bootstrapPrototypeIfEmpty?: boolean;
}): Promise<CurrentUserProfileState> => {
  if (!getToken()) {
    const prototypeFallback = options?.bootstrapPrototypeIfEmpty
      ? resolvePrototypeFallbackProfileState()
      : null;
    return (
      prototypeFallback ?? {
        me: null,
        userId: null,
        social: defaultSocialPreferences(),
        toolbox: defaultToolboxLibraryForPrototype(),
      }
    );
  }

  if (options?.preferCached) {
    const cachedPayload = readCachedMePayload();
    if (cachedPayload) {
      const cachedState = resolveProfileStateFromMePayload(cachedPayload);
      return options.bootstrapPrototypeIfEmpty
        ? bootstrapPrototypeProfileState(cachedState, { persist: false })
        : cachedState;
    }
  }

  try {
    const state = resolveProfileStateFromMePayload(await getMe());
    return options?.bootstrapPrototypeIfEmpty ? bootstrapPrototypeProfileState(state) : state;
  } catch (error) {
    const prototypeFallback = options?.bootstrapPrototypeIfEmpty
      ? resolvePrototypeFallbackProfileState()
      : null;
    if (prototypeFallback) return prototypeFallback;
    throw error;
  }
};

export const getCurrentUserToolboxLibrary = async (): Promise<ToolboxLibraryProfile> => {
  return (await getCurrentUserProfileState()).toolbox;
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

  const normalized: ToolboxLibraryProfile = normalizeToolboxLibrary(toolboxLibrary);

  const nextProfileJson = mergeToolboxIntoProfileJson(envelope.profileJson, normalized);
  await updateUserById(envelope.userId, { profile_json: nextProfileJson });
};

export const addItemToCurrentUserToolbox = async (
  kind: ToolboxItemKind,
  itemId: string,
): Promise<void> => {
  if (!getToken()) return;
  const normalizedId = normalizeToolboxIdByKind(kind, itemId);
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

export const getCurrentUserSocialPreferences = async (options?: {
  bootstrapPrototypeIfEmpty?: boolean;
}): Promise<SocialPreferencesProfile> => {
  return (
    await getCurrentUserProfileState({
      preferCached: true,
      bootstrapPrototypeIfEmpty: options?.bootstrapPrototypeIfEmpty,
    })
  ).social;
};

export const saveCurrentUserSocialPreferences = async (
  preferences: SocialPreferencesProfile,
  options?: { mePayload?: unknown },
): Promise<void> => {
  if (!getToken()) {
    throw new Error("Authentication required.");
  }
  const envelope =
    extractUserEnvelope(options?.mePayload) ??
    extractUserEnvelope(readCachedMePayload()) ??
    extractUserEnvelope(await getMe());
  if (!envelope) {
    throw new Error("Unable to resolve current user for social preferences save.");
  }

  const normalized: SocialPreferencesProfile = {
    followedUserAddresses: uniqueStrings(
      preferences.followedUserAddresses.map(normalizeFollowAddress).filter(Boolean),
    ),
    followedFormatHashes: uniqueStrings(
      preferences.followedFormatHashes.map(normalizeFollowFormatHash).filter(Boolean),
    ),
  };

  const nextProfileJson = mergeSocialPreferencesIntoProfileJson(envelope.profileJson, normalized);
  await updateUserById(envelope.userId, { profile_json: nextProfileJson });
};

export const followUserInProfile = async (address: string): Promise<void> => {
  const normalizedAddress = normalizeFollowAddress(address);
  if (!normalizedAddress) return;

  if (!getToken()) {
    throw new Error("Authentication required.");
  }

  const profileState = await getCurrentUserProfileState({ preferCached: true });
  const preferences = profileState.social;
  if (preferences.followedUserAddresses.includes(normalizedAddress)) return;
  await saveCurrentUserSocialPreferences(
    {
      ...preferences,
      followedUserAddresses: [...preferences.followedUserAddresses, normalizedAddress],
    },
    { mePayload: profileState.me },
  );
};

export const unfollowUserInProfile = async (address: string): Promise<void> => {
  const normalizedAddress = normalizeFollowAddress(address);
  if (!normalizedAddress) return;

  if (!getToken()) {
    throw new Error("Authentication required.");
  }

  const profileState = await getCurrentUserProfileState({ preferCached: true });
  const preferences = profileState.social;
  if (!preferences.followedUserAddresses.includes(normalizedAddress)) return;
  await saveCurrentUserSocialPreferences(
    {
      ...preferences,
      followedUserAddresses: preferences.followedUserAddresses.filter(
        (entry) => entry !== normalizedAddress,
      ),
    },
    { mePayload: profileState.me },
  );
};

export const followFormatInProfile = async (formatHash: string): Promise<void> => {
  if (!getToken()) {
    throw new Error("Authentication required.");
  }
  const normalizedHash = normalizeFollowFormatHash(formatHash);
  if (!normalizedHash) return;
  const profileState = await getCurrentUserProfileState({ preferCached: true });
  const preferences = profileState.social;
  if (preferences.followedFormatHashes.includes(normalizedHash)) return;
  await saveCurrentUserSocialPreferences(
    {
      ...preferences,
      followedFormatHashes: [...preferences.followedFormatHashes, normalizedHash],
    },
    { mePayload: profileState.me },
  );
};

export const unfollowFormatInProfile = async (formatHash: string): Promise<void> => {
  if (!getToken()) {
    throw new Error("Authentication required.");
  }
  const normalizedHash = normalizeFollowFormatHash(formatHash);
  if (!normalizedHash) return;
  const profileState = await getCurrentUserProfileState({ preferCached: true });
  const preferences = profileState.social;
  if (!preferences.followedFormatHashes.includes(normalizedHash)) return;
  await saveCurrentUserSocialPreferences(
    {
      ...preferences,
      followedFormatHashes: preferences.followedFormatHashes.filter(
        (entry) => entry !== normalizedHash,
      ),
    },
    { mePayload: profileState.me },
  );
};

export const computeUserSocialConnections = (
  users: ServicesUserRecord[],
  targetUserAddressOrId: string,
): UserSocialConnections => {
  const normalizedTarget = targetUserAddressOrId.trim();
  if (!normalizedTarget) {
    return { followingIds: [], followerIds: [], status: "ok" };
  }

  const graph = users.map((entry) => {
    const rawId = typeof entry.id === "string" ? entry.id.trim() : "";
    const ethereumAddress = normalizeFollowAddress(
      typeof entry.ethereum_address === "string"
        ? entry.ethereum_address
        : typeof entry.ethereumAddress === "string"
          ? entry.ethereumAddress
          : "",
    );
    const profileJson = entry.profile_json;
    const preferences = parseSocialPreferencesFromProfileJson(profileJson);
    return {
      rawId,
      ethereumAddress,
      followedUserAddresses: preferences.followedUserAddresses,
    };
  });

  const normalizedTargetAddress = normalizeFollowAddress(normalizedTarget);
  const targetEntry =
    (normalizedTargetAddress
      ? graph.find((entry) => entry.ethereumAddress === normalizedTargetAddress)
      : null) ?? graph.find((entry) => entry.rawId === normalizedTarget);

  if (!targetEntry) {
    return {
      followingIds: [],
      followerIds: [],
      status: normalizedTargetAddress ? "address_not_indexed_in_services" : "ok",
    };
  }

  if (!targetEntry.ethereumAddress) {
    return { followingIds: [], followerIds: [], status: "ok" };
  }

  const followerIds = graph
    .filter((entry) => entry.rawId !== targetEntry.rawId)
    .filter((entry) =>
      entry.followedUserAddresses.some((followed) => followed === targetEntry.ethereumAddress),
    )
    .map((entry) => entry.ethereumAddress)
    .filter((id): id is string => Boolean(id));

  return {
    followingIds: uniqueStrings(targetEntry.followedUserAddresses),
    followerIds: uniqueStrings(followerIds),
    status: "ok",
  };
};

export const getUserSocialConnections = async (
  targetUserAddressOrId: string,
): Promise<UserSocialConnections> => {
  if (!getToken()) {
    return { followingIds: [], followerIds: [], status: "ok" };
  }

  return computeUserSocialConnections(await listServicesUsers(), targetUserAddressOrId);
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
