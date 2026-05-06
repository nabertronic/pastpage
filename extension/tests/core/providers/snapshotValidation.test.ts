import { describe, expect, it, vi } from "vitest";
import { isLikelyWorkingSnapshotHtml, selectLatestWorkingSnapshot } from "@/core/providers/snapshotValidation";

const candidate = {
  originalUrl: "https://example.com",
  matchedUrl: "https://example.com",
  archiveUrl: "https://archive.example/snapshot",
  timestamp: "20240615120000",
  statusCode: "200",
  mimeType: "text/html",
  strategy: "exact" as const,
  providerId: "archive-today" as const
};

describe("snapshotValidation", () => {
  it("accepts a normal archived page", () => {
    expect(
      isLikelyWorkingSnapshotHtml("<html><head><title>SPIEGEL Startseite</title></head><body>ok</body></html>")
    ).toBe(true);
  });

  it("rejects known archive error pages", () => {
    expect(
      isLikelyWorkingSnapshotHtml(
        "<html><body>Wayback Machine doesn't have that page archived.</body></html>"
      )
    ).toBe(false);
    expect(
      isLikelyWorkingSnapshotHtml(
        "<html><head><title>One more step</title></head><body>Please complete the security check to access archive.ph</body></html>"
      )
    ).toBe(false);
  });

  it("rejects meta refresh redirect pages", () => {
    expect(
      isLikelyWorkingSnapshotHtml(
        '<html><head><meta http-equiv="refresh" content="0;url=https://example.com"></head></html>'
      )
    ).toBe(false);
  });

  it("returns a confirmed snapshot when replay HTML looks valid", async () => {
    const result = await selectLatestWorkingSnapshot(
      [candidate],
      vi.fn().mockResolvedValue({
        ok: true,
        redirected: false,
        headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
        text: vi.fn().mockResolvedValue("<html><body>ok</body></html>")
      }) as unknown as typeof fetch
    );

    expect(result.status).toBe("confirmed");
  });

  it("returns an unverified snapshot when replay validation is blocked", async () => {
    const result = await selectLatestWorkingSnapshot(
      [candidate],
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        redirected: false,
        headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
        text: vi.fn().mockResolvedValue("<html><body>rate limited</body></html>")
      }) as unknown as typeof fetch
    );

    expect(result.status).toBe("unverified");
    if (result.status === "unverified") {
      expect(result.snapshot.verification).toBe("unverified");
    }
  });

  it("returns a miss when no candidates exist", async () => {
    const result = await selectLatestWorkingSnapshot([], vi.fn() as unknown as typeof fetch);
    expect(result).toEqual({ status: "miss" });
  });
});
