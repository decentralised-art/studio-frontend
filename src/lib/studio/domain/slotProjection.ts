export type CanonicalSlotKey = `${number}`;

export type NormalizedBinding = {
  slotId: number;
  slotKey: CanonicalSlotKey;
  targetConnector: string;
};

export type SlotProjectionRange = {
  childSlotId: number;
  projectedStart: number;
  projectedWidth: number;
  source: "unbound" | "static";
};

export type SlotLookupResult = {
  childSlotId: number;
  rangeStart: number;
};

const UINT32_MAX = 0xffff_ffff;
const CANONICAL_SLOT_REGEX = /^(0|[1-9]\d*)$/;

const assertUint32Int = (value: number, label: string) => {
  if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) {
    throw new Error(`${label} must be a uint32 integer.`);
  }
};

export function parseCanonicalSlotKey(input: string): number | null {
  const trimmed = input.trim();
  if (!CANONICAL_SLOT_REGEX.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) return null;
  if (parsed < 0 || parsed > UINT32_MAX) return null;
  return parsed;
}

export function toCanonicalSlotKey(slotId: number): CanonicalSlotKey | null {
  if (!Number.isInteger(slotId) || slotId < 0 || slotId > UINT32_MAX) return null;
  return `${slotId}` as CanonicalSlotKey;
}

export function normalizeBindingsMap(bindings: Record<string, string>): NormalizedBinding[] {
  const normalized: NormalizedBinding[] = [];
  const seen = new Set<CanonicalSlotKey>();

  for (const [rawKey, rawTarget] of Object.entries(bindings)) {
    const slotId = parseCanonicalSlotKey(rawKey);
    if (slotId === null) {
      throw new Error(`Invalid canonical slot key: ${rawKey}`);
    }

    const slotKey = toCanonicalSlotKey(slotId);
    if (!slotKey) {
      throw new Error(`Invalid slot key: ${rawKey}`);
    }

    if (seen.has(slotKey)) {
      throw new Error(`Duplicate canonical slot key: ${slotKey}`);
    }

    if (typeof rawTarget !== "string") {
      throw new Error(`Invalid binding target for slot ${slotKey}.`);
    }

    const targetConnector = rawTarget.trim();
    if (targetConnector.length === 0) {
      throw new Error(`Empty binding target for slot ${slotKey}.`);
    }

    seen.add(slotKey);
    normalized.push({ slotId, slotKey, targetConnector });
  }

  normalized.sort((a, b) => a.slotId - b.slotId);
  return normalized;
}

export function projectChildSlots(args: {
  childOpenSlots: number;
  staticBindings: Array<{ slotId: number; targetOpenSlots: number }>;
}): SlotProjectionRange[] {
  assertUint32Int(args.childOpenSlots, "childOpenSlots");

  const staticBySlot = new Map<number, number>();
  for (const binding of args.staticBindings) {
    assertUint32Int(binding.slotId, "slotId");
    assertUint32Int(binding.targetOpenSlots, "targetOpenSlots");

    if (binding.slotId >= args.childOpenSlots) {
      throw new Error(`Static binding slot ${binding.slotId} is out of range.`);
    }
    if (staticBySlot.has(binding.slotId)) {
      throw new Error(`Duplicate static binding slot ${binding.slotId}.`);
    }

    staticBySlot.set(binding.slotId, binding.targetOpenSlots);
  }

  const ranges: SlotProjectionRange[] = [];
  let projectedStart = 0;

  for (let childSlotId = 0; childSlotId < args.childOpenSlots; childSlotId += 1) {
    const staticWidth = staticBySlot.get(childSlotId);
    if (typeof staticWidth === "number") {
      if (staticWidth > 0) {
        ranges.push({
          childSlotId,
          projectedStart,
          projectedWidth: staticWidth,
          source: "static",
        });
      }
      projectedStart += staticWidth;
      continue;
    }

    ranges.push({
      childSlotId,
      projectedStart,
      projectedWidth: 1,
      source: "unbound",
    });
    projectedStart += 1;
  }

  return ranges;
}

export function findProjectedChildSlot(
  projectedSlotId: number,
  ranges: SlotProjectionRange[],
): SlotLookupResult | null {
  if (!Number.isInteger(projectedSlotId) || projectedSlotId < 0) return null;
  if (ranges.length === 0) return null;

  const sorted = [...ranges].sort((a, b) => a.projectedStart - b.projectedStart);

  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = low + Math.floor((high - low) / 2);
    if (sorted[mid].projectedStart <= projectedSlotId) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  if (low === 0) return null;
  const candidate = sorted[low - 1];
  const endExclusive = candidate.projectedStart + candidate.projectedWidth;
  if (projectedSlotId < candidate.projectedStart || projectedSlotId >= endExclusive) {
    return null;
  }

  return {
    childSlotId: candidate.childSlotId,
    rangeStart: candidate.projectedStart,
  };
}
