export const MUSIC_SCORE_PLUGIN_ID = "music-score-v1";
export const MUSIC_SCORE_PLUGIN_NAME = "MusicXML Score World";

export const MUSICXML_CUSTOM_ELEMENT_CODE = 9999;
export const MUSICXML_CUSTOM_ATTR_CODE = 9999;

export const SCORE_TEXT_KIND_UNICODE_CODEPOINT = 0;
export const SCORE_TEXT_KIND_DYNAMIC_TOKEN = 1;
export const SCORE_TEXT_KIND_NOTE_TYPE_TOKEN = 2;
export const SCORE_TEXT_KIND_GENERAL_TOKEN = 3;

export const SCORE_VALUE_KIND_NUMBER = 0;
export const SCORE_VALUE_KIND_ENUM = 1;
export const SCORE_VALUE_KIND_TEXT = 2;
export const SCORE_VALUE_KIND_YES_NO = 3;

export const DYNAMIC_SYMBOLS = ["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff"] as const;

const SCORE_ARTICULATION_ELEMENT_BY_CODE: Record<number, string> = {
  0: "accent",
  1: "staccato",
  2: "tenuto",
  3: "strong-accent",
  48: "accent",
  49: "staccato",
  50: "tenuto",
  51: "strong-accent",
};

const SCORE_SLUR_TYPE_BY_CODE: Record<number, "start" | "stop" | "continue"> = {
  0: "start",
};

const SCORE_PLACEMENT_BY_CODE: Record<number, "above" | "below"> = {
  0: "above",
  1: "below",
};

const SCORE_CLEF_SIGN_BY_CODE: Record<number, string> = {
  0: "G",
  1: "F",
  2: "C",
  3: "percussion",
};

const SCORE_KEY_MODE_BY_CODE: Record<number, string> = {
  0: "major",
  1: "minor",
  2: "none",
  3: "dorian",
  4: "phrygian",
  5: "lydian",
  6: "mixolydian",
  7: "aeolian",
  8: "ionian",
  9: "locrian",
};

export const MUSICXML_ELEMENT_BY_CODE: Record<number, string> = {
  1: "score-partwise",
  2: "part-list",
  3: "score-part",
  4: "part-name",
  5: "part",
  6: "measure",
  7: "attributes",
  8: "divisions",
  9: "key",
  10: "fifths",
  11: "time",
  12: "beats",
  13: "beat-type",
  14: "clef",
  15: "sign",
  16: "line",
  17: "note",
  18: "pitch",
  19: "step",
  20: "alter",
  21: "octave",
  22: "duration",
  23: "voice",
  24: "type",
  25: "dot",
  26: "rest",
  27: "chord",
  28: "tie",
  29: "notations",
  30: "tied",
  31: "slur",
  32: "tuplet",
  33: "lyric",
  34: "syllabic",
  35: "text",
  36: "direction",
  37: "direction-type",
  38: "dynamics",
  39: "words",
  40: "sound",
  41: "backup",
  42: "forward",
  43: "barline",
  44: "bar-style",
  45: "repeat",
  46: "ending",
  47: "articulations",
  48: "accent",
  49: "staccato",
  50: "tenuto",
  51: "strong-accent",
  52: "fermata",
  53: "ornaments",
  54: "trill-mark",
  55: "wavy-line",
  56: "transpose",
  57: "diatonic",
  58: "chromatic",
  59: "octave-change",
  60: "staff",
  61: "stem",
  62: "beam",
  63: "accidental",
  64: "grace",
  65: "unpitched",
  66: "display-step",
  67: "display-octave",
  68: "instrument",
  69: "midi-instrument",
  70: "midi-channel",
  71: "midi-program",
  72: "volume",
  73: "pan",
};

export const MUSICXML_ATTR_BY_CODE: Record<number, string> = {
  1: "version",
  2: "id",
  3: "number",
  4: "type",
  5: "placement",
  6: "line",
  7: "default-x",
  8: "default-y",
  9: "relative-x",
  10: "relative-y",
  11: "font-family",
  12: "font-size",
  13: "font-style",
  14: "font-weight",
  15: "color",
  16: "print-object",
  17: "print-spacing",
  18: "orientation",
  19: "end-length",
  20: "line-type",
  21: "dash-length",
  22: "space-length",
  23: "bezier-x",
  24: "bezier-y",
  25: "bezier-x2",
  26: "bezier-y2",
};

export const MUSICXML_ENUM_VALUE_BY_CODE: Record<number, string> = {
  1: "start",
  2: "stop",
  3: "continue",
  4: "up",
  5: "down",
  6: "above",
  7: "below",
  8: "left",
  9: "right",
  10: "yes",
  11: "no",
  20: "whole",
  21: "half",
  22: "quarter",
  23: "eighth",
  24: "16th",
  25: "32nd",
  26: "64th",
  27: "128th",
  40: "C",
  41: "D",
  42: "E",
  43: "F",
  44: "G",
  45: "A",
  46: "B",
  60: "G",
  61: "F",
  62: "C",
  63: "percussion",
  80: "single",
  81: "begin",
  82: "middle",
  83: "end",
  100: "regular",
  101: "dotted",
  102: "dashed",
  103: "wavy",
  120: "light-heavy",
  121: "heavy-light",
};

export const normalizeScoreCode = (value: number): number =>
  Number.isFinite(value) ? Math.trunc(value) : Number.NaN;

export const dynamicSymbolFromCode = (value: number): (typeof DYNAMIC_SYMBOLS)[number] | null => {
  const code = normalizeScoreCode(value);
  return DYNAMIC_SYMBOLS[code] ?? null;
};

export const dynamicCodeFromVelocity = (value: number): number => {
  if (!Number.isFinite(value)) return 4;
  const clamped = Math.max(0, Math.min(127, Math.round(value)));
  if (clamped <= 15) return 0;
  if (clamped <= 31) return 1;
  if (clamped <= 47) return 2;
  if (clamped <= 63) return 3;
  if (clamped <= 79) return 4;
  if (clamped <= 95) return 5;
  if (clamped <= 111) return 6;
  return 7;
};

export const resolveTextToken = (textKind: number, value: number): string => {
  const kind = normalizeScoreCode(textKind);
  if (kind === SCORE_TEXT_KIND_DYNAMIC_TOKEN) {
    return dynamicSymbolFromCode(value) ?? "";
  }
  if (kind === SCORE_TEXT_KIND_NOTE_TYPE_TOKEN) {
    return MUSICXML_ENUM_VALUE_BY_CODE[20 + normalizeScoreCode(value)] ?? "";
  }
  if (kind === SCORE_TEXT_KIND_GENERAL_TOKEN) {
    return MUSICXML_ENUM_VALUE_BY_CODE[normalizeScoreCode(value)] ?? "";
  }
  const codePoint = normalizeScoreCode(value);
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return "";
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return "";
  }
};

export const resolveMusicXmlElementName = (code: number): string | null =>
  MUSICXML_ELEMENT_BY_CODE[normalizeScoreCode(code)] ?? null;

export const resolveMusicXmlAttrName = (code: number): string | null =>
  MUSICXML_ATTR_BY_CODE[normalizeScoreCode(code)] ?? null;

export const resolveMusicXmlEnumValue = (code: number): string | null =>
  MUSICXML_ENUM_VALUE_BY_CODE[normalizeScoreCode(code)] ?? null;

export const resolveArticulationElementName = (code: number): string | null =>
  SCORE_ARTICULATION_ELEMENT_BY_CODE[normalizeScoreCode(code)] ?? null;

export const resolveSlurType = (code: number): "start" | "stop" | "continue" | null => {
  const normalized = normalizeScoreCode(code);
  const enumValue = resolveMusicXmlEnumValue(normalized);
  if (enumValue === "start" || enumValue === "stop" || enumValue === "continue") {
    return enumValue;
  }
  return SCORE_SLUR_TYPE_BY_CODE[normalized] ?? null;
};

export const resolvePlacement = (code: number): "above" | "below" | null => {
  const normalized = normalizeScoreCode(code);
  const enumValue = resolveMusicXmlEnumValue(normalized);
  if (enumValue === "above" || enumValue === "below") return enumValue;
  return SCORE_PLACEMENT_BY_CODE[normalized] ?? null;
};

export const resolveClefSign = (code: number): string | null => {
  const normalized = normalizeScoreCode(code);
  const enumValue = resolveMusicXmlEnumValue(normalized);
  if (enumValue === "G" || enumValue === "F" || enumValue === "C" || enumValue === "percussion") {
    return enumValue;
  }
  return SCORE_CLEF_SIGN_BY_CODE[normalized] ?? null;
};

export const resolveKeyMode = (code: number): string | null =>
  SCORE_KEY_MODE_BY_CODE[normalizeScoreCode(code)] ?? null;

export const isValidXmlName = (value: string): boolean =>
  /^[:A-Z_a-z][:A-Z_a-z0-9.-]*$/.test(value);

export const formatNumericXmlValue = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
};
