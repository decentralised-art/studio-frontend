import {
  type ChainApiPostResult,
  ChainApiRequestError,
  type ChainConnectorPayload,
  type RawChainConditionResponse,
  type RawChainConnectorResponse,
  type RawChainTransformationResponse,
  postChainConditionDetailed,
  postChainConnectorDetailed,
  postChainTransformationDetailed,
} from "$lib/chain/registryApi";

export type DeployTraceEntry = {
  id: string;
  method: "POST";
  path: string;
  requestBody: unknown;
  responseStatus: number | null;
  responseBody: unknown;
  ok: boolean;
  at: number;
};

export type DeployTraceLogger = Pick<Console, "log"> &
  Partial<Pick<Console, "groupCollapsed" | "groupEnd">>;

export type ChainSoliditySourcePayload = {
  name: string;
  sol_src: string;
};

export type StudioChainPostOperation<T> = () => Promise<ChainApiPostResult<T>>;

export type StudioChainPostTracer = <T>(
  path: string,
  requestBody: unknown,
  operation: StudioChainPostOperation<T>,
) => Promise<T>;

const defaultIdFactory = () =>
  `deploy-trace-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;

export const buildDeployTraceSuccessEntry = <T>({
  path,
  requestBody,
  result,
  id = defaultIdFactory(),
  at = Date.now(),
}: {
  path: string;
  requestBody: unknown;
  result: ChainApiPostResult<T>;
  id?: string;
  at?: number;
}): DeployTraceEntry => ({
  id,
  method: "POST",
  path,
  requestBody,
  responseStatus: result.status,
  responseBody: result.body,
  ok: true,
  at,
});

export const buildDeployTraceErrorEntry = ({
  path,
  requestBody,
  error,
  id = defaultIdFactory(),
  at = Date.now(),
}: {
  path: string;
  requestBody: unknown;
  error: unknown;
  id?: string;
  at?: number;
}): DeployTraceEntry => ({
  id,
  method: "POST",
  path,
  requestBody,
  responseStatus: error instanceof ChainApiRequestError ? error.status : null,
  responseBody:
    error instanceof ChainApiRequestError
      ? error.responseBody
      : error instanceof Error
        ? { message: error.message }
        : { message: "Unknown error" },
  ok: false,
  at,
});

export const logDeployTraceEntry = (
  entry: DeployTraceEntry,
  logger: DeployTraceLogger = console,
): void => {
  const label = `[Studio deploy] ${entry.method} ${entry.path} -> ${entry.responseStatus ?? "n/a"}`;
  if (typeof logger.groupCollapsed === "function") {
    logger.groupCollapsed(label);
    logger.log("Request body:", entry.requestBody);
    logger.log("Response body:", entry.responseBody);
    logger.groupEnd?.();
    return;
  }
  logger.log(label, { requestBody: entry.requestBody, responseBody: entry.responseBody });
};

export const traceChainPost = async <T>({
  path,
  requestBody,
  operation,
  appendEntry,
  idFactory = defaultIdFactory,
  now = Date.now,
  logger = console,
}: {
  path: string;
  requestBody: unknown;
  operation: () => Promise<ChainApiPostResult<T>>;
  appendEntry: (entry: DeployTraceEntry) => void;
  idFactory?: () => string;
  now?: () => number;
  logger?: DeployTraceLogger;
}): Promise<T> => {
  try {
    const result = await operation();
    const entry = buildDeployTraceSuccessEntry({
      path,
      requestBody,
      result,
      id: idFactory(),
      at: now(),
    });
    appendEntry(entry);
    logDeployTraceEntry(entry, logger);
    return result.body;
  } catch (error) {
    const entry = buildDeployTraceErrorEntry({
      path,
      requestBody,
      error,
      id: idFactory(),
      at: now(),
    });
    appendEntry(entry);
    logDeployTraceEntry(entry, logger);
    throw error;
  }
};

export const createStudioChainPostTracer = ({
  withAuthRetry,
  appendEntry,
  idFactory,
  now,
  logger,
}: {
  withAuthRetry: <T>(operation: StudioChainPostOperation<T>) => Promise<ChainApiPostResult<T>>;
  appendEntry: (entry: DeployTraceEntry) => void;
  idFactory?: () => string;
  now?: () => number;
  logger?: DeployTraceLogger;
}): StudioChainPostTracer => {
  return <T>(path: string, requestBody: unknown, operation: StudioChainPostOperation<T>) =>
    traceChainPost({
      path,
      requestBody,
      operation: () => withAuthRetry(operation),
      appendEntry,
      idFactory,
      now,
      logger,
    });
};

export const publishConditionWithTrace = (
  tracePost: StudioChainPostTracer,
  requestBody: ChainSoliditySourcePayload,
): Promise<RawChainConditionResponse> =>
  tracePost("/chain/condition", requestBody, () => postChainConditionDetailed(requestBody));

export const publishTransformationWithTrace = (
  tracePost: StudioChainPostTracer,
  requestBody: ChainSoliditySourcePayload,
): Promise<RawChainTransformationResponse> =>
  tracePost("/chain/transformation", requestBody, () =>
    postChainTransformationDetailed(requestBody),
  );

export const publishConnectorWithTrace = (
  tracePost: StudioChainPostTracer,
  requestBody: ChainConnectorPayload,
): Promise<RawChainConnectorResponse> =>
  tracePost("/chain/connector", requestBody, () => postChainConnectorDetailed(requestBody));

export const extractChainDeployErrorMessage = (error: unknown, fallback: string): string => {
  const responseBody = error instanceof ChainApiRequestError ? error.responseBody : undefined;
  const responseMessage =
    responseBody &&
    typeof responseBody === "object" &&
    "message" in responseBody &&
    typeof (responseBody as { message?: unknown }).message === "string"
      ? ((responseBody as { message: string }).message ?? "").trim()
      : "";

  return responseMessage || (error instanceof Error ? error.message : fallback);
};
