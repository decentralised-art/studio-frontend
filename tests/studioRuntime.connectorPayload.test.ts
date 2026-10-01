import { describe, expect, it } from "vitest";

import { toProtocolConnectorPayload } from "../src/lib/chain/connectorContractAdapter";
import { buildStudioRuntime } from "../src/lib/studio/studioRuntime";

describe("studioRuntime connector payload preparation", () => {
  it("starts without bundled connectors, transformations, or conditions", () => {
    const runtime = buildStudioRuntime({ nodes: [], edges: [] }, { rootLabel: "empty" });

    expect(runtime.registry.connectors).toEqual({});
    expect(runtime.registry.transformations).toEqual({});
    expect(runtime.registry.conditions).toEqual({});
  });

  it("reads canonical condition edges and preserves condition args", () => {
    const runtime = buildStudioRuntime(
      {
        nodes: [
          {
            id: "root",
            data: { kind: "connector", label: "root", dimensions: 1 },
          },
          {
            id: "condition",
            data: { kind: "condition", label: "is_ready" },
          },
        ],
        edges: [
          {
            source: "condition",
            sourceHandle: "out",
            target: "root",
            targetHandle: "condition",
            data: { conditionArgs: [7, -2] },
          },
        ],
      },
      { rootLabel: "root", rootParticleId: "root" },
      {
        conditions: {
          is_ready: { argc: 2, check: () => true },
        },
      },
    );

    expect(toProtocolConnectorPayload(runtime.registry.connectors.root!)).toMatchObject({
      condition_name: "is_ready",
      condition_args: [7, -2],
    });
    expect(runtime.warnings).toEqual([]);
  });

  it("keeps legacy condition-in edges deployable", () => {
    const runtime = buildStudioRuntime(
      {
        nodes: [
          {
            id: "root",
            data: { kind: "connector", label: "root", dimensions: 1 },
          },
          {
            id: "condition",
            data: { kind: "condition", label: "is_ready" },
          },
        ],
        edges: [
          {
            source: "condition",
            sourceHandle: "out",
            target: "root",
            targetHandle: "in",
            data: { conditionArgs: [5] },
          },
        ],
      },
      { rootLabel: "root", rootParticleId: "root" },
      {
        conditions: {
          is_ready: { argc: 1, check: () => true },
        },
      },
    );

    expect(runtime.registry.connectors.root?.conditionName).toBe("is_ready");
    expect(runtime.registry.connectors.root?.conditionArgs).toEqual([5]);
    expect(runtime.warnings).toEqual([]);
  });

  it("does not block connector payloads when condition metadata is not locally cached", () => {
    const runtime = buildStudioRuntime(
      {
        nodes: [
          {
            id: "root",
            data: { kind: "connector", label: "root", dimensions: 1 },
          },
          {
            id: "condition",
            data: {
              kind: "condition",
              label: "test_condition_draft_studio_20260525214406_04aa",
              networkId: "test_condition_draft_studio_20260525214406_04aa",
              fromNetwork: true,
            },
          },
        ],
        edges: [
          {
            source: "condition",
            sourceHandle: "out",
            target: "root",
            targetHandle: "condition",
            data: { conditionArgs: [1779748133] },
          },
        ],
      },
      { rootLabel: "root", rootParticleId: "root" },
    );

    const payload = toProtocolConnectorPayload(runtime.registry.connectors.root!);
    expect(payload.condition_name).toBe("test_condition_draft_studio_20260525214406_04aa");
    expect(payload.condition_args).toEqual([1779748133]);
    expect(runtime.warnings).not.toContain(
      "Missing condition: test_condition_draft_studio_20260525214406_04aa (connector root).",
    );
  });

  it("preserves deployed condition args for network connector overrides", () => {
    const runtime = buildStudioRuntime(
      {
        nodes: [
          {
            id: "root",
            data: {
              kind: "connector",
              label: "conditioned_root",
              networkId: "conditioned_root",
              fromNetwork: true,
              dimensions: 1,
            },
          },
          {
            id: "condition",
            data: {
              kind: "condition",
              label: "is_ready",
              networkId: "is_ready",
              fromNetwork: true,
            },
          },
        ],
        edges: [
          {
            source: "condition",
            sourceHandle: "out",
            target: "root",
            targetHandle: "condition",
          },
        ],
      },
      { rootLabel: "conditioned_root", rootParticleId: "conditioned_root" },
      {
        connectors: {
          conditioned_root: {
            name: "conditioned_root",
            dimensions: [{ transformations: [], bindings: {} }],
            conditionName: "is_ready",
            conditionArgs: [7, -2],
          },
        },
        conditions: {
          is_ready: { argc: 2, check: () => true },
        },
      },
    );

    const payload = toProtocolConnectorPayload(runtime.registry.connectors.conditioned_root!);
    expect(payload.condition_name).toBe("is_ready");
    expect(payload.condition_args).toEqual([7, -2]);
    expect(runtime.warnings).not.toContain(
      "ConditionArgumentsMismatch: is_ready (connector conditioned_root).",
    );
  });

  it("warns when a connector references a missing composite without bindings", () => {
    const runtime = buildStudioRuntime(
      {
        nodes: [
          {
            id: "root",
            data: { kind: "connector", label: "root", dimensions: 1 },
          },
          {
            id: "dimension",
            data: {
              kind: "dimension",
              label: "#1",
              parentFeatureId: "root",
              dimensionIndex: 0,
            },
          },
          {
            id: "missing_child",
            data: {
              kind: "particle",
              label: "Missing Child",
              particleId: "missing_child",
            },
          },
        ],
        edges: [
          {
            source: "root",
            sourceHandle: "dim-0",
            target: "dimension",
            targetHandle: "in",
          },
          {
            source: "dimension",
            sourceHandle: "out",
            target: "missing_child",
            targetHandle: "in",
          },
        ],
      },
      { rootLabel: "root", rootParticleId: "root" },
    );

    expect(runtime.warnings).toContain(
      "Connector root dimension 1 references missing composite missing_child.",
    );
  });
});
