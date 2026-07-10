import { describe, expect, it, vi } from "vitest";
import {
  canadaGovWebArchiveProvider,
  parseCanadaGovSparkline
} from "@/core/providers/canadaGovWebArchive";

const SAMPLE_SPARKLINE = JSON.stringify({
  years: { "2026": [1, 2, 3] },
  first_ts: "20240101010101",
  last_ts: "20260615185905"
});

describe("canadaGovWebArchiveProvider", () => {
  it("extracts the newest capture from the sparkline response", () => {
    expect(parseCanadaGovSparkline(SAMPLE_SPARKLINE, "https://www.pm.gc.ca/")).toEqual({
      archiveUrl: "https://webarchiveweb.wayback.bac-lac.canada.ca/web/20260615185905/https://www.pm.gc.ca/",
      timestamp: "20260615185905"
    });
  });

  it("returns the newest capture as a snapshot", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(SAMPLE_SPARKLINE)
      })
      .mockResolvedValueOnce({
        ok: true,
        redirected: false,
        headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
        text: vi.fn().mockResolvedValue("<html><body>ok</body></html>")
      });

    const result = await canadaGovWebArchiveProvider.lookup(
      { strategy: "exact", url: "https://www.pm.gc.ca/" },
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("confirmed");
    if (result.status === "confirmed") {
      expect(result.snapshot.providerId).toBe("canada-gov-web-archive");
      expect(result.snapshot.timestamp).toBe("20260615185905");
    }
  });

  it("surfaces Archive-It query challenges as challenge-required errors", async () => {
    await expect(
      canadaGovWebArchiveProvider.lookup(
        { strategy: "exact", url: "https://www.pm.gc.ca/" },
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(`
            <html>
              <title>Session Verification</title>
              <form action="https://archive-it.org/_challenge"></form>
            </html>
          `)
        }) as unknown as typeof fetch
      )
    ).rejects.toMatchObject({ reason: "challenge-required" });
  });
});
