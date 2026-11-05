import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchStudioFeed } from "../src/lib/studio/studioFeedTransport";

const CURSOR = "c1793652669854:1308:0:local:11155111:connector_added:phrase";
const requestUrl = (input: RequestInfo | URL) =>
  input instanceof Request ? input.url : String(input);

describe("Studio feed cursor transport", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("keeps colon separators literal in the before cursor", async () => {
    await fetchStudioFeed(
      `https://api.example.invalid/chain/feed?limit=256&before=${encodeURIComponent(CURSOR)}&include_unfinalized=1`,
      { method: "GET", cache: "no-store" },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.invalid/chain/feed?limit=256&before=${CURSOR}&include_unfinalized=1`,
      { method: "GET", cache: "no-store" },
    );
  });

  it("decodes only cursor colons without introducing parameters or fragments", async () => {
    const cursor = `${CURSOR}&type=condition_added#fragment?next+%:tail`;
    await fetchStudioFeed(
      `https://api.example.invalid/prefix/feed?before=${encodeURIComponent(cursor)}&type=connector%3Aadded`,
    );
    const raw = requestUrl(fetchMock.mock.calls[0][0]);
    const url = new URL(raw);
    expect(url.searchParams.get("before")).toBe(cursor);
    expect(url.searchParams.getAll("before")).toHaveLength(1);
    expect([...url.searchParams.keys()]).toEqual(["before", "type"]);
    expect(url.searchParams.get("type")).toBe("connector:added");
    expect(url.hash).toBe("");
    expect(raw).toContain("%26type%3Dcondition_added%23fragment%3Fnext%2B%25:tail");
    expect(raw).toContain("type=connector%3Aadded");
  });

  it("preserves a percent-encoded colon that is literal cursor data", async () => {
    const cursor = `${CURSOR}%3Aname`;
    await fetchStudioFeed(`https://api.example.invalid/feed?before=${encodeURIComponent(cursor)}`);
    const raw = requestUrl(fetchMock.mock.calls[0][0]);
    expect(raw).toContain("%253Aname");
    expect(new URL(raw).searchParams.get("before")).toBe(cursor);
  });

  it("supports relative proxy paths and lowercase escapes without changing their base", async () => {
    await fetchStudioFeed(
      "/custom-chain/feed?limit=2&before=c1%3a2%3A0%3alocal%3a1%3aconnector_added%3atest",
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/custom-chain/feed?limit=2&before=c1:2:0:local:1:connector_added:test",
    );
  });

  it("preserves first-page requests and unrelated endpoints byte for byte", async () => {
    for (const url of [
      "https://api.example.invalid/chain/feed?limit=256&type=connector%3Aadded",
      `https://api.example.invalid/chain/feed/stream?before=${encodeURIComponent(CURSOR)}`,
      `https://api.example.invalid/chain/account/owner?after_connectors=${encodeURIComponent(CURSOR)}`,
    ]) {
      const init = { method: "GET", cache: "no-store" as const };
      await fetchStudioFeed(url, init);
      expect(fetchMock).toHaveBeenLastCalledWith(url, init);
    }
  });

  it("does not mistake another value or a URL fragment for the before parameter", async () => {
    for (const url of [
      `https://api.example.invalid/feed?redirect=?before=${encodeURIComponent(CURSOR)}`,
      `https://api.example.invalid/feed?cursor_before=${encodeURIComponent(CURSOR)}`,
      `https://api.example.invalid/feed#fragment?before=${encodeURIComponent(CURSOR)}`,
      `https://api.example.invalid/feed?limit=2#fragment&before=${encodeURIComponent(CURSOR)}`,
    ]) {
      await fetchStudioFeed(url);
      expect(fetchMock).toHaveBeenLastCalledWith(url, undefined);
    }
  });

  it("does not alter POST requests or a Request whose method is overridden to POST", async () => {
    const url = `https://api.example.invalid/feed?before=${encodeURIComponent(CURSOR)}`;
    const init = { method: "POST", body: "unchanged" };
    await fetchStudioFeed(url, init);
    expect(fetchMock).toHaveBeenLastCalledWith(url, init);
    const request = new Request(url);
    await fetchStudioFeed(request, init);
    expect(fetchMock.mock.calls[1][0]).toBe(request);
    expect(fetchMock.mock.calls[1][1]).toBe(init);
  });

  it("preserves Request headers, policy and abort linkage when cloning its URL", async () => {
    const controller = new AbortController();
    const request = new Request(
      `https://api.example.invalid/proxy/feed?before=${encodeURIComponent(CURSOR)}`,
      {
        method: "GET",
        headers: { Authorization: "Bearer test-token", "X-Trace": "kept" },
        credentials: "include",
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
      },
    );
    await fetchStudioFeed(request);
    const forwarded = fetchMock.mock.calls[0][0];
    expect(forwarded).toBeInstanceOf(Request);
    expect(forwarded).not.toBe(request);
    const cloned = forwarded as Request;
    expect(cloned.url).toBe(`https://api.example.invalid/proxy/feed?before=${CURSOR}`);
    expect(cloned.method).toBe("GET");
    expect(cloned.headers.get("Authorization")).toBe("Bearer test-token");
    expect(cloned.headers.get("X-Trace")).toBe("kept");
    expect(cloned.credentials).toBe("include");
    expect(cloned.redirect).toBe("manual");
    expect(cloned.cache).toBe("no-store");
    expect(cloned.signal.aborted).toBe(false);
    controller.abort();
    expect(cloned.signal.aborted).toBe(true);
  });

  it("forwards URL inputs and caller init without losing headers or signals", async () => {
    const url = new URL(
      `https://api.example.invalid/prefix/feed?before=${encodeURIComponent(CURSOR)}`,
    );
    const init = {
      headers: new Headers({ "X-Trace": "caller" }),
      signal: new AbortController().signal,
      cache: "no-store" as const,
    };
    await fetchStudioFeed(url, init);
    expect(requestUrl(fetchMock.mock.calls[0][0])).toBe(
      `https://api.example.invalid/prefix/feed?before=${CURSOR}`,
    );
    expect(fetchMock.mock.calls[0][1]).toBe(init);
  });

  it("returns HTTP responses and propagates network failures unchanged", async () => {
    const response = new Response("gateway unavailable", { status: 502 });
    fetchMock.mockResolvedValueOnce(response);
    expect(await fetchStudioFeed("https://api.example.invalid/feed")).toBe(response);
    const error = new TypeError("connection failed");
    fetchMock.mockRejectedValueOnce(error);
    await expect(fetchStudioFeed("https://api.example.invalid/feed")).rejects.toBe(error);
  });
});
