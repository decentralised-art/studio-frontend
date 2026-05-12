import { describe, expect, it } from "vitest";
import { fromProtocolConnectorPayload } from "../src/lib/chain/connectorContractAdapter";
import {
  buildMusicXmlWorldRiFields,
  createDefaultMusicXmlRuntimeSelectionFromRegistry,
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
    expect(byConnectorName.get("test_note_table_version5_06052026")?.contextPathPrefix).toBe(
      "/test_score_root_0_version2_6052026:0/test_note_table_version5_06052026:*",
    );
    expect(byConnectorName.get("score_quarter_note_tick_grid")?.position).toBe(3);
    expect(byConnectorName.get("score_quarter_note_tick_grid")?.contextPathPrefix).toBe(
      "/test_score_root_0_version2_6052026:0/test_note_table_version5_06052026:0/score_quarter_note_tick_grid:*",
    );
    expect(byConnectorName.get("constant_value")?.position).toBe(5);
    expect(byConnectorName.get("constant_value")?.contextPathPrefix).toBe(
      "/test_score_root_0_version2_6052026:0/test_note_table_version5_06052026:1/constant_value:*",
    );
    expect(byConnectorName.get("constant_value")?.isStatic).toBe(true);
    expect(byConnectorName.get("constant_value")?.startPoint).toBe(2520);
    expect(byConnectorName.get("major_scale_steps")?.position).toBe(7);
    expect(byConnectorName.get("major_scale_steps")?.contextPathPrefix).toBe(
      "/test_score_root_0_version2_6052026:0/test_note_table_version5_06052026:2/major_scale_steps:*",
    );
    expect(byConnectorName.get("major_scale_steps")?.isStatic).toBe(false);
  });

  it("randomizes open connector RI fields without positional-schema filtering", () => {
    const registry = buildFixtureRegistry();
    const fields = buildMusicXmlWorldRiFields(registry, "test_score_root_0_version2_6052026");
    const openPositionByKey = new Map(
      fields.filter((field) => !field.isStatic).map((field) => [String(field.position), field]),
    );
    let sawTickField = false;

    for (let seed = 1; seed <= 40; seed += 1) {
      const selection = createRandomMusicXmlRuntimeSelectionFromRegistry(
        "test_score_root_0_version2_6052026",
        registry,
        seed,
      );
      const entries = Object.entries(selection.dynamicRiInput);

      expect(entries.length).toBeGreaterThan(0);
      entries.forEach(([position, value]) => {
        const field = openPositionByKey.get(position);
        expect(field).toBeDefined();
        if (field?.connectorName.includes("tick")) {
          sawTickField = true;
          expect(value.start_point).toBeGreaterThanOrEqual(0);
          expect(value.start_point).toBeLessThanOrEqual(10080);
          expect(value.start_point % 2520).toBe(0);
          expect(value.transformation_shift).toBe(0);
        }
      });
    }

    expect(sawTickField).toBe(true);
  });

  it("creates MusicXML-safe default RI values for open semantic terminal fields", () => {
    const registry = {
      musicxml_multilevel_test_13052026: fromProtocolConnectorPayload({
        name: "musicxml_multilevel_test_13052026",
        dimensions: [
          {
            transformations: [{ name: "add", args: [1] }],
            composite: "note_table_chromatic_quarters_13052026",
            bindings: {},
          },
        ],
      }),
      note_table_chromatic_quarters_13052026: fromProtocolConnectorPayload({
        name: "note_table_chromatic_quarters_13052026",
        dimensions: [
          {
            transformations: [{ name: "add", args: [2520] }],
            composite: "onset_tick",
            bindings: {},
          },
          {
            transformations: [{ name: "add", args: [0] }],
            composite: "duration_tick",
            bindings: {},
          },
          {
            transformations: [{ name: "add", args: [1] }],
            composite: "pitch_midi",
            bindings: {},
          },
        ],
      }),
      onset_tick: fromProtocolConnectorPayload({
        name: "onset_tick",
        dimensions: [{ transformations: [{ name: "add", args: [1] }], bindings: {} }],
      }),
      duration_tick: fromProtocolConnectorPayload({
        name: "duration_tick",
        dimensions: [{ transformations: [{ name: "add", args: [1] }], bindings: {} }],
      }),
      pitch_midi: fromProtocolConnectorPayload({
        name: "pitch_midi",
        dimensions: [{ transformations: [{ name: "add", args: [1] }], bindings: {} }],
      }),
    };

    const selection = createDefaultMusicXmlRuntimeSelectionFromRegistry(
      "musicxml_multilevel_test_13052026",
      registry,
      12,
    );
    const fields = buildMusicXmlWorldRiFields(registry, "musicxml_multilevel_test_13052026");
    const positionByName = new Map(fields.map((field) => [field.connectorName, field.position]));

    expect(selection.dynamicRiInput[String(positionByName.get("duration_tick"))]).toEqual({
      start_point: 2520,
      transformation_shift: 0,
    });
    expect(selection.dynamicRiInput[String(positionByName.get("pitch_midi"))]).toEqual({
      start_point: 60,
      transformation_shift: 0,
    });
  });
});
