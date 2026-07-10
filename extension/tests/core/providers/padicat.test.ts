import { describe, expect, it, vi } from "vitest";
import { parsePywbCdxResponse } from "@/core/providers/pywbCdx";
import { padicatProvider } from "@/core/providers/padicat";

describe("padicatProvider", () => {
  it("parses public PADICAT CDX rows", () => {
    expect(
      parsePywbCdxResponse(
        [
          '{"timestamp":"20250522082159","url":"https://www.gencat.cat/","status":"200","mime":"text/html"}',
          '{"timestamp":"20260523091915","url":"https://www.gencat.cat/","status":"200","mime":"text/html"}'
        ].join("\n")
      )
    ).toHaveLength(2);
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
              '{"timestamp":"20250522082159","url":"https://www.gencat.cat/","status":"200","mime":"text/html"}',
              '{"timestamp":"20260523091915","url":"https://www.gencat.cat/","status":"200","mime":"text/html"}'
            ].join("\n")
          )
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        redirected: false,
        headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") }
      });

    const result = await padicatProvider.lookup(
      { strategy: "exact", url: "https://www.gencat.cat/" },
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("confirmed");
    if (result.status === "confirmed") {
      expect(result.snapshot.providerId).toBe("padicat");
      expect(result.snapshot.timestamp).toBe("20260523091915");
      expect(result.snapshot.archiveUrl).toBe(
        "https://wayback.padicat.cat/20260523091915/https://www.gencat.cat/"
      );
    }
  });
});
