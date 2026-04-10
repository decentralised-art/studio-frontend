import { browser } from "$app/environment";

export type ParticleFormat = {
  id: string;
  slug: string;
  name: string;
  authorId: string;
  terminalParticleIds: string[];
  createdAt: number;
};

export type FormatFeedEvent = {
  type: "format";
  id: string;
  authorId: string;
  createdAt: number;
  createdLabel: string;
  formatId: string;
  formatSlug: string;
  formatName: string;
  terminalParticleIds: string[];
  terminalParticleLabels: string[];
};

const STORAGE_KEY = "hypermusic_particle_formats_v1";

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]+/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "format";

const parseStored = (raw: string | null): ParticleFormat[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const rec = item as Record<string, unknown>;
        const id = typeof rec.id === "string" ? rec.id : "";
        const slug = typeof rec.slug === "string" ? rec.slug : "";
        const name = typeof rec.name === "string" ? rec.name : "";
        const authorId = typeof rec.authorId === "string" ? rec.authorId : "";
        const createdAt = typeof rec.createdAt === "number" ? rec.createdAt : Date.now();
        const terminalParticleIds = Array.isArray(rec.terminalParticleIds)
          ? rec.terminalParticleIds.filter((value): value is string => typeof value === "string")
          : [];
        if (!id || !slug || !name || !authorId || terminalParticleIds.length === 0) return null;
        return {
          id,
          slug,
          name,
          authorId,
          createdAt,
          terminalParticleIds,
        } satisfies ParticleFormat;
      })
      .filter((item): item is ParticleFormat => Boolean(item));
  } catch {
    return [];
  }
};

export const loadLocalFormats = (): ParticleFormat[] => {
  if (!browser) return [];
  return parseStored(window.localStorage.getItem(STORAGE_KEY)).sort(
    (a, b) => b.createdAt - a.createdAt,
  );
};

export const getLocalFormatBySlug = (
  slug: string,
  formats: ParticleFormat[] = loadLocalFormats(),
): ParticleFormat | null => {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  return formats.find((format) => format.slug.trim().toLowerCase() === normalized) ?? null;
};

export const saveLocalFormats = (formats: ParticleFormat[]) => {
  if (!browser) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(formats));
};

export const createLocalFormat = (input: {
  name: string;
  authorId: string;
  terminalParticleIds: string[];
  existing?: ParticleFormat[];
}): { formats: ParticleFormat[]; created: ParticleFormat } => {
  const baseFormats = [...(input.existing ?? loadLocalFormats())];
  const terminalParticleIds = Array.from(
    new Set(input.terminalParticleIds.map((id) => id.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  if (!input.name.trim() || !terminalParticleIds.length) {
    throw new Error("Format name and at least one terminal particle are required.");
  }

  const baseSlug = slugify(input.name);
  let slug = baseSlug;
  let suffix = 2;
  while (baseFormats.some((format) => format.slug === slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const created: ParticleFormat = {
    id: `format-${crypto.randomUUID()}`,
    slug,
    name: input.name.trim(),
    authorId: input.authorId,
    terminalParticleIds,
    createdAt: Date.now(),
  };

  const nextFormats = [created, ...baseFormats].sort((a, b) => b.createdAt - a.createdAt);
  saveLocalFormats(nextFormats);
  return { formats: nextFormats, created };
};

export const buildFormatFeedEvents = (
  formats: ParticleFormat[],
  particleLabelMap: ReadonlyMap<string, string> = new Map(),
): FormatFeedEvent[] =>
  formats
    .map(
      (format) =>
        ({
          type: "format",
          id: `event-format-created-${format.id}`,
          authorId: format.authorId,
          createdAt: format.createdAt,
          createdLabel: "",
          formatId: format.id,
          formatSlug: format.slug,
          formatName: format.name,
          terminalParticleIds: [...format.terminalParticleIds],
          terminalParticleLabels: format.terminalParticleIds.map(
            (id) => particleLabelMap.get(id) ?? id,
          ),
        }) satisfies FormatFeedEvent,
    )
    .sort((a, b) => {
      const byCreatedAt = b.createdAt - a.createdAt;
      if (byCreatedAt !== 0) return byCreatedAt;
      return a.id.localeCompare(b.id);
    });
