import { browser } from "$app/environment";

export type MockEthereumAccount = {
  address: string;
  publicKey: string;
  privateKey: string;
};

export type ChainAuthRequest = {
  address: string;
  signature: string;
  nonce: string;
};

const MOCK_ACCOUNTS_STORAGE_KEY = "hypermusic_mock_ethereum_accounts";
const LEGACY_MOCK_ACCOUNT_STORAGE_KEY = "hypermusic_mock_ethereum_account";
const DEFAULT_ACCOUNT_ALIAS = "default";
const HEX_PREFIX = /^0x/i;
const HEX_CHARS = /^[0-9a-f]+$/i;

const CURVE_P = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F");
const CURVE_N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
const CURVE_HALF_N = CURVE_N >> 1n;
const BASE_POINT = {
  x: BigInt("0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798"),
  y: BigInt("0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8"),
};

const MASK_64 = (1n << 64n) - 1n;
const KECCAK_RATE_BYTES = 136;
const KECCAK_OUTPUT_BYTES = 32;

const ROUND_CONSTANTS: bigint[] = [
  0x0000000000000001n,
  0x0000000000008082n,
  0x800000000000808an,
  0x8000000080008000n,
  0x000000000000808bn,
  0x0000000080000001n,
  0x8000000080008081n,
  0x8000000000008009n,
  0x000000000000008an,
  0x0000000000000088n,
  0x0000000080008009n,
  0x000000008000000an,
  0x000000008000808bn,
  0x800000000000008bn,
  0x8000000000008089n,
  0x8000000000008003n,
  0x8000000000008002n,
  0x8000000000000080n,
  0x000000000000800an,
  0x800000008000000an,
  0x8000000080008081n,
  0x8000000000008080n,
  0x0000000080000001n,
  0x8000000080008008n,
];

const ROTATION_OFFSETS: number[][] = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
];

type Point = { x: bigint; y: bigint } | null;

const textEncoder = new TextEncoder();

const normalizeAccountAlias = (alias: string): string => {
  const normalized = alias.trim();
  return normalized.length > 0 ? normalized : DEFAULT_ACCOUNT_ALIAS;
};

const mod = (value: bigint, modulo: bigint): bigint => {
  const normalized = value % modulo;
  return normalized >= 0n ? normalized : normalized + modulo;
};

const modInverse = (value: bigint, modulo: bigint): bigint => {
  let t = 0n;
  let newT = 1n;
  let r = modulo;
  let newR = mod(value, modulo);

  while (newR !== 0n) {
    const quotient = r / newR;
    [t, newT] = [newT, t - quotient * newT];
    [r, newR] = [newR, r - quotient * newR];
  }

  if (r !== 1n) {
    throw new Error("Value is not invertible on secp256k1.");
  }

  return mod(t, modulo);
};

const pointAdd = (left: Point, right: Point): Point => {
  if (!left) return right;
  if (!right) return left;

  if (left.x === right.x) {
    if (mod(left.y + right.y, CURVE_P) === 0n) {
      return null;
    }
    return pointDouble(left);
  }

  const slope = mod((right.y - left.y) * modInverse(right.x - left.x, CURVE_P), CURVE_P);
  const x = mod(slope * slope - left.x - right.x, CURVE_P);
  const y = mod(slope * (left.x - x) - left.y, CURVE_P);

  return { x, y };
};

const pointDouble = (point: Point): Point => {
  if (!point || point.y === 0n) {
    return null;
  }

  const slope = mod(3n * point.x * point.x * modInverse(2n * point.y, CURVE_P), CURVE_P);
  const x = mod(slope * slope - 2n * point.x, CURVE_P);
  const y = mod(slope * (point.x - x) - point.y, CURVE_P);

  return { x, y };
};

const scalarMultiply = (point: Point, scalar: bigint): Point => {
  if (!point || scalar <= 0n) {
    return null;
  }

  let n = scalar;
  let addend: Point = point;
  let result: Point = null;

  while (n > 0n) {
    if (n & 1n) {
      result = pointAdd(result, addend);
    }
    addend = pointDouble(addend);
    n >>= 1n;
  }

  return result;
};

const bytesToBigInt = (bytes: Uint8Array): bigint => {
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) + BigInt(byte);
  }
  return value;
};

const bigIntToBytes = (value: bigint, size: number): Uint8Array => {
  const result = new Uint8Array(size);
  let current = value;

  for (let index = size - 1; index >= 0; index -= 1) {
    result[index] = Number(current & 0xffn);
    current >>= 8n;
  }

  if (current !== 0n) {
    throw new Error("BigInt does not fit into target byte size.");
  }

  return result;
};

const toHex = (bytes: Uint8Array): string =>
  `0x${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;

const stripHexPrefix = (hex: string): string => hex.trim().replace(HEX_PREFIX, "");

const concatBytes = (...parts: Uint8Array[]): Uint8Array => {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
};

const rotl64 = (value: bigint, shift: number): bigint => {
  const amount = BigInt(shift % 64);
  if (amount === 0n) {
    return value & MASK_64;
  }
  return (((value << amount) & MASK_64) | (value >> (64n - amount))) & MASK_64;
};

const keccakPermutation = (state: bigint[]): void => {
  for (let round = 0; round < 24; round += 1) {
    const c = new Array<bigint>(5);
    for (let x = 0; x < 5; x += 1) {
      c[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
    }

    const d = new Array<bigint>(5);
    for (let x = 0; x < 5; x += 1) {
      d[x] = c[(x + 4) % 5] ^ rotl64(c[(x + 1) % 5], 1);
    }

    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        const index = x + 5 * y;
        state[index] = (state[index] ^ d[x]) & MASK_64;
      }
    }

    const b = new Array<bigint>(25).fill(0n);
    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        const index = x + 5 * y;
        const rotated = rotl64(state[index], ROTATION_OFFSETS[x][y]);
        const nextX = y;
        const nextY = (2 * x + 3 * y) % 5;
        b[nextX + 5 * nextY] = rotated;
      }
    }

    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        const index = x + 5 * y;
        const lane0 = b[index];
        const lane1 = b[((x + 1) % 5) + 5 * y];
        const lane2 = b[((x + 2) % 5) + 5 * y];
        state[index] = (lane0 ^ (~lane1 & MASK_64 & lane2)) & MASK_64;
      }
    }

    state[0] = (state[0] ^ ROUND_CONSTANTS[round]) & MASK_64;
  }
};

const keccak256 = (input: Uint8Array): Uint8Array => {
  const state = new Array<bigint>(25).fill(0n);
  const paddedLength = Math.ceil((input.length + 1) / KECCAK_RATE_BYTES) * KECCAK_RATE_BYTES;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] = 0x01;
  padded[padded.length - 1] |= 0x80;

  for (let offset = 0; offset < padded.length; offset += KECCAK_RATE_BYTES) {
    const block = padded.subarray(offset, offset + KECCAK_RATE_BYTES);
    for (let lane = 0; lane < KECCAK_RATE_BYTES / 8; lane += 1) {
      let laneValue = 0n;
      for (let byteIndex = 0; byteIndex < 8; byteIndex += 1) {
        laneValue |= BigInt(block[lane * 8 + byteIndex]) << BigInt(byteIndex * 8);
      }
      state[lane] = (state[lane] ^ laneValue) & MASK_64;
    }
    keccakPermutation(state);
  }

  const output = new Uint8Array(KECCAK_OUTPUT_BYTES);
  for (let index = 0; index < output.length; index += 1) {
    const lane = state[Math.floor(index / 8)];
    output[index] = Number((lane >> BigInt((index % 8) * 8)) & 0xffn);
  }
  return output;
};

const parsePrivateKey = (privateKey: string): bigint => {
  const normalized = stripHexPrefix(privateKey).toLowerCase();
  if (normalized.length !== 64 || !HEX_CHARS.test(normalized)) {
    throw new Error("Private key must be a 32-byte hex string.");
  }

  const scalar = BigInt(`0x${normalized}`);
  if (scalar <= 0n || scalar >= CURVE_N) {
    throw new Error("Private key is out of secp256k1 range.");
  }

  return scalar;
};

const derivePublicPoint = (privateScalar: bigint): { x: bigint; y: bigint } => {
  const point = scalarMultiply(BASE_POINT, privateScalar);
  if (!point) {
    throw new Error("Failed to derive public key.");
  }
  return point;
};

const encodeUncompressedPublicKey = (point: { x: bigint; y: bigint }): Uint8Array =>
  concatBytes(new Uint8Array([0x04]), bigIntToBytes(point.x, 32), bigIntToBytes(point.y, 32));

const getRandomPrivateScalar = (): bigint => {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Web Crypto API is unavailable for key generation.");
  }

  const bytes = new Uint8Array(32);
  while (true) {
    globalThis.crypto.getRandomValues(bytes);
    const candidate = bytesToBigInt(bytes);
    if (candidate > 0n && candidate < CURVE_N) {
      return candidate;
    }
  }
};

const deriveDeterministicNonce = (
  privateScalar: bigint,
  digest: Uint8Array,
  attempt: number,
): bigint => {
  const seed = concatBytes(
    bigIntToBytes(privateScalar, 32),
    digest,
    bigIntToBytes(BigInt(attempt), 4),
  );
  const candidate = bytesToBigInt(keccak256(seed));
  return mod(candidate, CURVE_N - 1n) + 1n;
};

const signDigest = (
  privateScalar: bigint,
  digest: Uint8Array,
): { r: bigint; s: bigint; v: number } => {
  const z = mod(bytesToBigInt(digest), CURVE_N);

  for (let attempt = 0; attempt < 4096; attempt += 1) {
    const k = deriveDeterministicNonce(privateScalar, digest, attempt);
    const point = scalarMultiply(BASE_POINT, k);
    if (!point) continue;

    const r = mod(point.x, CURVE_N);
    if (r === 0n) continue;

    const kInverse = modInverse(k, CURVE_N);
    let s = mod(kInverse * (z + r * privateScalar), CURVE_N);
    if (s === 0n) continue;

    let recoveryParity = Number(point.y & 1n);
    if (s > CURVE_HALF_N) {
      s = CURVE_N - s;
      recoveryParity ^= 1;
    }

    return {
      r,
      s,
      v: 27 + recoveryParity,
    };
  }

  throw new Error("Failed to produce a valid signature.");
};

const deriveAddressFromPublicKey = (publicKey: Uint8Array): string => {
  const hash = keccak256(publicKey.subarray(1));
  return toHex(hash.subarray(hash.length - 20));
};

const parseStoredAccountCandidate = (candidate: unknown): MockEthereumAccount | null => {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  if (
    typeof record.address !== "string" ||
    typeof record.publicKey !== "string" ||
    typeof record.privateKey !== "string"
  ) {
    return null;
  }

  try {
    const reconstructed = createMockEthereumAccountFromPrivateKey(record.privateKey);
    if (
      reconstructed.address.toLowerCase() !== record.address.toLowerCase() ||
      reconstructed.publicKey.toLowerCase() !== record.publicKey.toLowerCase()
    ) {
      return null;
    }
    return reconstructed;
  } catch {
    return null;
  }
};

const parseStoredAccount = (value: string): MockEthereumAccount | null => {
  try {
    const parsed = JSON.parse(value);
    return parseStoredAccountCandidate(parsed);
  } catch {
    return null;
  }
};

const parseStoredAccountMap = (value: string): Record<string, MockEthereumAccount> => {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const accountMap: Record<string, MockEthereumAccount> = {};
    for (const [rawAlias, candidate] of Object.entries(parsed as Record<string, unknown>)) {
      const parsedAccount = parseStoredAccountCandidate(candidate);
      if (!parsedAccount) continue;
      accountMap[normalizeAccountAlias(rawAlias)] = parsedAccount;
    }
    return accountMap;
  } catch {
    return {};
  }
};

const readStoredAccountMap = (): Record<string, MockEthereumAccount> => {
  if (!browser) {
    return {};
  }

  const currentRaw = localStorage.getItem(MOCK_ACCOUNTS_STORAGE_KEY);
  if (currentRaw) {
    return parseStoredAccountMap(currentRaw);
  }

  // Migrate from legacy single-account key when present.
  const legacyRaw = localStorage.getItem(LEGACY_MOCK_ACCOUNT_STORAGE_KEY);
  if (!legacyRaw) {
    return {};
  }

  const legacyAccount = parseStoredAccount(legacyRaw);
  if (!legacyAccount) {
    localStorage.removeItem(LEGACY_MOCK_ACCOUNT_STORAGE_KEY);
    return {};
  }

  const migratedMap = { [DEFAULT_ACCOUNT_ALIAS]: legacyAccount };
  localStorage.setItem(MOCK_ACCOUNTS_STORAGE_KEY, JSON.stringify(migratedMap));
  localStorage.removeItem(LEGACY_MOCK_ACCOUNT_STORAGE_KEY);
  return migratedMap;
};

const writeStoredAccountMap = (accounts: Record<string, MockEthereumAccount>): void => {
  if (!browser) return;
  localStorage.setItem(MOCK_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  localStorage.removeItem(LEGACY_MOCK_ACCOUNT_STORAGE_KEY);
};

export const createMockEthereumAccountFromPrivateKey = (
  privateKey: string,
): MockEthereumAccount => {
  const privateScalar = parsePrivateKey(privateKey);
  const normalizedPrivateKey = toHex(bigIntToBytes(privateScalar, 32));
  const publicPoint = derivePublicPoint(privateScalar);
  const publicKeyBytes = encodeUncompressedPublicKey(publicPoint);
  const publicKey = toHex(publicKeyBytes);
  const address = deriveAddressFromPublicKey(publicKeyBytes);

  return {
    address,
    publicKey,
    privateKey: normalizedPrivateKey,
  };
};

export const createMockEthereumAccount = (): MockEthereumAccount => {
  const privateScalar = getRandomPrivateScalar();
  return createMockEthereumAccountFromPrivateKey(toHex(bigIntToBytes(privateScalar, 32)));
};

export const getOrCreateMockEthereumAccount = (
  accountAlias: string = DEFAULT_ACCOUNT_ALIAS,
): MockEthereumAccount => {
  if (!browser) {
    return createMockEthereumAccount();
  }

  const normalizedAlias = normalizeAccountAlias(accountAlias);
  const accountMap = readStoredAccountMap();
  const existing = accountMap[normalizedAlias];
  if (existing) {
    return existing;
  }

  const created = createMockEthereumAccount();
  accountMap[normalizedAlias] = created;
  writeStoredAccountMap(accountMap);
  return created;
};

export const getStoredMockEthereumAccount = (
  accountAlias: string = DEFAULT_ACCOUNT_ALIAS,
): MockEthereumAccount | null => {
  if (!browser) return null;
  const normalizedAlias = normalizeAccountAlias(accountAlias);
  const accountMap = readStoredAccountMap();
  return accountMap[normalizedAlias] ?? null;
};

export const listStoredMockEthereumAccounts = (): MockEthereumAccount[] => {
  if (!browser) return [];
  const accountMap = readStoredAccountMap();
  return Object.values(accountMap);
};

export const clearStoredMockEthereumAccount = (accountAlias?: string): void => {
  if (!browser) return;

  if (typeof accountAlias === "string") {
    const normalizedAlias = normalizeAccountAlias(accountAlias);
    const accountMap = readStoredAccountMap();
    delete accountMap[normalizedAlias];
    if (Object.keys(accountMap).length === 0) {
      localStorage.removeItem(MOCK_ACCOUNTS_STORAGE_KEY);
      localStorage.removeItem(LEGACY_MOCK_ACCOUNT_STORAGE_KEY);
      return;
    }
    writeStoredAccountMap(accountMap);
    return;
  }

  localStorage.removeItem(MOCK_ACCOUNTS_STORAGE_KEY);
  localStorage.removeItem(LEGACY_MOCK_ACCOUNT_STORAGE_KEY);
};

export const keccak256Hex = (value: string | Uint8Array): string => {
  const bytes = typeof value === "string" ? textEncoder.encode(value) : value;
  return toHex(keccak256(bytes));
};

const hashEthereumSignedMessage = (message: string): Uint8Array => {
  const messageBytes = textEncoder.encode(message);
  const prefix = `\x19Ethereum Signed Message:\n${messageBytes.length}`;
  const prefixBytes = textEncoder.encode(prefix);
  return keccak256(concatBytes(prefixBytes, messageBytes));
};

export const signMessageWithKeccak256 = (privateKey: string, message: string): string => {
  const privateScalar = parsePrivateKey(privateKey);
  const digest = hashEthereumSignedMessage(message);
  const { r, s, v } = signDigest(privateScalar, digest);
  const signature = concatBytes(bigIntToBytes(r, 32), bigIntToBytes(s, 32), new Uint8Array([v]));
  return toHex(signature);
};

export const createChainAuthRequest = (
  account: MockEthereumAccount,
  challenge: { nonce: string; message: string },
): ChainAuthRequest => {
  const signature = signMessageWithKeccak256(account.privateKey, challenge.message);
  return {
    address: account.address,
    signature: stripHexPrefix(signature),
    nonce: challenge.nonce,
  };
};
