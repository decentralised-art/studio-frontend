import { describe, expect, it, vi } from "vitest";

import { ChainApiRequestError, type ChainApiPostResult } from "../src/lib/chain/registryApi";
import {
  buildDeployTraceErrorEntry,
  buildDeployTraceSuccessEntry,
  createStudioChainPostTracer,
  extractChainDeployErrorMessage,
  publishConditionWithTrace,
  publishConnectorWithTrace,
  publishTransformationWithTrace,
  traceChainPost,
  type DeployTraceEntry,
  type StudioChainPostTracer,
} from "../src/lib/studio/studioDeployTrace";

const silentLogger = () => ({ log: vi.fn() });

describe("Studio deploy trace helpers", () => {
  it("builds stable success and error trace entries", () => {
    const requestBody = { name: "always_true", sol_src: "return true;" };
    const responseBody = { name: "always_true", owner: "0xabc" };

    expect(
      buildDeployTraceSuccessEntry({
        path: "/chain/condition",
        requestBody,
        result: { status: 201, body: responseBody },
        id: "trace-success",
        at: 123,
      }),
    ).toEqual({
      id: "trace-success",
      method: "POST",
      path: "/chain/condition",
      requestBody,
      responseStatus: 201,
      responseBody,
      ok: true,
      at: 123,
    });

    expect(
      buildDeployTraceErrorEntry({
        path: "/chain/condition",
        requestBody,
        error: new ChainApiRequestError("Invalid condition", 400, {
          message: "Invalid condition",
        }),
        id: "trace-error",
        at: 456,
      }),
    ).toEqual({
      id: "trace-error",
      method: "POST",
      path: "/chain/condition",
      requestBody,
      responseStatus: 400,
      responseBody: { message: "Invalid condition" },
      ok: false,
      at: 456,
    });
  });

  it("traces successful chain posts and returns the response body", async () => {
    const requestBody = { name: "pitch" };
    const responseBody = { name: "pitch", owner: "0xabc" };
    const entries: DeployTraceEntry[] = [];
    const logger = silentLogger();

    const result = await traceChainPost({
      path: "/chain/connector",
      requestBody,
      operation: async () => ({ status: 201, body: responseBody }),
      appendEntry: (entry) => entries.push(entry),
      idFactory: () => "trace-1",
      now: () => 1000,
      logger,
    });

    expect(result).toBe(responseBody);
    expect(entries).toEqual([
      {
        id: "trace-1",
        method: "POST",
        path: "/chain/connector",
        requestBody,
        responseStatus: 201,
        responseBody,
        ok: true,
        at: 1000,
      },
    ]);
    expect(logger.log).toHaveBeenCalledWith("[Studio deploy] POST /chain/connector -> 201", {
      requestBody,
      responseBody,
    });
  });

  it("traces failed chain posts and rethrows the original error", async () => {
    const error = new ChainApiRequestError("Connector already exists", 409, {
      message: "Connector already exists",
    });
    const entries: DeployTraceEntry[] = [];

    await expect(
      traceChainPost({
        path: "/chain/connector",
        requestBody: { name: "existing_connector" },
        operation: async () => {
          throw error;
        },
        appendEntry: (entry) => entries.push(entry),
        idFactory: () => "trace-fail",
        now: () => 2000,
        logger: silentLogger(),
      }),
    ).rejects.toBe(error);

    expect(entries).toEqual([
      {
        id: "trace-fail",
        method: "POST",
        path: "/chain/connector",
        requestBody: { name: "existing_connector" },
        responseStatus: 409,
        responseBody: { message: "Connector already exists" },
        ok: false,
        at: 2000,
      },
    ]);
  });

  it("creates an authenticated tracer around the shared trace primitive", async () => {
    let authRetryCalls = 0;
    const entries: DeployTraceEntry[] = [];
    const withAuthRetry = async <T>(
      operation: () => Promise<ChainApiPostResult<T>>,
    ): Promise<ChainApiPostResult<T>> => {
      authRetryCalls += 1;
      return operation();
    };

    const tracePost = createStudioChainPostTracer({
      withAuthRetry,
      appendEntry: (entry) => entries.push(entry),
      idFactory: () => "trace-auth",
      now: () => 3000,
      logger: silentLogger(),
    });

    const response = await tracePost("/chain/transformation", { name: "add2" }, async () => ({
      status: 201,
      body: { name: "add2" },
    }));

    expect(response).toEqual({ name: "add2" });
    expect(authRetryCalls).toBe(1);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.path).toBe("/chain/transformation");
  });

  it("routes publish helpers through the canonical deploy trace paths", async () => {
    const calls: { path: string; requestBody: unknown; hasOperation: boolean }[] = [];
    const tracePost: StudioChainPostTracer = async <T>(
      path: string,
      requestBody: unknown,
      operation: () => Promise<ChainApiPostResult<T>>,
    ): Promise<T> => {
      calls.push({ path, requestBody, hasOperation: typeof operation === "function" });
      return requestBody as T;
    };
    const conditionPayload = { name: "always_true", sol_src: "return true;" };
    const transformationPayload = { name: "add2", sol_src: "return x + args[0];" };
    const connectorPayload = {
      name: "root",
      dimensions: [{ transformations: [{ name: "add2", args: [2] }] }],
    };

    await publishConditionWithTrace(tracePost, conditionPayload);
    await publishTransformationWithTrace(tracePost, transformationPayload);
    await publishConnectorWithTrace(tracePost, connectorPayload);

    expect(calls).toEqual([
      { path: "/chain/condition", requestBody: conditionPayload, hasOperation: true },
      { path: "/chain/transformation", requestBody: transformationPayload, hasOperation: true },
      { path: "/chain/connector", requestBody: connectorPayload, hasOperation: true },
    ]);
  });

  it("extracts deploy error messages from backend payloads before generic errors", () => {
    expect(
      extractChainDeployErrorMessage(
        new ChainApiRequestError("Fallback message", 400, { message: "  Backend message  " }),
        "Deploy failed.",
      ),
    ).toBe("Backend message");
    expect(extractChainDeployErrorMessage(new Error("Network failed"), "Deploy failed.")).toBe(
      "Network failed",
    );
    expect(extractChainDeployErrorMessage(null, "Deploy failed.")).toBe("Deploy failed.");
  });
});
