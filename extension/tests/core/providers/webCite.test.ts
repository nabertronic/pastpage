import { describe, expect, it, vi } from "vitest";
import {
  buildWebCiteCaptureUrl,
  buildWebCiteQueryUrl,
  parseWebCiteTimestamp,
  parseWebCiteTopFrame,
  webCiteProvider
} from "@/core/providers/webCite";

const SAMPLE_TOPFRAME_HTML = `
  <table class="topframe">
    <a href="abc123xyz" target="_top">Permalink&nbsp;to&nbsp;this&nbsp;cache</a>
    <select name="id">
      <option value="1206502728688682">2008-03-26 02:38:48</option>
      <option value="1464975128836103">2016-06-03 17:32:10 (failed)</option>
      <option value="1559891049114425">2019-06-07 07:04:09</option>
    </select>
  </table>
`;

describe("webCiteProvider", () => {
  it("builds query and capture URLs", () => {
    expect(buildWebCiteQueryUrl("https://example.com")).toBe(
      "https://www.webcitation.org/query?url=https%3A%2F%2Fexample.com"
    );
    expect(buildWebCiteCaptureUrl("1559891049114425")).toBe(
      "https://www.webcitation.org/query?id=1559891049114425"
    );
  });

  it("normalizes WebCite timestamps and rejects unparseable values", () => {
    expect(parseWebCiteTimestamp("2019-06-07 07:04:09")).toBe("20190607070409");
    expect(parseWebCiteTimestamp("2016-06-03 17:32:10 (failed)")).toBe("20160603173210");
    expect(parseWebCiteTimestamp("not a timestamp")).toBe("");
  });

  it("parses the topframe permalink and capture list", () => {
    expect(parseWebCiteTopFrame(SAMPLE_TOPFRAME_HTML)).toEqual({
      permalinkId: "abc123xyz",
      captures: [
        {
          captureId: "1206502728688682",
          timestamp: "20080326023848",
          failed: false
        },
        {
          captureId: "1464975128836103",
          timestamp: "20160603173210",
          failed: true
        },
        {
          captureId: "1559891049114425",
          timestamp: "20190607070409",
          failed: false
        }
      ]
    });
  });

  it("returns the newest non-failed capture as a confirmed snapshot", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/topframe.php")) {
        return {
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(SAMPLE_TOPFRAME_HTML)
        };
      }

      if (url.includes("/mainframe.php")) {
        return {
          ok: true,
          status: 200,
          headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
          text: vi.fn().mockResolvedValue("<html><head><title>Saved</title></head><body>ok</body></html>")
        };
      }

      return {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue("<html><frameset></frameset></html>")
      };
    });

    const result = await webCiteProvider.lookup(
      { strategy: "exact", url: "https://example.com" },
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("confirmed");
    if (result.status === "confirmed") {
      expect(result.snapshot.archiveUrl).toBe("https://www.webcitation.org/query?id=1559891049114425");
      expect(result.snapshot.openUrl).toBe("https://www.webcitation.org/abc123xyz");
      expect(result.snapshot.timestamp).toBe("20190607070409");
    }
  });

  it("returns a miss when WebCite reports no captures", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/topframe.php")) {
        return {
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(`
            <table class="topframe">
              <a href="" target="_top">Permalink&nbsp;to&nbsp;this&nbsp;cache</a>
              <select name="id"></select>
            </table>
          `)
        };
      }

      return {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue("<html><frameset></frameset></html>")
      };
    });

    await expect(
      webCiteProvider.lookup(
        { strategy: "exact", url: "https://example.com" },
        fetchImpl as unknown as typeof fetch
      )
    ).resolves.toEqual({ status: "miss" });
  });

  it("returns an unverified snapshot when the replay HTML looks broken", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/topframe.php")) {
        return {
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(SAMPLE_TOPFRAME_HTML)
        };
      }

      if (url.includes("/mainframe.php")) {
        return {
          ok: true,
          status: 200,
          headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
          text: vi.fn().mockResolvedValue("<html><head><title>404 Not Found</title></head><body>missing</body></html>")
        };
      }

      return {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue("<html><frameset></frameset></html>")
      };
    });

    const result = await webCiteProvider.lookup(
      { strategy: "exact", url: "https://example.com" },
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("unverified");
    if (result.status === "unverified") {
      expect(result.snapshot.archiveUrl).toBe("https://www.webcitation.org/query?id=1559891049114425");
      expect(result.snapshot.verification).toBe("unverified");
    }
  });
});
