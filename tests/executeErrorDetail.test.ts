import { describe, expect, it } from "vitest";

import { ChainApiRequestError } from "../src/lib/chain/registryApi";
import { extractExecuteErrorDetail } from "../src/lib/studio/executeErrorDetail";

describe("execute error detail formatter", () => {
  it("uses backend message fields when present", () => {
    const error = new ChainApiRequestError("Bad request", 400, {
      message: "Invalid connector",
      code: "bad_connector",
    });

    expect(extractExecuteErrorDetail(error)).toEqual({
      headline: "POST /execute 400 · Invalid connector",
      details: JSON.stringify({ message: "Invalid connector", code: "bad_connector" }, null, 2),
    });
  });

  it("uses string response bodies as backend details", () => {
    const error = new ChainApiRequestError("Server rejected request", 500, "raw failure");

    expect(extractExecuteErrorDetail(error)).toEqual({
      headline: "POST /execute 500 · raw failure",
      details: "raw failure",
    });
  });

  it("falls back for generic errors and unknown values", () => {
    expect(extractExecuteErrorDetail(new Error("Network unavailable"))).toEqual({
      headline: "POST /execute failed · Network unavailable",
      details: "",
    });
    expect(extractExecuteErrorDetail(null)).toEqual({
      headline: "POST /execute failed · Run failed.",
      details: "",
    });
  });
});
