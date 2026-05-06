import { describe, expect, it } from "vitest";

import { orderConnectorDefsForDeploy } from "../src/lib/studio/connectorDeployOrder";
import type { StudioConnectorDef } from "../src/lib/studio/domain/connectorModel";

const connector = (
  name: string,
  dimensions: StudioConnectorDef["dimensions"] = [{ transformations: [], bindings: {} }],
): StudioConnectorDef => ({
  name,
  dimensions,
});

describe("connector deploy ordering", () => {
  it("orders local connector dependencies before their parents", () => {
    const result = orderConnectorDefsForDeploy([
      connector("root", [{ transformations: [], composite: "child", bindings: {} }]),
      connector("child", [{ transformations: [], composite: "leaf", bindings: {} }]),
      connector("leaf"),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.ordered.map((item) => item.name)).toEqual(["leaf", "child", "root"]);
  });

  it("reports local connector dependency cycles", () => {
    const result = orderConnectorDefsForDeploy([
      connector("a", [{ transformations: [], composite: "b", bindings: {} }]),
      connector("b", [{ transformations: [], composite: "a", bindings: {} }]),
    ]);

    expect(result.warnings).toEqual(["Connector dependency cycle detected: a -> b -> a."]);
  });
});
