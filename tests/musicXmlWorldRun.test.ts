import { describe, expect, it } from "vitest";
import { fromProtocolConnectorPayload } from "../src/lib/chain/connectorContractAdapter";
import {
  buildMusicXmlWorldRiFields,
  createRandomMusicXmlRuntimeSelectionFromRegistry,
} from "../src/lib/worlds/musicXmlWorldRun";

describe("musicXmlWorldRun", () => {
  const buildFixtureRegistry = () => {
    const root = fromProtocolConnectorPayload({
      name: "test_score_root_0_version2_6052026",
      dimensions: [
        {
          transformations: [{ name: "add", args: [1] }],
          composite: "test_note_table_version5_06052026",
          bindings: {},
        },
      ],
      static_ri: {
        "5": { start_point: 2520, transformation_shift: 0 },
      },
    });
    const noteTable = fromProtocolConnectorPayload({
      name: "test_note_table_version5_06052026",
      dimensions: [
        {
          transformations: [{ name: "add", args: [1] }],
          composite: "score_quarter_note_tick_grid",
          bindings: {},
        },
        {
          transformations: [{ name: "add", args: [1] }],
          composite: "constant_value",
          bindings: {},
        },
        {
          transformations: [{ name: "add", args: [1] }],
          composite: "major_scale_steps",
          bindings: {},
        },
      ],
      static_ri: {
        "4": { start_point: 2520, transformation_shift: 0 },
      },
    });
    const tickGrid = fromProtocolConnectorPayload({
      name: "score_quarter_note_tick_grid",
      dimensions: [
        {
          transformations: [{ name: "add", args: [2520] }],
        },
      ],
    });
    const constantValue = fromProtocolConnectorPayload({
      name: "constant_value",
      dimensions: [
        {
          transformations: [{ name: "add", args: [0] }],
        },
      ],
    });
    const majorScaleSteps = fromProtocolConnectorPayload({
      name: "major_scale_steps",
      dimensions: [
        {
          transformations: [
            { name: "add", args: [2] },
            { name: "add", args: [2] },
            { name: "add", args: [1] },
            { name: "add", args: [2] },
            { name: "add", args: [2] },
            { name: "add", args: [2] },
            { name: "add", args: [1] },
          ],
        },
      ],
    });

    return {
      test_score_root_0_version2_6052026: root,
      test_note_table_version5_06052026: noteTable,
      score_quarter_note_tick_grid: tickGrid,
      constant_value: constantValue,
      major_scale_steps: majorScaleSteps,
    };
  };

  it("uses connector RI target positions for world RI controls", () => {
    const fields = buildMusicXmlWorldRiFields(
      buildFixtureRegistry(),
      "test_score_root_0_version2_6052026",
    );
    const byConnectorName = new Map(fields.map((field) => [field.connectorName, field]));

    expect(fields).toHaveLength(5);
    expect(byConnectorName.get("test_score_root_0_version2_6052026")?.position).toBe(0);
    expect(byConnectorName.get("test_note_table_version5_06052026")?.position).toBe(2);
    expect(byConnectorName.get("score_quarter_note_tick_grid")?.position).toBe(3);
    expect(byConnectorName.get("constant_value")?.position).toBe(5);
    expect(byConnectorName.get("constant_value")?.isStatic).toBe(true);
    expect(byConnectorName.get("constant_value")?.startPoint).toBe(2520);
    expect(byConnectorName.get("major_scale_steps")?.position).toBe(7);
    expect(byConnectorName.get("major_scale_steps")?.isStatic).toBe(false);
  });

  it("randomizes only semantic open score fields with field-aware ranges", () => {
    const registry = buildFixtureRegistry();
    let sawOnset = false;
    let sawPitch = false;

    for (let seed = 1; seed <= 40; seed += 1) {
      const selection = createRandomMusicXmlRuntimeSelectionFromRegistry(
        "test_score_root_0_version2_6052026",
        registry,
        seed,
      );
      const entries = Object.entries(selection.dynamicRiInput);

      expect(entries.length).toBeGreaterThan(0);
      entries.forEach(([position, value]) => {
        expect(["3", "7"]).toContain(position);
        if (position === "3") {
          sawOnset = true;
          expect(value.start_point).toBeGreaterThanOrEqual(0);
          expect(value.start_point).toBeLessThanOrEqual(10080);
          expect(value.start_point % 2520).toBe(0);
          expect(value.transformation_shift).toBe(0);
        }
        if (position === "7") {
          sawPitch = true;
          expect(value.start_point).toBeGreaterThanOrEqual(48);
          expect(value.start_point).toBeLessThanOrEqual(72);
          expect(value.transformation_shift).toBeGreaterThanOrEqual(0);
          expect(value.transformation_shift).toBeLessThanOrEqual(6);
        }
      });
    }

    expect(sawOnset).toBe(true);
    expect(sawPitch).toBe(true);
  });
});
