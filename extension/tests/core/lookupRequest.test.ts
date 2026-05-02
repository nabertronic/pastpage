import { describe, expect, it } from "vitest";
import { createBrokenPageLookupRequest, createManualPageLookupRequest } from "@/core/lookupRequest";
import { explainHttpStatus } from "@/core/errors";
import { resolverUrl } from "@/platform/urls";

describe("lookupRequest", () => {
  it("builds a manual-page lookup without error metadata", () => {
    const request = createManualPageLookupRequest("https://example.com/story");
    expect(request).toEqual({
      trigger: "manual-page",
      originalUrl: "https://example.com/story"
    });

    const url = new URL(resolverUrl(request));
    expect(url.searchParams.get("trigger")).toBe("manual-page");
    expect(url.searchParams.get("url")).toBe("https://example.com/story");
    expect(url.searchParams.get("kind")).toBeNull();
    expect(url.searchParams.get("statusCode")).toBeNull();
    expect(url.searchParams.get("browserError")).toBeNull();
  });

  it("preserves broken-page metadata for error recovery", () => {
    const request = createBrokenPageLookupRequest({
      kind: "http",
      originalUrl: "https://example.com/missing",
      statusCode: 404,
      explanation: explainHttpStatus(404),
      detectedAt: 1
    });

    expect(request).toEqual({
      trigger: "broken-page",
      originalUrl: "https://example.com/missing",
      kind: "http",
      statusCode: 404,
      browserError: undefined
    });

    const url = new URL(resolverUrl(request));
    expect(url.searchParams.get("trigger")).toBe("broken-page");
    expect(url.searchParams.get("kind")).toBe("http");
    expect(url.searchParams.get("statusCode")).toBe("404");
  });
});
