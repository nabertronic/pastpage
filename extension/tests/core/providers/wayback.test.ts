import { describe, expect, it, vi } from "vitest";
import {
  buildCaptureCountCdxUrl,
  buildCdxUrl,
  parseCaptureCountResponse,
  parseCdxResponse,
  selectLatestSnapshot,
  waybackProvider
} from "@/core/providers/wayback";

function workingSnapshotResponse() {
  return {
    ok: true,
    redirected: false,
    headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
    text: vi.fn().mockResolvedValue("<html><head><title>SPIEGEL</title></head><body>ok</body></html>")
  };
}

describe("waybackProvider", () => {
  it("builds a CDX JSON URL", () => {
    const url = buildCdxUrl("https://example.com");
    expect(url).toContain("output=json");
    expect(url).toContain("limit=-20");
    expect(url).toContain("fastLatest=true");
    expect(url).toContain("filter=mimetype%3Atext%2Fhtml.*");
  });

  it("builds a capture-count CDX URL", () => {
    const url = buildCaptureCountCdxUrl("https://example.com");
    expect(url).toContain("output=json");
    expect(url).toContain("collapse=digest");
    expect(url).toContain("filter=statuscode%3A200");
    expect(url).toContain("filter=mimetype%3Atext%2Fhtml.*");
  });

  it("parses CDX rows and tags them with the wayback provider id", () => {
    const snapshots = parseCdxResponse(
      [
        {
          timestamp: "20230101000000",
          original: "https://example.com",
          mimetype: "text/html",
          statuscode: "200"
        }
      ],
      "exact"
    );

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].providerId).toBe("wayback");
    expect(snapshots[0].archiveUrl).toContain("web.archive.org/web/20230101000000id_");
    expect(snapshots[0].openUrl).toContain("web.archive.org/web/20230101000000/");
  });

  it("selects the latest snapshot by timestamp", () => {
    const snapshots = parseCdxResponse(
      [
        { timestamp: "20200101000000", original: "u", mimetype: "text/html", statuscode: "200" },
        { timestamp: "20230101000000", original: "u", mimetype: "text/html", statuscode: "200" }
      ],
      "exact"
    );
    expect(selectLatestSnapshot(snapshots)?.timestamp).toBe("20230101000000");
  });

  it("returns null when no rows are returned", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([
        ["timestamp", "original", "mimetype", "statuscode", "digest", "length"]
      ])
    });

    const result = await waybackProvider.lookup(
      { strategy: "exact", url: "https://example.com" },
      fetchImpl as unknown as typeof fetch
    );

    expect(result).toBeNull();
  });

  it("falls back to the next-most-recent working snapshot when the newest one is an archive error page", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([
          ["timestamp", "original", "mimetype", "statuscode", "digest", "length"],
          ["20260101000000", "https://example.com", "text/html", "200", "new", "100"],
          ["20250101000000", "https://example.com", "text/html", "200", "old", "100"]
        ])
      })
      .mockResolvedValueOnce({
        ok: true,
        redirected: false,
        headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
        text: vi
          .fn()
          .mockResolvedValue("<html><body>Wayback Machine doesn't have that page archived.</body></html>")
      })
      .mockResolvedValueOnce(workingSnapshotResponse());

    const snapshot = await waybackProvider.lookup(
      { strategy: "exact", url: "https://example.com" },
      fetchImpl as unknown as typeof fetch
    );

    expect(snapshot?.timestamp).toBe("20250101000000");
  });

  it("counts returned capture rows exactly", () => {
    expect(
      parseCaptureCountResponse([
        ["timestamp"],
        ["20210101000000"],
        ["20220101000000"],
        ["20230101000000"]
      ])
    ).toBe(3);
  });

  it("returns zero captures when only the header row is returned", () => {
    expect(parseCaptureCountResponse([["timestamp"]])).toBe(0);
  });

  it("counts deduplicated HTML captures from the count endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([["timestamp"], ["20210101000000"], ["20230101000000"]])
    });

    const result = await waybackProvider.lookupCaptureCount(
      { strategy: "exact", url: "https://example.com" },
      fetchImpl as unknown as typeof fetch
    );

    expect(result).toBe(2);
  });

  it("throws on non-OK responses so the lookup can mark the provider as errored", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(
      waybackProvider.lookup(
        { strategy: "exact", url: "https://example.com" },
        fetchImpl as unknown as typeof fetch
      )
    ).rejects.toThrow(/503/);
  });

  it("exposes the calendar URL as the direct link", () => {
    expect(waybackProvider.buildDirectLinkUrl("https://example.com")).toBe(
      "https://web.archive.org/web/*/https://example.com"
    );
  });

  it("uses the configured Wayback host for direct links and lookups", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([["timestamp"]])
    });

    await waybackProvider.lookup(
      { strategy: "exact", url: "https://example.com" },
      fetchImpl as unknown as typeof fetch,
      {
        waybackHost: "web.archivep75mbjunhxc6x4j5mwjmomyxb573v42baldlqu56ruil2oiad.onion",
        archiveTodayHost: "archive.today"
      }
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining(
        "https://web.archivep75mbjunhxc6x4j5mwjmomyxb573v42baldlqu56ruil2oiad.onion/cdx?"
      ),
      expect.any(Object)
    );
    expect(
      waybackProvider.buildDirectLinkUrl("https://example.com", {
        waybackHost: "web.archivep75mbjunhxc6x4j5mwjmomyxb573v42baldlqu56ruil2oiad.onion",
        archiveTodayHost: "archive.today"
      })
    ).toBe(
      "https://web.archivep75mbjunhxc6x4j5mwjmomyxb573v42baldlqu56ruil2oiad.onion/web/*/https://example.com"
    );
  });
});
