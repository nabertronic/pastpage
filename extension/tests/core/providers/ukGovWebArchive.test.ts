import { describe, expect, it, vi } from "vitest";
import { parseUkGovTimeline, ukGovWebArchiveProvider } from "@/core/providers/ukGovWebArchive";

const SAMPLE_TIMELINE = `
<a class="archivebutton" href="/ukgwa/20240101120000/https://www.gov.uk/">1</a>
<a class="archivebutton" href="/ukgwa/20240615153045/https://www.gov.uk/">15</a>
`;

describe("ukGovWebArchiveProvider", () => {
  it("selects the newest capture from the timeline", () => {
    expect(parseUkGovTimeline(SAMPLE_TIMELINE)).toEqual({
      archiveUrl: "https://webarchive.nationalarchives.gov.uk/ukgwa/20240615153045/https://www.gov.uk/",
      timestamp: "20240615153045"
    });
  });

  it("returns the newest capture as a snapshot", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(SAMPLE_TIMELINE)
      })
      .mockResolvedValueOnce({
        ok: true,
        redirected: false,
        headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
        text: vi.fn().mockResolvedValue("<html><body>ok</body></html>")
      });

    const snapshot = await ukGovWebArchiveProvider.lookup(
      { strategy: "exact", url: "https://www.gov.uk/" },
      fetchImpl as unknown as typeof fetch
    );

    expect(snapshot?.providerId).toBe("uk-gov-web-archive");
    expect(snapshot?.timestamp).toBe("20240615153045");
  });
});
