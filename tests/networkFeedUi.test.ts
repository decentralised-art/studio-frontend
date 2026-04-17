import { describe, expect, it } from "vitest";
import { resolveNetworkFeedEmptyMessage } from "../src/lib/feed/networkFeedUi";

describe("resolveNetworkFeedEmptyMessage", () => {
  it("returns follow suggestion when no follows and no own events", () => {
    expect(
      resolveNetworkFeedEmptyMessage({
        feedLoadError: "",
        hasVisibleEvents: false,
        hasFollowTargets: false,
        hasOwnEvents: false,
      }),
    ).toContain("not following any accounts or formats");
  });

  it("returns followed-empty message when follows exist but no events", () => {
    expect(
      resolveNetworkFeedEmptyMessage({
        feedLoadError: "",
        hasVisibleEvents: false,
        hasFollowTargets: true,
        hasOwnEvents: false,
      }),
    ).toBe("No events from followed users or followed formats yet.");
  });
});
