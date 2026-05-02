import { describe, expect, it, vi } from "vitest";
import {
  buildCdxUrl,
  lookupWayback,
  lookupWaybackCaptureCount,
  parseCdxResponse,
  selectLatestSnapshot
} from "@/core/wayback";

describe("wayback", () => {
  it("builds a CDX JSON URL", () => {
    const url = buildCdxUrl("https://example.com");
    expect(url).toContain("output=json");
    expect(url).toContain("limit=-20");
  });

  it("parses and selects latest 200 HTML captures", () => {
    const snapshots = parseCdxResponse(
      [
        {
          timestamp: "20200101000000",
          original: "https://example.com",
          mimetype: "text/html",
          statuscode: "200"
        },
        {
          timestamp: "20230101000000",
          original: "https://example.com",
          mimetype: "text/html",
          statuscode: "200"
        },
        {
          timestamp: "20240101000000",
          original: "https://example.com",
          mimetype: "image/png",
          statuscode: "200"
        }
      ],
      "exact"
    );

    expect(selectLatestSnapshot(snapshots)?.timestamp).toBe("20230101000000");
  });

  it("does not call the provider for ineligible URLs", async () => {
    const fetchImpl = vi.fn();
    const result = await lookupWayback("http://localhost:3000", "exact-then-cleaned", fetchImpl as unknown as typeof fetch);
    expect(result.status).toBe("not-eligible");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns a found result from a mocked CDX response", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([
          ["timestamp", "original", "mimetype", "statuscode", "digest", "length"],
          ["20230101000000", "https://example.com", "text/html", "200", "abc", "100"]
        ])
      })
      .mockResolvedValueOnce({
        ok: true,
        redirected: false,
        headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
        text: vi.fn().mockResolvedValue("<html><body>ok</body></html>")
      });

    const result = await lookupWayback("https://example.com", "exact-then-cleaned", fetchImpl as unknown as typeof fetch);

    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.snapshot.archiveUrl).toContain("web.archive.org/web/20230101000000id_");
      expect(result.snapshot.openUrl).toContain("web.archive.org/web/20230101000000/");
    }
  });

  it("reports actual lookup progress for each checked candidate", async () => {
    const steps: string[] = [];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([["timestamp", "original", "mimetype", "statuscode", "digest", "length"]])
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([
          ["timestamp", "original", "mimetype", "statuscode", "digest", "length"],
          ["20240101000000", "https://example.com/story", "text/html", "200", "abc", "100"]
        ])
      })
      .mockResolvedValueOnce({
        ok: true,
        redirected: false,
        headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
        text: vi.fn().mockResolvedValue("<html><body>ok</body></html>")
      });

    await lookupWayback(
      "https://example.com/story?utm_source=x",
      "exact-then-cleaned",
      fetchImpl as unknown as typeof fetch,
      (step) => steps.push(step.strategy)
    );

    expect(steps).toEqual(["exact", "cleaned"]);
  });

  it("counts working captures and falls back to cleaned URLs only after an exact zero", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([["timestamp"]])
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([["timestamp"], ["20240101000000"], ["20240202000000"]])
      });

    const result = await lookupWaybackCaptureCount(
      "https://example.com/story?utm_source=x",
      "exact-then-cleaned",
      fetchImpl as unknown as typeof fetch
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      status: "counted",
      count: 2,
      strategy: "cleaned",
      checked: [
        { strategy: "exact", url: "https://example.com/story?utm_source=x" },
        { strategy: "cleaned", url: "https://example.com/story" }
      ]
    });
  });

  it("stops after the exact URL when a count is found there", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([["timestamp"], ["20240101000000"]])
    });

    const result = await lookupWaybackCaptureCount(
      "https://example.com/story?utm_source=x",
      "exact-then-cleaned",
      fetchImpl as unknown as typeof fetch
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: "counted",
      count: 1,
      strategy: "exact",
      checked: [{ strategy: "exact", url: "https://example.com/story?utm_source=x" }]
    });
  });
});
