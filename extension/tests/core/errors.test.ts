import { describe, expect, it } from "vitest";
import {
  explainHttpStatus,
  explainNavigationError,
  isRelevantHttpStatus,
  isRelevantNavigationError,
  isSecurityVerificationHttpError
} from "@/core/errors";

describe("errors", () => {
  it("recognizes relevant HTTP statuses", () => {
    expect(isRelevantHttpStatus(403)).toBe(true);
    expect(isRelevantHttpStatus(404)).toBe(true);
    expect(isRelevantHttpStatus(451)).toBe(true);
    expect(isRelevantHttpStatus(200)).toBe(false);
  });

  it("recognizes Cloudflare challenge responses on any host", () => {
    expect(
      isSecurityVerificationHttpError("https://example.com/private", 403, [
        { name: "cf-mitigated", value: "challenge" }
      ])
    ).toBe(true);
    expect(
      isSecurityVerificationHttpError("https://another.example.org/", 503, [
        { name: "CF-MITIGATED", value: " Challenge " }
      ])
    ).toBe(true);
  });

  it("recognizes 403 responses from authenticator hosts as a headerless fallback", () => {
    expect(isSecurityVerificationHttpError("https://authenticator.cursor.sh/", 403)).toBe(true);
    expect(isSecurityVerificationHttpError("https://login.authenticator.example.com/check", 403)).toBe(true);
  });

  it("does not confuse regular pages with authenticator verification hosts", () => {
    expect(isSecurityVerificationHttpError("https://example.com/authenticator", 403)).toBe(false);
    expect(isSecurityVerificationHttpError("https://myauthenticator.example.com/", 403)).toBe(false);
    expect(isSecurityVerificationHttpError("https://authenticator.example.com/", 404)).toBe(false);
    expect(
      isSecurityVerificationHttpError("https://example.com/private", 403, [
        { name: "server", value: "cloudflare" }
      ])
    ).toBe(false);
    expect(
      isSecurityVerificationHttpError("https://example.com/private", 403, [
        { name: "cf-mitigated", value: "not-a-challenge" }
      ])
    ).toBe(false);
    expect(isSecurityVerificationHttpError("not a url", 403)).toBe(false);
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
