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

describe("archiveTodayProvider", () => {
  it("parses the link-format timemap and returns mementos sorted newest-first", () => {
    const mementos = parseArchiveTodayTimemap(SAMPLE_TIMEMAP);
    expect(mementos.map((m) => m.url)).toEqual([
      "https://archive.ph/20240615120000/https://example.com",
      "https://archive.ph/20240101000000/https://example.com",
      "https://archive.ph/20200101000000/https://example.com"
    ]);
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

    const snapshot = await archiveTodayProvider.lookup(
      { strategy: "exact", url: "https://example.com" },
      fetchImpl as unknown as typeof fetch
    );

    expect(snapshot).not.toBeNull();
    expect(snapshot?.providerId).toBe("archive-today");
    expect(snapshot?.archiveUrl).toBe("https://archive.ph/20240615120000/https://example.com");
  });

  it("returns null when the timemap is missing (404)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const snapshot = await archiveTodayProvider.lookup(
      { strategy: "exact", url: "https://example.com" },
      fetchImpl as unknown as typeof fetch
    );
    expect(snapshot).toBeNull();
  });

  it("throws on other non-OK responses (so the resolver can offer a direct link)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    await expect(
      archiveTodayProvider.lookup(
        { strategy: "exact", url: "https://example.com" },
        fetchImpl as unknown as typeof fetch
      )
    ).rejects.toThrow(/429/);
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
