import { describe, expect, it, vi } from "vitest";
import { ghostarchiveProvider, parseGhostarchiveSearch } from "@/core/providers/ghostarchive";

const SAMPLE_GHOSTARCHIVE_HTML = `
<table>
  <tr><td><img src="/img2/a.png"></td><td><a href="/archive/old1">https://example.com/</a></td><td>Mon, 01 Jan 2024 00:00:00 GMT</td><td>Archived webpage</td></tr>
  <tr><td><img src="/img2/b.png"></td><td><a href="/archive/new1">https://example.com/</a></td><td>Sat, 15 Jun 2024 12:00:00 GMT</td><td>Archived webpage</td></tr>
  <tr><td><img src="/img2/c.png"></td><td><a href="/archive/other">https://other.example/</a></td><td>Sun, 16 Jun 2024 12:00:00 GMT</td><td>Archived webpage</td></tr>
</table>
`;

describe("ghostarchiveProvider", () => {
  it("parses the newest exact-URL archived webpage result", () => {
    expect(parseGhostarchiveSearch(SAMPLE_GHOSTARCHIVE_HTML, "https://example.com")).toEqual({
      archiveUrl: "https://ghostarchive.org/archive/new1",
      originalUrl: "https://example.com/",
      timestamp: "20240615120000"
    });
  });

  it("returns the newest result as a snapshot", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(SAMPLE_GHOSTARCHIVE_HTML)
      })
      .mockResolvedValueOnce({
        ok: true,
        redirected: false,
        headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
        text: vi.fn().mockResolvedValue("<html><body>ok</body></html>")
      });

    const result = await ghostarchiveProvider.lookup(
      { strategy: "exact", url: "https://example.com" },
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("confirmed");
    if (result.status === "confirmed") {
      expect(result.snapshot.providerId).toBe("ghostarchive");
      expect(result.snapshot.archiveUrl).toBe("https://ghostarchive.org/archive/new1");
    }
  });
});
