import { beforeEach, describe, expect, it } from "vitest";

import {
  clearChainToken,
  clearToken,
  hasAuthSession,
  hasChainSession,
  hasServicesSession,
  setChainToken,
  setToken,
} from "../src/lib/auth/session";

describe("auth session boundaries", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("requires a services token for app authentication", () => {
    setChainToken("chain-token");

    expect(hasChainSession()).toBe(true);
    expect(hasServicesSession()).toBe(false);
    expect(hasAuthSession()).toBe(false);
  });

  it("keeps services and chain authentication as separate sessions", () => {
    setToken("services-token");

    expect(hasServicesSession()).toBe(true);
    expect(hasAuthSession()).toBe(true);
    expect(hasChainSession()).toBe(false);

    setChainToken("chain-token");
    expect(hasChainSession()).toBe(true);
    expect(hasAuthSession()).toBe(true);

    clearToken();
    expect(hasServicesSession()).toBe(false);
    expect(hasAuthSession()).toBe(false);
    expect(hasChainSession()).toBe(true);

    clearChainToken();
    expect(hasChainSession()).toBe(false);
  });
});
