import { ChainApiRequestError } from "$lib/chain/registryApi";

export type ExecuteErrorDetail = {
  headline: string;
  details: string;
};

export const extractExecuteErrorDetail = (error: unknown): ExecuteErrorDetail => {
  if (error instanceof ChainApiRequestError) {
    let backendMessage = "";
    const body = error.responseBody;
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const candidate = (body as { message?: unknown }).message;
      if (typeof candidate === "string" && candidate.trim().length) {
        backendMessage = candidate.trim();
      }
    } else if (typeof body === "string" && body.trim().length) {
      backendMessage = body.trim();
    }

    const responseDetails =
      typeof body === "string" ? body : (JSON.stringify(body, null, 2) ?? String(body));
    const headline = backendMessage
      ? `POST /execute ${error.status} · ${backendMessage}`
      : `POST /execute ${error.status} · ${error.message}`;
    return {
      headline,
      details: responseDetails,
    };
  }

  const message = error instanceof Error ? error.message : "Run failed.";
  return {
    headline: `POST /execute failed · ${message}`,
    details: "",
  };
};
