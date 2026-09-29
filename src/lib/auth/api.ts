import { browser } from "$app/environment";
import { createDcnClient, isDcnApiError } from "$lib/chain/dcnClient";
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
import { buildNonceLoginMessage } from "./mockEthereum";
import {
  clearChainToken,
  clearToken,
  getChainToken,
  getToken,
  setChainToken,
  setToken,
} from "./session";

export type BrowserWalletChainAuthResult = {
  address: string;
  nonce: string;
  message: string;
  signature: string;
  token: string;
};

export type BrowserWalletServicesAuthResult = {
  address: string;
  chainId: number;
  message: string;
  signature: string;
  token: string;
  me: unknown;
};

export type BrowserEthereumProvider = {
  request: <T = unknown>(args: { method: string; params?: unknown[] }) => Promise<T>;
};

type WindowWithEthereum = Window & {
  ethereum?: BrowserEthereumProvider;
};

type ChainAuthPayload = {
  address: string;
  signature: string;
  message: string;
};

type SiweChallengeResponse = {
  message: string;
  expires_at?: string;
};

const SERVICES_ME_CACHE_KEY = "dcn_services_me_cache_v1";
const ETHEREUM_ADDRESS_RE = /^0x[0-9a-f]{40}$/i;
let cachedMePayloadMemory: unknown | null = null;

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

const parseResponseBody = async (response: Response) => {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
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

const normalizeEthereumAddress = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return ETHEREUM_ADDRESS_RE.test(prefixed) ? prefixed : "";
};

const stripHexPrefix = (value: string): string => value.trim().replace(/^0x/i, "");

const utf8Hex = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  return `0x${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
};

export const chainTokenIdentityForWalletAddress = (address: string): string => {
  const normalized = normalizeEthereumAddress(address);
  return normalized ? `wallet:${normalized}` : "";
};

const requestChainNonce = async (address: string): Promise<string> => {
  try {
    const response = await createDcnClient({ accessToken: null }).getNonce(address);
    const nonce = typeof response.nonce === "string" ? response.nonce.trim() : "";
    if (!nonce) {
      throw new Error("Chain nonce response did not include a nonce.");
    }
    return nonce;
  } catch (error) {
    if (isDcnApiError(error)) {
      throw new Error(extractErrorMessage(error.body));
    }
    throw error;
  }
};

const requestChainAuthToken = async (authRequest: ChainAuthPayload): Promise<string> => {
  try {
    const response = await createDcnClient({ accessToken: null }).loginWithSignature(
      authRequest.address,
      authRequest.message,
      authRequest.signature,
    );
    const token = parseTokenFromPayload(response);
    if (!token) {
      throw new Error("No token returned from chain auth.");
    }
    return token;
  } catch (error) {
    if (isDcnApiError(error)) {
      throw new Error(extractErrorMessage(error.body));
    }
    throw error;
  }
};

export const getBrowserEthereumProvider = (
  provider?: BrowserEthereumProvider,
): BrowserEthereumProvider => {
  if (provider) return provider;
  if (!browser) {
    throw new Error("MetaMask is only available in the browser.");
  }
  const detected = (window as WindowWithEthereum).ethereum;
  if (!detected) {
    throw new Error("MetaMask is not available in this browser.");
  }
  return detected;
};

const requestBrowserWalletAddress = async (provider?: BrowserEthereumProvider): Promise<string> => {
  const activeProvider = getBrowserEthereumProvider(provider);
  const accounts = await activeProvider.request<unknown>({
    method: "eth_requestAccounts",
  });
  const address = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
  const normalized = normalizeEthereumAddress(address);
  if (!normalized) {
    throw new Error("No Ethereum account was selected in MetaMask.");
  }
  return normalized;
};

const requestBrowserWalletChainId = async (provider?: BrowserEthereumProvider): Promise<number> => {
  const activeProvider = getBrowserEthereumProvider(provider);
  const chainHex = await activeProvider.request<unknown>({ method: "eth_chainId" });
  if (typeof chainHex !== "string") {
    throw new Error("MetaMask did not return a chain id.");
  }
  const chainId = Number.parseInt(chainHex, 16);
  if (!Number.isFinite(chainId) || chainId <= 0) {
    throw new Error("MetaMask returned an invalid chain id.");
  }
  return chainId;
};

const signChainAuthMessage = async ({
  provider,
  address,
  message,
}: {
  provider?: BrowserEthereumProvider;
  address: string;
  message: string;
}): Promise<string> => {
  const activeProvider = getBrowserEthereumProvider(provider);
  const signature = await activeProvider.request<unknown>({
    method: "personal_sign",
    params: [message, address],
  });
  if (typeof signature !== "string" || !signature.trim()) {
    throw new Error("MetaMask did not return a signature.");
  }
  return signature.trim();
};

export const authenticateBrowserWalletInChain = async (options?: {
  provider?: BrowserEthereumProvider;
}): Promise<BrowserWalletChainAuthResult> => {
  const address = await requestBrowserWalletAddress(options?.provider);
  const nonce = await requestChainNonce(address);
  const message = buildNonceLoginMessage(nonce);
  const signature = await signChainAuthMessage({
    provider: options?.provider,
    address,
    message,
  });
  const token = await requestChainAuthToken({
    address,
    signature: stripHexPrefix(signature),
    message,
  });

  return {
    address,
    nonce,
    message,
    signature,
    token,
  };
};

export const loginWithBrowserWalletChainAccount = async (options?: {
  provider?: BrowserEthereumProvider;
}): Promise<BrowserWalletChainAuthResult> => {
  const result = await authenticateBrowserWalletInChain({
    provider: options?.provider,
  });
  const tokenIdentity = chainTokenIdentityForWalletAddress(result.address);
  setChainToken(result.token, tokenIdentity);
  return result;
};

const requestServicesSiweChallenge = async (
  address: string,
  chainId: number,
): Promise<SiweChallengeResponse> => {
  const appOrigin = browser ? window.location.origin : "";
  const response = await fetch(buildServicesApiUrl("/auth/siwe/challenge"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address,
      chain_id: chainId,
      ...(appOrigin ? { app_origin: appOrigin } : {}),
    }),
  });
  const payload = await parseResponseBody(response);
  if (!response.ok) {
    throw createStatusError(extractErrorMessage(payload), response.status);
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("SIWE challenge response was malformed.");
  }
  const challenge = payload as Record<string, unknown>;
  if (typeof challenge.message !== "string" || !challenge.message.trim()) {
    throw new Error("SIWE challenge response did not include a message.");
  }
  return {
    message: challenge.message,
    expires_at: typeof challenge.expires_at === "string" ? challenge.expires_at : undefined,
  };
};

const requestServicesSiweToken = async (payload: {
  message: string;
  signature: string;
}): Promise<string> => {
  const response = await fetch(buildServicesApiUrl("/auth/siwe/verify"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const responsePayload = await parseResponseBody(response);
  if (!response.ok) {
    throw createStatusError(extractErrorMessage(responsePayload), response.status);
  }
  const token = parseTokenFromPayload(responsePayload);
  if (!token) {
    throw new Error("No token returned from SIWE verify.");
  }
  return token;
};

export const loginWithBrowserWalletServicesAccount = async (options?: {
  provider?: BrowserEthereumProvider;
}): Promise<BrowserWalletServicesAuthResult> => {
  const provider = options?.provider;
  const address = await requestBrowserWalletAddress(provider);
  const chainId = await requestBrowserWalletChainId(provider);
  const challenge = await requestServicesSiweChallenge(address, chainId);
  const activeProvider = getBrowserEthereumProvider(provider);
  const signature = await activeProvider.request<unknown>({
    method: "personal_sign",
    params: [utf8Hex(challenge.message), address],
  });
  if (typeof signature !== "string" || !signature.trim()) {
    throw new Error("MetaMask did not return a SIWE signature.");
  }
  const token = await requestServicesSiweToken({
    message: challenge.message,
    signature: signature.trim(),
  });

  clearCachedMePayload();
  setToken(token);

  try {
    const me = await getMe();
    return {
      address,
      chainId,
      message: challenge.message,
      signature: signature.trim(),
      token,
      me,
    };
  } catch (error) {
    clearToken();
    throw error;
  }
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

const isInvalidServicesSessionResponse = (path: string, status: number): boolean =>
  status === 401 || status === 403 || (status === 404 && path === "/auth/me");

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

  if (!response.ok && isInvalidServicesSessionResponse(path, response.status)) {
    clearCachedMePayload();
    clearToken();
  }

  return response;
};

export const logout = async (): Promise<void> => {
  const token = getToken();
  clearToken();
  clearChainToken();
  clearCachedMePayload();
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

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

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

const mergeUpdatedUserPayload = (
  payload: unknown,
  previousPayload: unknown | null,
  userId: string,
  patch: Record<string, unknown>,
): unknown => {
  const updatedUser = coerceServicesUserRecord(payload);
  if (updatedUser?.id !== userId) return payload;

  const previousUser = coerceServicesUserRecord(previousPayload);
  const mergedUser: ServicesUserRecord = {
    ...(previousUser?.id === userId ? previousUser : {}),
    ...patch,
    ...updatedUser,
    id: userId,
  };

  const payloadRoot = asRecord(payload);
  const payloadUser = asRecord(payloadRoot.user);
  if (Object.keys(payloadUser).length > 0) {
    return {
      ...payloadRoot,
      user: {
        ...payloadUser,
        ...mergedUser,
      },
    };
  }

  const previousRoot = asRecord(previousPayload);
  const previousNestedUser = asRecord(previousRoot.user);
  if (Object.keys(previousNestedUser).length > 0) {
    return {
      ...previousRoot,
      user: {
        ...previousNestedUser,
        ...mergedUser,
      },
    };
  }

  return mergedUser;
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
  if (normalizeFollowAddress(user.id)) return true;
  const direct = user.ethereum_address;
  if (typeof direct === "string" && direct.trim().length > 0) return true;
  const alt = user.ethereumAddress;
  return typeof alt === "string" && alt.trim().length > 0;
};

const hasHydratableServicesUserDetails = (user: ServicesUserRecord): boolean =>
  Boolean(
    user.display_name ??
    user.displayName ??
    user.profile_json ??
    user.profileJson ??
    user.status ??
    user.roles,
  );

const hydrateServicesUsersById = async (
  users: ServicesUserRecord[],
): Promise<ServicesUserRecord[]> => {
  const toHydrate = users.filter((user) => {
    if (!hasHydratableServicesUserDetails(user)) return true;
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
    const response = await fetch(buildServicesApiUrl(`/users?limit=${pageLimit}&page=${page}`));
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

  const fallbackResponse = await fetch(buildServicesApiUrl("/users"));
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
    throw new Error(extractErrorMessage(payload));
  }
  return payload;
};

export const updateUserById = async (
  userId: string,
  patch: Record<string, unknown>,
): Promise<unknown> => {
  const previousCachedMePayload = readCachedMePayload();
  const response = await authFetch(`/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const payload = await parseResponseBody(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload));
  }
  // Profile updates (social/toolbox/nickname) must update /auth/me cache,
  // otherwise cross-page state can remain stale until manual refresh.
  const mergedPayload = mergeUpdatedUserPayload(payload, previousCachedMePayload, userId, patch);
  clearCachedMePayload();
  const updatedUser = coerceServicesUserRecord(mergedPayload);
  if (updatedUser?.id === userId) {
    writeCachedMePayload(mergedPayload);
  }
  return mergedPayload;
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

  const userIdAddress = normalizeFollowAddress(envelope.userId);
  if (userIdAddress) {
    sourceSet.add(userIdAddress);
  }

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

  return Array.from(sourceSet);
};

export type UserSocialConnectionsStatus = "ok" | "address_not_indexed_in_services";

export type UserSocialConnections = {
  followingIds: string[];
  followerIds: string[];
  status: UserSocialConnectionsStatus;
};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const uniqueStrings = (values: string[]) =>
  Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));

const ETH_ADDRESS_RE = /^0x[0-9a-f]{40}$/;
const FORMAT_HASH_RE = /^0x[0-9a-f]{64}$/;

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

const normalizeFollowTarget = (value: string): string => normalizeFollowAddress(value);

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
        ...asStringArray(profilePublic.followed_user_addresses),
        ...asStringArray(profilePublic.followedUserAddresses),
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

export const getCurrentUserProfileState = async (options?: {
  preferCached?: boolean;
}): Promise<CurrentUserProfileState> => {
  if (!getToken()) {
    return {
      me: null,
      userId: null,
      social: defaultSocialPreferences(),
      toolbox: defaultToolboxLibrary(),
    };
  }

  if (options?.preferCached) {
    const cachedPayload = readCachedMePayload();
    if (cachedPayload) {
      return resolveProfileStateFromMePayload(cachedPayload);
    }
  }

  return resolveProfileStateFromMePayload(await getMe());
};

export const getCurrentUserToolboxLibrary = async (): Promise<ToolboxLibraryProfile> => {
  return (await getCurrentUserProfileState()).toolbox;
};

export const getCachedCurrentUserToolboxLibrary = (): ToolboxLibraryProfile | null => {
  const cachedPayload = readCachedMePayload();
  if (!cachedPayload) return null;
  return resolveProfileStateFromMePayload(cachedPayload).toolbox;
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

export const getCurrentUserSocialPreferences = async (): Promise<SocialPreferencesProfile> => {
  return (
    await getCurrentUserProfileState({
      preferCached: true,
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
      normalizeFollowAddress(rawId) ||
        (typeof entry.ethereum_address === "string"
          ? entry.ethereum_address
          : typeof entry.ethereumAddress === "string"
            ? entry.ethereumAddress
            : ""),
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
