import { describe, expect, it, vi } from "vitest";
import type { PublicationRecord } from "../src/lib/studio/studioPublication";
import {
  buildStudioPublicationPlan,
  publicationEntityKey,
  type PublicationEntity,
  type PublicationPayload,
} from "../src/lib/studio/studioPublicationPlan";

const owner = `0x${"12".repeat(20)}`;
const other = `0x${"34".repeat(20)}`;
const address = `0x${"56".repeat(20)}`;
const txHash = `0x${"ab".repeat(32)}`;
const contentHash = `0x${"cd".repeat(32)}`;
const root: PublicationEntity = { kind: "connector", name: "score" };
const local = (name: string, extras?: Partial<PublicationPayload>): PublicationPayload => ({
  name,
  address: "0x0",
  owner: owner.slice(2),
  dimensions: [{ transformations: [] }],
  ...extras,
});
const record = (fingerprint: unknown, fields?: Partial<PublicationRecord>): PublicationRecord => ({
  ...root,
  fingerprint: JSON.stringify(fingerprint),
  owner,
  content_hash: contentHash,
  stage: "pending",
  chainId: "0xaa36a7",
  tx_hash: txHash,
  ...fields,
});

function fixture(payloads: Record<string, PublicationPayload>) {
  const lookup = vi.fn(async (entity: PublicationEntity) => {
    const payload = payloads[publicationEntityKey(entity)];
    if (!payload) throw new Error("Unavailable");
    return payload;
  });
  return { root, lookup, owner };
}

describe("Studio publication plan", () => {
  it("plans unique condition, transformation, composite and binding dependencies in DFS order", async () => {
    const input = fixture({
      "connector:score": local("score", {
        condition_name: "gate",
        dimensions: [
          {
            transformations: [{ name: "transpose", args: [1] }],
            composite: "phrase",
            bindings: { "0": "pitch", "2": "rhythm" },
          },
          { transformations: [{ name: "transpose", args: [2] }], composite: "rhythm" },
        ],
      }),
      "condition:gate": local("gate"),
      "transformation:transpose": local("transpose"),
      "connector:phrase": local("phrase", { dimensions: [{ composite: "pitch" }] }),
      "connector:rhythm": local("rhythm", { dimensions: [{ composite: "pitch" }] }),
      "connector:pitch": {
        name: "pitch",
        address,
        owner: other,
        // A public connector's embedded graph isn't part of the publication queue.
        dimensions: [{ composite: "missing_public_dependency" }],
      },
    });
    const onProgress = vi.fn();
    const result = await buildStudioPublicationPlan({ ...input, onProgress });
    expect(result.entries.map(({ key, state }) => [key, state])).toEqual([
      ["condition:gate", "draft"],
      ["transformation:transpose", "draft"],
      ["connector:pitch", "published"],
      ["connector:phrase", "draft"],
      ["connector:rhythm", "draft"],
      ["connector:score", "draft"],
    ]);
    expect(result.entries.at(-1)?.dependencies).toEqual([
      "condition:gate",
      "transformation:transpose",
      "connector:phrase",
      "connector:pitch",
      "connector:rhythm",
    ]);
    expect(input.lookup).toHaveBeenCalledTimes(6);
    expect(onProgress).toHaveBeenLastCalledWith(6, { kind: "connector", name: "rhythm" });
  });

  it("keeps a saved transaction unresolved when the index already lists its entity", async () => {
    const input = fixture({ "connector:score": { name: "score", owner, address } });
    const plan = await buildStudioPublicationPlan({
      ...input,
      getRecord: () => record({}, { address }),
    });
    expect(plan.entries).toMatchObject([
      { key: "connector:score", state: "pending", address, txHash, dependencies: [] },
    ]);
  });

  it("recognizes matching mined records when the registry still reports a draft", async () => {
    const payload = local("score", {
      static_ri: { "1": { start_point: 7, transformation_shift: 0 } },
    });
    const plan = await buildStudioPublicationPlan({
      ...fixture({ "connector:score": payload }),
      getRecord: () =>
        record(
          { name: "score", dimensions: [{}], staticRi: { "1": { startPoint: 7 } } },
          { stage: "mined", address },
        ),
    });
    expect(plan.entries[0]).toMatchObject({ state: "mined", address, txHash });
  });

  it("requires a fresh receipt check when an unindexed primitive omits its Solidity source", async () => {
    const primitive = { kind: "transformation", name: "move" } as const;
    const plan = await buildStudioPublicationPlan({
      ...fixture({ "transformation:move": { name: "move", owner, address: "0x0", args_count: 1 } }),
      root: primitive,
      getRecord: () =>
        record({ name: "move", sol_src: "return x;" }, { ...primitive, stage: "mined", address }),
    });
    expect(plan.entries[0]).toMatchObject({
      state: "mined",
      address,
      txHash,
      chainId: "0xaa36a7",
      verifyReceipt: true,
    });
  });

  it("blocks a saved receipt with a different draft definition, owner, or content hash", async () => {
    const payload = local("score");
    const input = fixture({ "connector:score": payload });
    await expect(
      buildStudioPublicationPlan({ ...input, getRecord: () => record(local("different")) }),
    ).rejects.toThrow(/differs from its saved publication/);
    await expect(
      buildStudioPublicationPlan({ ...input, getRecord: () => record(payload, { owner: other }) }),
    ).rejects.toThrow(/invalid owner or content hash/);
    await expect(
      buildStudioPublicationPlan({
        ...fixture({ "connector:score": { ...payload, content_hash: txHash } }),
        getRecord: () => record(payload),
      }),
    ).rejects.toThrow(/registry content hash/);
  });

  it("identifies missing and foreign drafts before preparing the root", async () => {
    const start = local("score", { dimensions: [{ composite: "foreign" }] });
    await expect(buildStudioPublicationPlan(fixture({ "connector:score": start }))).rejects.toThrow(
      "Could not look up connector 'foreign' required by connector 'score'. Unavailable",
    );
    await expect(
      buildStudioPublicationPlan(
        fixture({
          "connector:score": start,
          "connector:foreign": local("foreign", { owner: other }),
        }),
      ),
    ).rejects.toThrow("is neither published nor a draft owned by the selected wallet");
  });

  it("reports dependency cycles and validates names before accepting published boundaries", async () => {
    await expect(
      buildStudioPublicationPlan(
        fixture({
          "connector:score": local("score", { dimensions: [{ composite: "phrase" }] }),
          "connector:phrase": local("phrase", { dimensions: [{ composite: "score" }] }),
        }),
      ),
    ).rejects.toThrow("connector:score → connector:phrase → connector:score");
    await expect(
      buildStudioPublicationPlan(fixture({ "connector:score": { name: "other", address } })),
    ).rejects.toThrow("The registry returned a different entity");
  });

  it("validates wide trees with bounded reads and stable review order", async () => {
    const sections = Array.from({ length: 64 }, (_, index) => `section_${index}`);
    let reading = 0;
    let peak = 0;
    const lookup = vi.fn(async ({ name }: PublicationEntity) => {
      peak = Math.max(peak, ++reading);
      await Promise.resolve();
      reading--;
      return name === root.name
        ? local(name, { dimensions: sections.map((composite) => ({ composite })) })
        : local(name, { dimensions: [{ transformations: [{ name: "shared", args: [] }] }] });
    });
    const plan = await buildStudioPublicationPlan({ root, owner, lookup });
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(6);
    expect(lookup).toHaveBeenCalledTimes(66);
    expect(plan.entries.map(({ name }) => name)).toEqual(["shared", ...sections, "score"]);
  });

  it("stops at an aborted lookup without continuing to a dependency", async () => {
    const controller = new AbortController();
    const lookup = vi.fn(async () => {
      controller.abort();
      return local("score", { dimensions: [{ composite: "phrase" }] });
    });
    await expect(
      buildStudioPublicationPlan({ root, owner, lookup, signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(lookup).toHaveBeenCalledTimes(1);
  });
});
