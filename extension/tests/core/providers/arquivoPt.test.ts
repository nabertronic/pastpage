import { describe, expect, it, vi } from "vitest";
import {
  arquivoPtProvider,
  buildArquivoPtUrlSearchUrl,
  pickArquivoPtLatest
} from "@/core/providers/arquivoPt";

describe("arquivoPtProvider", () => {
  it("builds the documented URL-search request", () => {
    const url = buildArquivoPtUrlSearchUrl("https://example.pt/");
    expect(url).toContain("opensearch?");
    expect(url).toContain("waybackQuery=true");
    expect(url).toContain("exacturlexpand%3Ahttps%3A%2F%2Fexample.pt%2F");
  });

  it("picks the newest entry from the API response", () => {
    expect(
      pickArquivoPtLatest({
        items: [
          {
            tstamp: "20200101000000",
            linkToArchive: "https://arquivo.pt/wayback/20200101000000/https://example.pt/",
            originalURL: "https://example.pt/"
          },
          {
            tstamp: "20240615120000",
            linkToNoFrame: "https://arquivo.pt/noFrame/replay/20240615120000/https://example.pt/",
            originalURL: "https://example.pt/"
          }
        ]
      })
    ).toEqual({
      archiveUrl: "https://arquivo.pt/noFrame/replay/20240615120000/https://example.pt/",
      originalUrl: "https://example.pt/",
      timestamp: "20240615120000"
    });
  });

  it("returns the newest capture as a snapshot", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          items: [
            {
              tstamp: "20240615120000",
              linkToArchive: "https://arquivo.pt/wayback/20240615120000/https://example.pt/",
              originalURL: "https://example.pt/"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        redirected: false,
        headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
        text: vi.fn().mockResolvedValue("<html><body>ok</body></html>")
      });

    const result = await arquivoPtProvider.lookup(
      { strategy: "exact", url: "https://example.pt/" },
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("confirmed");
    if (result.status === "confirmed") {
      expect(result.snapshot.providerId).toBe("arquivo-pt");
      expect(result.snapshot.timestamp).toBe("20240615120000");
    }
  });
});
