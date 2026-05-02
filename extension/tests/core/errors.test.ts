import { describe, expect, it } from "vitest";
import {
  explainHttpStatus,
  explainNavigationError,
  isRelevantHttpStatus,
  isRelevantNavigationError
} from "@/core/errors";

describe("errors", () => {
  it("recognizes relevant HTTP statuses", () => {
    expect(isRelevantHttpStatus(404)).toBe(true);
    expect(isRelevantHttpStatus(451)).toBe(true);
    expect(isRelevantHttpStatus(200)).toBe(false);
  });

  it("explains 451 precisely", () => {
    expect(explainHttpStatus(451).title).toContain("Unavailable for legal reasons");
  });

  it("maps navigation errors to useful explanations", () => {
    expect(explainNavigationError("net::ERR_NAME_NOT_RESOLVED").short).toContain("resolve");
    expect(explainNavigationError("net::ERR_TIMED_OUT").short).toContain("too long");
    expect(explainNavigationError("net::ERR_CERT_AUTHORITY_INVALID").short).toContain("secure");
  });

  it("ignores navigation errors that are usually caused by normal browser flow", () => {
    expect(isRelevantNavigationError("net::ERR_ABORTED")).toBe(false);
    expect(isRelevantNavigationError("net::ERR_BLOCKED_BY_CLIENT")).toBe(false);
    expect(isRelevantNavigationError("net::ERR_CONNECTION_CLOSED")).toBe(false);
    expect(isRelevantNavigationError("net::ERR_NAME_NOT_RESOLVED")).toBe(true);
  });
});
