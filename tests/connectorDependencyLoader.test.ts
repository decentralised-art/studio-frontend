import { describe, expect, it, vi } from "vitest";

import { loadConnectorDependencies } from "../src/lib/studio/connectorDependencyLoader";

type Connector = {
  dimensions: Array<{ composite?: string; bindings?: Record<string, string> }>;
};

const references = (connector: Connector) =>
  connector.dimensions.flatMap((dimension) => [
    dimension.composite ?? "",
    ...Object.values(dimension.bindings ?? {}),
  ]);

const scalar: Connector = { dimensions: [{}] };
const withChildren = (...names: string[]): Connector => ({
  dimensions: names.map((composite) => ({ composite })),
});

const wideClosure = () => {
  const names = Array.from({ length: 104 }, (_, index) =>
    index === 0 ? "root" : index === 71 ? "pitch" : `connector-${index}`,
  );
  const definitions = new Map(names.map((name) => [name, scalar]));
  definitions.set("root", withChildren(...names.slice(1)));
  return { names, definitions };
};

describe("connector dependency loading", () => {
  it("traverses all 104 cached definitions and fetches foreign pitch at BFS visit 72", async () => {
    const { names, definitions } = wideClosure();
    const cached = new Map(definitions);
    cached.delete("pitch");
    const loadConnector = vi.fn(async (name: string) => {
      cached.set(name, definitions.get(name)!);
    });
    const referenceNames = vi.fn(references);

    const result = await loadConnectorDependencies({
      rootName: "root",
      getConnector: (name) => cached.get(name),
      loadConnector,
      referenceNames,
    });

    expect(names.indexOf("pitch")).toBe(71);
    expect(loadConnector).toHaveBeenCalledExactlyOnceWith("pitch");
    expect(referenceNames).toHaveBeenCalledTimes(104);
    expect(result).toEqual({ loaded: ["pitch"], missing: [] });
  });

  it("loads a cold closure larger than 64 without truncating references", async () => {
    const { names, definitions } = wideClosure();
    const cached = new Map<string, Connector>();
    const loadConnector = vi.fn(async (name: string) => {
      cached.set(name, definitions.get(name)!);
    });

    const result = await loadConnectorDependencies({
      rootName: "root",
      getConnector: (name) => cached.get(name),
      loadConnector,
      referenceNames: references,
    });

    expect(result).toEqual({ loaded: names, missing: [] });
    expect(loadConnector).toHaveBeenCalledTimes(104);
  });

  it("deduplicates shared composite and binding references and terminates cycles", async () => {
    const cached = new Map<string, Connector>([
      ["root", { dimensions: [{ composite: " child ", bindings: { "0": "child", "1": "root" } }] }],
      ["child", { dimensions: [{ composite: "root", bindings: { "0": "leaf" } }] }],
      ["leaf", scalar],
    ]);
    const loadConnector = vi.fn(async () => {});
    const referenceNames = vi.fn(references);

    expect(
      await loadConnectorDependencies({
        rootName: " root ",
        getConnector: (name) => cached.get(name),
        loadConnector,
        referenceNames,
      }),
    ).toEqual({ loaded: [], missing: [] });
    expect(loadConnector).not.toHaveBeenCalled();
    expect(referenceNames).toHaveBeenCalledTimes(3);
  });

  it("reports absent dependencies once and continues loading other references", async () => {
    const cached = new Map([["root", withChildren("missing", "available", "missing")]]);
    const loadConnector = vi.fn(async (name: string) => {
      if (name === "available") cached.set(name, scalar);
    });

    const result = await loadConnectorDependencies({
      rootName: "root",
      getConnector: (name) => cached.get(name),
      loadConnector,
      referenceNames: references,
    });

    expect(result).toEqual({ loaded: ["available"], missing: ["missing"] });
    expect(loadConnector.mock.calls.map(([name]) => name)).toEqual(["missing", "available"]);
  });

  it("reports an unavailable root without inventing dependent definitions", async () => {
    const loadConnector = vi.fn(async () => {});
    expect(
      await loadConnectorDependencies({
        rootName: "missing-root",
        getConnector: () => undefined as Connector | undefined,
        loadConnector,
        referenceNames: references,
      }),
    ).toEqual({ loaded: [], missing: ["missing-root"] });
    expect(loadConnector).toHaveBeenCalledExactlyOnceWith("missing-root");
  });

  it("does not read or load anything for an already cancelled request", async () => {
    const controller = new AbortController();
    controller.abort();
    const getConnector = vi.fn(() => scalar);
    const loadConnector = vi.fn(async () => {});

    await expect(
      loadConnectorDependencies({
        rootName: "root",
        getConnector,
        loadConnector,
        referenceNames: references,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(getConnector).not.toHaveBeenCalled();
    expect(loadConnector).not.toHaveBeenCalled();
  });

  it("stops the queue after a pending load completes when cancelled", async () => {
    const controller = new AbortController();
    const cached = new Map([["root", withChildren("first", "second")]]);
    let finishFetch!: () => void;
    const fetchFinished = new Promise<void>((resolve) => {
      finishFetch = resolve;
    });
    const loadConnector = vi.fn(async (name: string) => {
      await fetchFinished;
      cached.set(name, withChildren("grandchild"));
    });
    const referenceNames = vi.fn(references);
    const pending = loadConnectorDependencies({
      rootName: "root",
      getConnector: (name) => cached.get(name),
      loadConnector,
      referenceNames,
      signal: controller.signal,
    });
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    finishFetch();

    await rejected;
    expect(loadConnector).toHaveBeenCalledExactlyOnceWith("first");
    expect(referenceNames).toHaveBeenCalledExactlyOnceWith(cached.get("root"));
  });

  it("propagates transient errors and retries the unresolved dependency on the next call", async () => {
    const cached = new Map([["root", withChildren("leaf")]]);
    let attempts = 0;
    const failure = new Error("Registry temporarily unavailable");
    const loadConnector = vi.fn(async (name: string) => {
      if (attempts++ === 0) throw failure;
      cached.set(name, scalar);
    });
    const options = {
      rootName: "root",
      getConnector: (name: string) => cached.get(name),
      loadConnector,
      referenceNames: references,
    };

    await expect(loadConnectorDependencies(options)).rejects.toBe(failure);
    expect(cached.has("leaf")).toBe(false);
    expect(await loadConnectorDependencies(options)).toEqual({ loaded: ["leaf"], missing: [] });
    expect(loadConnector).toHaveBeenCalledTimes(2);
  });

  it("ignores a blank root without loading definitions", async () => {
    const loadConnector = vi.fn(async () => {});
    expect(
      await loadConnectorDependencies({
        rootName: "  ",
        getConnector: () => scalar,
        loadConnector,
        referenceNames: references,
      }),
    ).toEqual({ loaded: [], missing: [] });
    expect(loadConnector).not.toHaveBeenCalled();
  });
});
