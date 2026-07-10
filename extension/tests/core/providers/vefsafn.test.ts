import { describe, expect, it, vi } from "vitest";
import {
  buildPywbCdxQueryUrl,
  parsePywbCdxResponse
} from "@/core/providers/pywbCdx";
import { vefsafnProvider } from "@/core/providers/vefsafn";

describe("vefsafnProvider", () => {
  it("builds the documented CDX query", () => {
    const url = buildPywbCdxQueryUrl("https://vefsafn.is", "https://www.stjornarradid.is/");
    expect(url).toContain("/cdx?");
    expect(url).toContain("output=json");
    expect(url).toContain("url=https%3A%2F%2Fwww.stjornarradid.is%2F");
  });

  it("parses newline-delimited CDX JSON objects", () => {
    expect(
      parsePywbCdxResponse(
        [
          '{"timestamp":"20240615120000","url":"https://www.stjornarradid.is/","status":"200","mime":"text/html"}',
          '{"timestamp":"20250610100015","url":"https://www.stjornarradid.is/","status":"200","mime":"text/html"}'
        ].join("\n")
      )
    ).toEqual([
      {
        timestamp: "20240615120000",
        originalUrl: "https://www.stjornarradid.is/",
        statusCode: "200",
        mimeType: "text/html"
      },
      {
        timestamp: "20250610100015",
        originalUrl: "https://www.stjornarradid.is/",
        statusCode: "200",
        mimeType: "text/html"
      }
    ]);
  });

  it("returns the newest capture as a snapshot", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi
          .fn()
          .mockResolvedValue(
            [
              '{"timestamp":"20240615120000","url":"https://www.stjornarradid.is/","status":"200","mime":"text/html"}',
              '{"timestamp":"20250610100015","url":"https://www.stjornarradid.is/","status":"200","mime":"text/html"}'
            ].join("\n")
          )
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        redirected: false,
        headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") }
      });

    const result = await vefsafnProvider.lookup(
      { strategy: "exact", url: "https://www.stjornarradid.is/" },
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("confirmed");
    if (result.status === "confirmed") {
      expect(result.snapshot.providerId).toBe("vefsafn");
      expect(result.snapshot.timestamp).toBe("20250610100015");
      expect(result.snapshot.archiveUrl).toBe(
        "https://vefsafn.is/20250610100015/https://www.stjornarradid.is/"
      );
    }
  });
});
