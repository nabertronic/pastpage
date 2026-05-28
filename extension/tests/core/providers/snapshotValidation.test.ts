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
    expect(
      isLikelyWorkingSnapshotHtml(
        "<html><head><title>archive.md</title></head><body>Please wait while we verify that you are not a robot.</body></html>"
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

  it("accepts an equivalent http-to-https redirect for the same archive resource", async () => {
    const result = await selectLatestWorkingSnapshot(
      [
        {
          ...candidate,
          archiveUrl: "http://archive.md/20240615120000/https://example.com"
        }
      ],
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        redirected: true,
        url: "https://archive.md/20240615120000/https://example.com",
        headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
        text: vi.fn().mockResolvedValue("<html><body>ok</body></html>")
      }) as unknown as typeof fetch
    );

    expect(result.status).toBe("confirmed");
  });

  it("rejects redirects to a different archive resource", async () => {
    const result = await selectLatestWorkingSnapshot(
      [candidate],
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        redirected: true,
        url: "https://archive.example/other-snapshot",
        headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
        text: vi.fn().mockResolvedValue("<html><body>ok</body></html>")
      }) as unknown as typeof fetch
    );

    expect(result.status).toBe("unverified");
  });

  it("surfaces the newest candidate as unverified before replay verification finishes", async () => {
    let resolveValidation: (value: unknown) => void = () => {};
    const delayedValidation = new Promise((resolve) => {
      resolveValidation = resolve;
    });
    const surfacedSnapshots: Array<"confirmed" | "unverified"> = [];

    const validationPromise = selectLatestWorkingSnapshot(
      [candidate],
      vi.fn().mockImplementation(() => delayedValidation) as unknown as typeof fetch,
      1,
      undefined,
      (snapshot) => surfacedSnapshots.push(snapshot.verification)
    );

    expect(surfacedSnapshots).toEqual(["unverified"]);

    resolveValidation({
      ok: true,
      redirected: false,
      headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
      text: vi.fn().mockResolvedValue("<html><body>ok</body></html>")
    });

    const result = await validationPromise;
    expect(result.status).toBe("confirmed");
  });

  it("returns a miss when no candidates exist", async () => {
    const result = await selectLatestWorkingSnapshot([], vi.fn() as unknown as typeof fetch);
    expect(result).toEqual({ status: "miss" });
  });
});
