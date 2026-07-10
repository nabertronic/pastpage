import { describe, expect, it } from "vitest";
import { buildSearchCandidates, cleanUrl, getUrlEligibility } from "@/core/urlPolicy";

describe("urlPolicy", () => {
  it("excludes local, private, internal, and archive URLs", () => {
    expect(getUrlEligibility("http://localhost:3000").eligible).toBe(false);
    expect(getUrlEligibility("http://192.168.1.5/page").eligible).toBe(false);
    expect(getUrlEligibility("http://[::1]/").eligible).toBe(false);
    expect(getUrlEligibility("http://[fc00::1]/").eligible).toBe(false);
    expect(getUrlEligibility("http://[fd00::1]/").eligible).toBe(false);
    expect(getUrlEligibility("http://[fe80::1]/").eligible).toBe(false);
    expect(getUrlEligibility("file:///tmp/test.html").eligible).toBe(false);
    expect(getUrlEligibility("https://web.archive.org/web/20200101000000/https://example.com").eligible).toBe(false);
  });

  it("does not treat domains starting with fc/fd as private IPv6 ULAs", () => {
    expect(getUrlEligibility("https://fda.gov/news").eligible).toBe(true);
    expect(getUrlEligibility("https://fdic.gov/").eligible).toBe(true);
    expect(getUrlEligibility("https://fcc.gov/").eligible).toBe(true);
    expect(getUrlEligibility("https://fd.io/").eligible).toBe(true);
    expect(getUrlEligibility("https://feedly.com/").eligible).toBe(true);
  });

  it("keeps content parameters but removes known tracking parameters", () => {
    const cleaned = cleanUrl("https://example.com/story?id=12&utm_source=x&fbclid=y&q=test#section");
    expect(cleaned).toContain("id=12");
    expect(cleaned).toContain("q=test");
    expect(cleaned).not.toContain("utm_source");
    expect(cleaned).not.toContain("fbclid");
    expect(cleaned).not.toContain("#section");
  });

  it("removes common sensitive parameters only from the cleaned variant", () => {
    const rawUrl =
      "https://example.com/reset?id=12&token=abc123&code=oauth-code&state=xyz&q=test";
    const cleaned = cleanUrl(rawUrl);
    const candidates = buildSearchCandidates(rawUrl, "exact-then-cleaned");

    expect(cleaned).toContain("id=12");
    expect(cleaned).toContain("q=test");
    expect(cleaned).not.toContain("token=");
    expect(cleaned).not.toContain("code=");
    expect(cleaned).not.toContain("state=");

    expect(candidates).toEqual([
      { strategy: "exact", url: rawUrl },
      { strategy: "cleaned", url: "https://example.com/reset?id=12&q=test" },
      { strategy: "cleaned", url: "https://example.com/reset" }
    ]);
  });

  it("builds exact-then-cleaned candidates by default", () => {
    expect(
      buildSearchCandidates("https://example.com/a?id=1&utm_campaign=x", "exact-then-cleaned").map(
        (candidate) => candidate.strategy
      )
    ).toEqual(["exact", "cleaned", "cleaned"]);
  });

  it("falls back to a fully query-free cleaned URL when unknown parameters remain", () => {
    expect(
      buildSearchCandidates(
        "https://example.com/story?id=12&custom_ref=chatgpt.com&keep=content",
        "exact-then-cleaned"
      )
    ).toEqual([
      {
        strategy: "exact",
        url: "https://example.com/story?id=12&custom_ref=chatgpt.com&keep=content"
      },
      {
        strategy: "cleaned",
        url: "https://example.com/story"
      }
    ]);
  });

  it("deduplicates cleaned candidates when known tracking params are the only query", () => {
    expect(
      buildSearchCandidates(
        "https://jungefreiheit.de/politik/2026/prozessstart-saechsische-separatisten-wer-sind-die-terroristen/?utm_source=chatgpt.com",
        "exact-then-cleaned"
      )
    ).toEqual([
      {
        strategy: "exact",
        url: "https://jungefreiheit.de/politik/2026/prozessstart-saechsische-separatisten-wer-sind-die-terroristen/?utm_source=chatgpt.com"
      },
      {
        strategy: "cleaned",
        url: "https://jungefreiheit.de/politik/2026/prozessstart-saechsische-separatisten-wer-sind-die-terroristen/"
      }
    ]);
  });
});
