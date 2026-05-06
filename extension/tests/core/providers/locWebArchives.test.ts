import { describe, expect, it, vi } from "vitest";
import { locWebArchivesProvider, parseLocTimeline } from "@/core/providers/locWebArchives";

const SAMPLE_LOC_TIMELINE = `
<a href="/all/20230101101010/https://www.loc.gov/">Older</a>
<a href="/all/20240704120000/https://www.loc.gov/">Newest</a>
`;

describe("locWebArchivesProvider", () => {
  it("selects the newest capture from the LOC timeline", () => {
    expect(parseLocTimeline(SAMPLE_LOC_TIMELINE)).toEqual({
      archiveUrl: "https://webarchive.loc.gov/all/20240704120000/https://www.loc.gov/",
      timestamp: "20240704120000"
    });
  });

  it("returns the newest capture as a snapshot", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(SAMPLE_LOC_TIMELINE)
      })
      .mockResolvedValueOnce({
        ok: true,
        redirected: false,
        headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
        text: vi.fn().mockResolvedValue("<html><body>ok</body></html>")
      });

    const result = await locWebArchivesProvider.lookup(
      { strategy: "exact", url: "https://www.loc.gov/" },
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("confirmed");
    if (result.status === "confirmed") {
      expect(result.snapshot.providerId).toBe("loc-web-archives");
      expect(result.snapshot.archiveUrl).toContain("/all/20240704120000/");
    }
  });
});
