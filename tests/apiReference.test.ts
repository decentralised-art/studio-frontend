import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { chainGroups, chainSchemas, schemaFields } from "../src/lib/site/docs/apiReference";
import spec from "../src/lib/site/docs/chain-openapi.json";
import { servicesGroups } from "../src/lib/site/docs/servicesApiReference";

const documented = new Set(
  chainGroups.flatMap((group) =>
    group.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`),
  ),
);

describe("API reference", () => {
  it("matches the specification pinned by the frontend SDK", () => {
    const directory = mkdtempSync(resolve(tmpdir(), "frontend-chain-docs-"));
    const output = resolve(directory, "openapi.json");
    try {
      execFileSync(process.execPath, [
        "submodules/sdk/js/scripts/bundle-openapi.mjs",
        "--spec-root",
        "submodules/sdk/submodules/api-spec",
        "--output",
        output,
      ]);
      expect(spec).toEqual(JSON.parse(readFileSync(output, "utf8")));
    } finally {
      rmSync(directory, { recursive: true });
    }
  });

  it("documents every chain operation in the specification", () => {
    const operations = Object.entries(
      spec.paths as Record<string, Record<string, unknown>>,
    ).flatMap(([path, methods]) =>
      Object.keys(methods)
        .filter((method) => !["options", "head", "parameters"].includes(method))
        .map((method) => `${method.toUpperCase()} ${path}`),
    );
    expect(operations.length).toBeGreaterThan(0);
    for (const operation of operations) expect(documented).toContain(operation);
  });

  it("resolves request fields and schema links", () => {
    const create = chainGroups
      .flatMap((group) => group.endpoints)
      .find((endpoint) => endpoint.method === "POST" && endpoint.path === "/connector");
    const fields = create?.body?.fields ?? [];
    expect(fields.find((row) => row.name === "name")?.required).toBe(true);
    expect(fields.find((row) => row.name === "dimensions")?.ref).toBe("ConnectorDimension");
    expect(chainSchemas.map((schema) => schema.name)).toContain("ConnectorDimension");
  });

  it("does not repeat constraints the description already states", () => {
    const rows = schemaFields({ $ref: "#/components/schemas/CreateTransformationRequest" });
    const name = rows.find((row) => row.name === "name");
    expect(name?.description.match(/128/g)?.length).toBe(1);
  });

  it("gives every endpoint a unique anchor", () => {
    const ids = [...chainGroups, ...servicesGroups].flatMap((group) =>
      group.endpoints.map((endpoint) => endpoint.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps example request bodies valid JSON", () => {
    for (const endpoint of chainGroups.flatMap((group) => group.endpoints)) {
      const body = endpoint.example?.request.match(/-d '(.*)'$/s)?.[1];
      if (body) expect(() => JSON.parse(body)).not.toThrow();
    }
  });
});
