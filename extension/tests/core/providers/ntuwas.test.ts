import { describe, expect, it, vi } from "vitest";
import {
  ntuwasProvider,
  parseNtuwasTimelineCaptures
} from "@/core/providers/ntuwas";

describe("ntuwasProvider", () => {
  it("parses the public timeline response format", () => {
    expect(
      parseNtuwasTimelineCaptures(
        [
          "2024-05-17 13:58!!!https://webarchive.lib.ntu.edu.tw:443/archive/wayback/20240517055814/https://www.ntu.edu.tw/!!!",
          "2026-05-19 17:25!!!https://webarchive.lib.ntu.edu.tw:443/archive/wayback/20260519092522/https://www.ntu.edu.tw/!!!",
          "2026-07-01 11:19!!!https://webarchive.lib.ntu.edu.tw:443/archive/wayback/20260701031904/http://www.ntu.edu.tw/"
        ].join("")
      )
    ).toEqual([
      {
        archiveUrl: "https://webarchive.lib.ntu.edu.tw/archive/wayback/20260701031904/http://www.ntu.edu.tw/",
        timestamp: "20260701031904"
      },
      {
        archiveUrl: "https://webarchive.lib.ntu.edu.tw/archive/wayback/20260519092522/https://www.ntu.edu.tw/",
        timestamp: "20260519092522"
      },
      {
        archiveUrl: "https://webarchive.lib.ntu.edu.tw/archive/wayback/20240517055814/https://www.ntu.edu.tw/",
        timestamp: "20240517055814"
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
              "2024-05-17 13:58!!!https://webarchive.lib.ntu.edu.tw:443/archive/wayback/20240517055814/https://www.ntu.edu.tw/!!!",
              "2026-05-19 17:25!!!https://webarchive.lib.ntu.edu.tw:443/archive/wayback/20260519092522/https://www.ntu.edu.tw/!!!"
            ].join("")
          )
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        redirected: false,
        headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") }
      });

    const result = await ntuwasProvider.lookup(
      { strategy: "exact", url: "https://www.ntu.edu.tw/" },
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("confirmed");
    if (result.status === "confirmed") {
      expect(result.snapshot.providerId).toBe("ntuwas");
      expect(result.snapshot.timestamp).toBe("20260519092522");
      expect(result.snapshot.archiveUrl).toBe(
        "https://webarchive.lib.ntu.edu.tw/archive/wayback/20260519092522/https://www.ntu.edu.tw/"
      );
    }
  });

  it("exposes the raw timeline endpoint as the direct provider link", () => {
    expect(ntuwasProvider.buildDirectLinkUrl("https://www.president.gov.tw/")).toBe(
      "https://webarchive.lib.ntu.edu.tw/archive/wayback/*/https://www.president.gov.tw/"
    );
  });
});
