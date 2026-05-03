import { describe, expect, it } from "vitest";

import {
  dynamicCodeFromVelocity,
  dynamicSymbolFromCode,
  resolveArticulationElementName,
  resolveMusicXmlAttrName,
  resolveMusicXmlElementName,
  resolveMusicXmlEnumValue,
  resolvePlacement,
  resolveSlurType,
  resolveTextToken,
  SCORE_TEXT_KIND_DYNAMIC_TOKEN,
  SCORE_TEXT_KIND_UNICODE_CODEPOINT,
} from "../src/lib/score/codebook";

describe("score codebook", () => {
  it("maps MIDI velocity bands onto notation dynamics", () => {
    expect(dynamicSymbolFromCode(dynamicCodeFromVelocity(0))).toBe("ppp");
    expect(dynamicSymbolFromCode(dynamicCodeFromVelocity(64))).toBe("mf");
    expect(dynamicSymbolFromCode(dynamicCodeFromVelocity(127))).toBe("fff");
  });

  it("resolves connector numeric text tokens without free-form strings", () => {
    expect(resolveTextToken(SCORE_TEXT_KIND_UNICODE_CODEPOINT, 0x1d11e)).toBe(
      String.fromCodePoint(0x1d11e),
    );
    expect(resolveTextToken(SCORE_TEXT_KIND_DYNAMIC_TOKEN, 5)).toBe("f");
  });

  it("resolves MusicXML element, attribute, and enum dictionaries", () => {
    expect(resolveMusicXmlElementName(1)).toBe("score-partwise");
    expect(resolveMusicXmlAttrName(1)).toBe("version");
    expect(resolveMusicXmlEnumValue(22)).toBe("quarter");
  });

  it("resolves score decoration codebooks", () => {
    expect(resolveArticulationElementName(1)).toBe("staccato");
    expect(resolveSlurType(1)).toBe("start");
    expect(resolveSlurType(2)).toBe("stop");
    expect(resolvePlacement(6)).toBe("above");
  });
});
