import { describe, expect, it, vi } from "vitest";
import {
  archiveTodayProvider,
  parseArchiveTodayTimemap
} from "@/core/providers/archiveToday";

const SAMPLE_TIMEMAP = `<https://archive.ph/timemap/https://example.com>; rel="self"; type="application/link-format",
<https://archive.ph/https://example.com>; rel="timegate",
<https://archive.ph/20200101000000/https://example.com>; rel="first memento"; datetime="Wed, 01 Jan 2020 00:00:00 GMT",
<https://archive.ph/20240615120000/https://example.com>; rel="memento"; datetime="Sat, 15 Jun 2024 12:00:00 GMT",
<https://archive.ph/20240101000000/https://example.com>; rel="last memento"; datetime="Mon, 01 Jan 2024 00:00:00 GMT"`;

const FUTURE_TIMEMAP = `<https://archive.ph/timemap/https://example.com>; rel="self"; type="application/link-format",
<https://archive.ph/https://example.com>; rel="timegate",
<https://archive.ph/20351231145959/https://example.com>; rel="last memento"; datetime="Mon, 31 Dec 2035 14:59:59 GMT"`;

const MIXED_TIMEMAP = `${SAMPLE_TIMEMAP},
<https://archive.ph/20351231145959/https://example.com>; rel="memento"; datetime="Mon, 31 Dec 2035 14:59:59 GMT"`;

describe("archiveTodayProvider", () => {
  it("parses the link-format timemap, filters future mementos, and returns mementos sorted newest-first", () => {
    const mementos = parseArchiveTodayTimemap(MIXED_TIMEMAP, new Date("2026-05-27T00:00:00Z"));
    expect(mementos.map((m) => m.url)).toEqual([
      "https://archive.ph/20240615120000/https://example.com",
      "https://archive.ph/20240101000000/https://example.com",
      "https://archive.ph/20200101000000/https://example.com"
    ]);
  });

  it("drops all-future mementos", () => {
    const mementos = parseArchiveTodayTimemap(FUTURE_TIMEMAP, new Date("2026-05-27T00:00:00Z"));
    expect(mementos).toEqual([]);
  });

  it("returns the latest memento as a snapshot", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(SAMPLE_TIMEMAP)
      })
      .mockResolvedValueOnce({
        ok: true,
        redirected: false,
        headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
        text: vi.fn().mockResolvedValue("<html><body>ok</body></html>")
      });

    const result = await archiveTodayProvider.lookup(
      { strategy: "exact", url: "https://example.com" },
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("confirmed");
    if (result.status === "confirmed") {
      expect(result.snapshot.providerId).toBe("archive-today");
      expect(result.snapshot.archiveUrl).toBe("https://archive.ph/20240615120000/https://example.com");
      expect(result.snapshot.verification).toBe("confirmed");
    }
  });

  it("returns a miss when the timemap is missing (404)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const result = await archiveTodayProvider.lookup(
      { strategy: "exact", url: "https://example.com" },
      fetchImpl as unknown as typeof fetch
    );
    expect(result).toEqual({ status: "miss" });
  });

  it("returns a miss when the timemap only contains future mementos", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(FUTURE_TIMEMAP)
    });

    const result = await archiveTodayProvider.lookup(
      { strategy: "exact", url: "https://example.com" },
      fetchImpl as unknown as typeof fetch
    );

    expect(result).toEqual({ status: "miss" });
  });

  it("returns an unverified snapshot when the provider reports a memento but replay validation is blocked", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(SAMPLE_TIMEMAP)
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        redirected: false,
        headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
        text: vi.fn().mockResolvedValue("<html><body>rate limited</body></html>")
      });

    const result = await archiveTodayProvider.lookup(
      { strategy: "exact", url: "https://example.com" },
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("unverified");
    if (result.status === "unverified") {
      expect(result.snapshot.archiveUrl).toBe("https://archive.ph/20240615120000/https://example.com");
      expect(result.snapshot.verification).toBe("unverified");
    }
  });

  it("accepts an equivalent http-to-https replay redirect for the same archive snapshot", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(SAMPLE_TIMEMAP)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        redirected: true,
        url: "https://archive.ph/20240615120000/https://example.com",
        headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
        text: vi.fn().mockResolvedValue("<html><body>ok</body></html>")
      });

    const result = await archiveTodayProvider.lookup(
      { strategy: "exact", url: "https://example.com" },
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("confirmed");
  });

  it("throws a manual-challenge error on 429 responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    await expect(
      archiveTodayProvider.lookup(
        { strategy: "exact", url: "https://example.com" },
        fetchImpl as unknown as typeof fetch
      )
    ).rejects.toThrow(/manual challenge step/i);
  });

  it("throws a manual-challenge error when a timemap response contains a challenge page", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi
        .fn()
        .mockResolvedValue("<html><head><title>archive.md</title></head><body>Please wait while we verify that you are not a robot.</body></html>")
    });

    const { ProviderLookupError } = await import("@/core/providers/types");
    await expect(
      archiveTodayProvider.lookup(
        { strategy: "exact", url: "https://example.com" },
        fetchImpl as unknown as typeof fetch
      )
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ProviderLookupError && error.reason === "challenge-required"
    );
  });

  it("does not treat a valid timemap as a challenge page just because it mentions archive hosts", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(SAMPLE_TIMEMAP)
      })
      .mockResolvedValueOnce({
        ok: true,
        redirected: false,
        headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
        text: vi.fn().mockResolvedValue("<html><body>ok</body></html>")
      });

    const result = await archiveTodayProvider.lookup(
      { strategy: "exact", url: "https://example.com" },
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("confirmed");
  });

  it("throws a server-error on 503 responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const { ProviderLookupError } = await import("@/core/providers/types");
    await expect(
      archiveTodayProvider.lookup(
        { strategy: "exact", url: "https://example.com" },
        fetchImpl as unknown as typeof fetch
      )
    ).rejects.toSatisfy((e: unknown) => e instanceof ProviderLookupError && (e as any).reason === "server-error");
  });

  it("builds a direct link to the newest snapshot", () => {
    expect(archiveTodayProvider.buildDirectLinkUrl("https://example.com")).toBe(
      "https://archive.ph/newest/https://example.com"
    );
  });

  it("uses the configured Archive.today host for direct links and lookups", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 404
    });

    await archiveTodayProvider.lookup(
      { strategy: "exact", url: "https://example.com" },
      fetchImpl as unknown as typeof fetch,
      { waybackHost: "web.archive.org", archiveTodayHost: "archive.today" }
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://archive.today/timemap/https://example.com",
      expect.any(Object)
    );
    expect(
      archiveTodayProvider.buildDirectLinkUrl("https://example.com", {
        waybackHost: "web.archive.org",
        archiveTodayHost: "archive.today"
      })
    ).toBe("https://archive.today/newest/https://example.com");
  });
});
