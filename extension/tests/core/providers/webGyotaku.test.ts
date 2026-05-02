import { describe, expect, it, vi } from "vitest";
import { parseWebGyotakuResults, webGyotakuProvider } from "@/core/providers/webGyotaku";

const SAMPLE_GYOTAKU_HTML = `
<a href="https://megalodon.jp/2024-0615-1200-00/https://example.co.jp/">2024年6月15日</a>
<a href="https://megalodon.jp/2023-0101-0900-00/https://example.co.jp/">2023年1月1日</a>
`;

describe("webGyotakuProvider", () => {
  it("parses the newest saved capture", () => {
    expect(parseWebGyotakuResults(SAMPLE_GYOTAKU_HTML)).toEqual({
      archiveUrl: "https://megalodon.jp/2024-0615-1200-00/https://example.co.jp/",
      timestamp: "20240615120000"
    });
  });

  it("returns the newest capture as a snapshot", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(SAMPLE_GYOTAKU_HTML)
      })
      .mockResolvedValueOnce({
        ok: true,
        redirected: false,
        headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
        text: vi.fn().mockResolvedValue("<html><body>ok</body></html>")
      });

    const snapshot = await webGyotakuProvider.lookup(
      { strategy: "exact", url: "https://example.co.jp/" },
      fetchImpl as unknown as typeof fetch
    );

    expect(snapshot?.providerId).toBe("web-gyotaku");
    expect(snapshot?.archiveUrl).toContain("2024-0615-1200-00");
  });
});
