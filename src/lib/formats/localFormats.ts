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

const formatRelativeTime = (createdAt: number) => {
  const diffMs = Math.max(0, Date.now() - createdAt);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const loadLocalFormats = (): ParticleFormat[] => {
  if (!browser) return [];
  return parseStored(window.localStorage.getItem(STORAGE_KEY)).sort(
    (a, b) => b.createdAt - a.createdAt,
  );
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

export const getLocalFormatBySlug = (slug: string, formats?: ParticleFormat[]) =>
  (formats ?? loadLocalFormats()).find((format) => format.slug === slug) ?? null;

export const buildFormatFeedEvents = (
  formats: ParticleFormat[],
  particleLabelById: ReadonlyMap<string, string>,
): FormatFeedEvent[] =>
  formats
    .map((format) => ({
      type: "format",
      id: `event-format-created-${format.id}`,
      authorId: format.authorId,
      createdAt: format.createdAt,
      createdLabel: formatRelativeTime(format.createdAt),
      formatId: format.id,
      formatSlug: format.slug,
      formatName: format.name,
      terminalParticleIds: [...format.terminalParticleIds],
      terminalParticleLabels: format.terminalParticleIds.map(
        (id) => particleLabelById.get(id) ?? id,
      ),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
