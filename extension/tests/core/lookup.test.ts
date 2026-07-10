import { describe, expect, it, vi } from "vitest";
import { lookupArchives } from "@/core/lookup";

const WEB_CITE_FRAMESET_HTML = `
  <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Frameset//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-frameset.dtd">
  <html>
    <head><title>WebCite query result</title></head>
    <frameset rows="60,*" frameborder="0">
      <frame src="./topframe.php" name="nav" />
      <frame src="./mainframe.php" name="main" />
    </frameset>
  </html>
`;
import type { LookupProgressStep } from "@/core/lookup";

function emptyWaybackResponse() {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue([
      ["timestamp", "original", "mimetype", "statuscode", "digest", "length"]
    ])
  };
}

function waybackHit(timestamp = "20240101000000") {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue([
      ["timestamp", "original", "mimetype", "statuscode", "digest", "length"],
      [timestamp, "https://example.com", "text/html", "200", "abc", "100"]
    ])
  };
}

function archiveHtmlResponse(title = "Archived page") {
  return {
    ok: true,
    status: 200,
    redirected: false,
    url: "https://example.com/archive",
    headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
    text: vi.fn().mockResolvedValue(`<html><head><title>${title}</title></head><body>ok</body></html>`)
  };
}

function emptyArchiveTodayResponse() {
  return { ok: true, status: 200, text: vi.fn().mockResolvedValue("") };
}

function emptyGhostarchiveResponse() {
  return {
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue("<html><body><h2>No archives</h2></body></html>")
  };
}

function emptyPermaCcResponse() {
  return { ok: true, status: 200, json: vi.fn().mockResolvedValue({ objects: [] }) };
}

function emptyArquivoPtResponse() {
  return { ok: true, status: 200, json: vi.fn().mockResolvedValue({ items: [] }) };
}

function emptyWebGyotakuResponse() {
  return { ok: true, status: 200, text: vi.fn().mockResolvedValue("<html><body>none</body></html>") };
}

function emptySoftwareHeritageResponse() {
  return { ok: false, status: 404 };
}

function emptyUkGovResponse() {
  return { ok: true, status: 200, text: vi.fn().mockResolvedValue("<html><body>No captures</body></html>") };
}

function emptyLocResponse() {
  return { ok: true, status: 200, text: vi.fn().mockResolvedValue("<html><body>No captures</body></html>") };
}

function emptyCanadaGovResponse() {
  return { ok: true, status: 200, text: vi.fn().mockResolvedValue("{}") };
}

function emptyPywbCdxResponse() {
  return { ok: true, status: 200, text: vi.fn().mockResolvedValue("") };
}

function emptyNtuwasResponse() {
  return { ok: true, status: 200, text: vi.fn().mockResolvedValue("") };
}

function emptyWebCiteResponse(url: string) {
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

  if (url.includes("/mainframe.php")) {
    return {
      ok: true,
      status: 200,
      headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
      text: vi.fn().mockResolvedValue("<html><body>No capture</body></html>")
    };
  }

  return {
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue("<html><frameset></frameset></html>")
  };
}

function dispatchByHost(handlers: Record<string, (url: string) => unknown>) {
  return vi.fn(async (url: string) => {
    const host = new URL(url).hostname;
    const key = Object.keys(handlers).find((handlerHost) => host.includes(handlerHost));
    if (!key && host.includes("webcitation.org")) {
      return emptyWebCiteResponse(url);
    }
    if (!key) throw new Error(`unhandled host ${host}`);
    return handlers[key](url);
  });
}

describe("lookupArchives", () => {
  it("rejects ineligible URLs without calling any provider", async () => {
    const fetchImpl = vi.fn();
    const result = await lookupArchives(
      "http://localhost:3000",
      "exact-then-cleaned",
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("not-eligible");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("always returns a Wayback hit first when Wayback succeeds", async () => {
    const fetchImpl = dispatchByHost({
      "web.archive.org": (url: string) => (url.includes("/web/") ? archiveHtmlResponse("Wayback") : waybackHit()),
      "archive.ph": () => emptyArchiveTodayResponse(),
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse()
    });

    const result = await lookupArchives(
      "https://example.com",
      "exact-only",
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.providerId).toBe("wayback");
      expect(result.snapshot.archiveUrl).toContain("web.archive.org/web/20240101000000id_");
      expect(result.snapshot.openUrl).toContain("web.archive.org/web/20240101000000/");
      expect(result.manualSources.map((source) => source.providerId)).toEqual([
        "yandex-cache",
        "archive-today",
        "ghostarchive",
        "web-gyotaku",
        "webcite"
      ]);
    }
  });

  it("keeps collecting later archive hits after the first match", async () => {
    const fetchImpl = dispatchByHost({
      "web.archive.org": (url: string) =>
        url.includes("/web/") ? archiveHtmlResponse("Wayback") : waybackHit("20240101000000"),
      "archive.ph": (url: string) =>
        url.includes("/timemap/")
          ? {
              ok: true,
              status: 200,
              text: vi
                .fn()
                .mockResolvedValue(
                  `<https://archive.ph/20240202000000/https://example.com>; rel="memento"; datetime="Fri, 02 Feb 2024 00:00:00 GMT"`
                )
            }
          : archiveHtmlResponse("Archive.today snapshot"),
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse()
    });

    const found: string[] = [];
    const result = await lookupArchives(
      "https://example.com",
      "exact-only",
      fetchImpl as unknown as typeof fetch,
      undefined,
      (snapshot) => found.push(snapshot.providerId)
    );

    expect(found).toEqual(["wayback", "archive-today"]);
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.snapshot.providerId).toBe("wayback");
      expect(result.additionalSnapshots.map((snapshot) => snapshot.providerId)).toEqual([
        "archive-today"
      ]);
      expect(result.manualSources.map((source) => source.providerId)).toEqual([
        "yandex-cache",
        "ghostarchive",
        "web-gyotaku",
        "webcite"
      ]);
    }
  });

  it("keeps checking cleaned candidates for the same provider after an exact hit", async () => {
    const waybackCdxRequests: string[] = [];
    const preferred: string[] = [];
    const found: string[] = [];
    const fetchImpl = dispatchByHost({
      "web.archive.org": (url: string) => {
        if (url.includes("/web/")) {
          return archiveHtmlResponse("Wayback");
        }

        waybackCdxRequests.push(url);
        const requestedUrl = new URL(url).searchParams.get("url") ?? "";
        const timestamp = requestedUrl.includes("utm_source=test")
          ? "20240101000000"
          : "20240202000000";

        return {
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue([
            ["timestamp", "original", "mimetype", "statuscode", "digest", "length"],
            [timestamp, requestedUrl, "text/html", "200", timestamp, "100"]
          ])
        };
      },
      "archive.ph": () => emptyArchiveTodayResponse(),
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse()
    });

    const result = await lookupArchives(
      "https://example.com/story?utm_source=test",
      "exact-then-cleaned",
      fetchImpl as unknown as typeof fetch,
      undefined,
      (snapshot) => found.push(`${snapshot.providerId}:${snapshot.strategy}:${snapshot.timestamp}`),
      (snapshot) => preferred.push(`${snapshot.providerId}:${snapshot.strategy}:${snapshot.timestamp}`),
      ["wayback"]
    );

    expect(waybackCdxRequests.map((url) => new URL(url).searchParams.get("url"))).toEqual([
      "https://example.com/story?utm_source=test",
      "https://example.com/story"
    ]);
    expect(preferred).toEqual(["wayback:exact:20240101000000"]);
    expect(found).toEqual([
      "wayback:exact:20240101000000",
      "wayback:cleaned:20240202000000"
    ]);
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.snapshot.strategy).toBe("exact");
      expect(result.snapshot.timestamp).toBe("20240101000000");
      expect(result.additionalSnapshots).toEqual([
        expect.objectContaining({
          providerId: "wayback",
          strategy: "cleaned",
          timestamp: "20240202000000",
          matchedUrl: "https://example.com/story"
        })
      ]);
      expect(result.checked.filter((attempt) => attempt.providerId === "wayback")).toEqual([
        expect.objectContaining({ strategy: "exact", outcome: "hit" }),
        expect.objectContaining({ strategy: "cleaned", outcome: "hit" })
      ]);
    }
  });

  it("includes unverified candidates after confirmed snapshots in the result list", async () => {
    const fetchImpl = dispatchByHost({
      "web.archive.org": (url: string) =>
        url.includes("/web/") ? archiveHtmlResponse("Wayback") : waybackHit("20240101000000"),
      "archive.ph": (url: string) =>
        url.includes("/timemap/")
          ? {
              ok: true,
              status: 200,
              text: vi
                .fn()
                .mockResolvedValue(
                  `<https://archive.ph/20240202000000/https://example.com>; rel="memento"; datetime="Fri, 02 Feb 2024 00:00:00 GMT"`
                )
            }
          : {
              ok: false,
              status: 429,
              redirected: false,
              headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
              text: vi.fn().mockResolvedValue("<html><body>rate limited</body></html>")
            },
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse()
    });

    const result = await lookupArchives(
      "https://example.com",
      "exact-only",
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.snapshot.providerId).toBe("wayback");
      expect(result.additionalSnapshots).toHaveLength(1);
      expect(result.additionalSnapshots[0]?.providerId).toBe("archive-today");
      expect(result.additionalSnapshots[0]?.verification).toBe("unverified");
    }
  });

  it("falls through to Perma.cc on a general URL after Wayback, Archive.today, and Ghostarchive miss", async () => {
    const fetchImpl = dispatchByHost({
      "web.archive.org": () => emptyWaybackResponse(),
      "archive.ph": () => emptyArchiveTodayResponse(),
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "api.perma.cc": () => ({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          objects: [
            {
              guid: "ABCD-1234",
              creation_timestamp: "2024-01-01T00:00:00Z",
              url: "https://example.com"
            }
          ]
        })
      }),
      "perma.cc": () => archiveHtmlResponse("Perma")
    });

    const result = await lookupArchives(
      "https://example.com",
      "exact-only",
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.providerId).toBe("perma-cc");
    }
  });

  it("can scope a lookup to Perma.cc even when Wayback would also hit", async () => {
    const fetchImpl = dispatchByHost({
      "web.archive.org": (url: string) => (url.includes("/web/") ? archiveHtmlResponse("Wayback") : waybackHit()),
      "api.perma.cc": () => ({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          objects: [
            {
              guid: "ABCD-1234",
              creation_timestamp: "2024-01-01T00:00:00Z",
              url: "https://example.com"
            }
          ]
        })
      }),
      "perma.cc": () => archiveHtmlResponse("Perma")
    });

    const result = await lookupArchives(
      "https://example.com",
      "exact-only",
      fetchImpl as unknown as typeof fetch,
      undefined,
      undefined,
      undefined,
      ["perma-cc"]
    );

    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.providerId).toBe("perma-cc");
    }
  });

  it("returns a confirmed WebCite snapshot when the archived main frame is valid", async () => {
    const fetchImpl = dispatchByHost({
      "web.archive.org": () => emptyWaybackResponse(),
      "archive.ph": () => emptyArchiveTodayResponse(),
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse(),
      "webcitation.org": (url: string) => {
        if (url.includes("/topframe.php")) {
          return {
            ok: true,
            status: 200,
            text: vi.fn().mockResolvedValue(`
              <table class="topframe">
                <a href="perma-123" target="_top">Permalink&nbsp;to&nbsp;this&nbsp;cache</a>
                <select name="id">
                  <option value="older">2018-01-01 00:00:00</option>
                  <option value="latest">2019-06-07 07:04:09</option>
                </select>
              </table>
            `)
          };
        }

        if (url.includes("/mainframe.php")) {
          return {
            ok: true,
            status: 200,
            headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
            text: vi.fn().mockResolvedValue("<html><head><title>Saved page</title></head><body>ok</body></html>")
          };
        }

        return {
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(WEB_CITE_FRAMESET_HTML)
        };
      }
    });

    const result = await lookupArchives(
      "https://example.com",
      "exact-only",
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.providerId).toBe("webcite");
      expect(result.snapshot.archiveUrl).toBe("https://www.webcitation.org/query?id=latest");
      expect(result.snapshot.openUrl).toBe("https://www.webcitation.org/perma-123");
      expect(result.snapshot.timestamp).toBe("20190607070409");
      expect(result.manualSources.map((source) => source.providerId)).toEqual([
        "yandex-cache",
        "wayback",
        "archive-today",
        "ghostarchive",
        "web-gyotaku"
      ]);
    }
  });

  it("returns an unverified WebCite snapshot when the archived main frame cannot be confirmed", async () => {
    const fetchImpl = dispatchByHost({
      "web.archive.org": () => emptyWaybackResponse(),
      "archive.ph": () => emptyArchiveTodayResponse(),
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse(),
      "webcitation.org": (url: string) => {
        if (url.includes("/topframe.php")) {
          return {
            ok: true,
            status: 200,
            text: vi.fn().mockResolvedValue(`
              <table class="topframe">
                <a href="perma-999" target="_top">Permalink&nbsp;to&nbsp;this&nbsp;cache</a>
                <select name="id">
                  <option value="failed-one">2019-06-07 07:04:09 (failed)</option>
                  <option value="kept-one">2018-05-13 21:44:00</option>
                </select>
              </table>
            `)
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
          text: vi.fn().mockResolvedValue(WEB_CITE_FRAMESET_HTML)
        };
      }
    });

    const result = await lookupArchives(
      "https://example.com",
      "exact-only",
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("unverified");
    if (result.status === "unverified") {
      expect(result.snapshot.providerId).toBe("webcite");
      expect(result.snapshot.archiveUrl).toBe("https://www.webcitation.org/query?id=kept-one");
      expect(result.snapshot.openUrl).toBe("https://www.webcitation.org/perma-999");
      expect(result.snapshot.verification).toBe("unverified");
    }
  });

  it("opens the newest non-Wayback hit when Wayback has no valid snapshot", async () => {
    const fetchImpl = dispatchByHost({
      "web.archive.org": () => emptyWaybackResponse(),
      "archive.ph": (url: string) =>
        url.includes("/timemap/")
          ? {
              ok: true,
              status: 200,
              text: vi
                .fn()
                .mockResolvedValue(
                  `<https://archive.ph/20240202000000/https://example.com>; rel="memento"; datetime="Fri, 02 Feb 2024 00:00:00 GMT"`
                )
            }
          : archiveHtmlResponse("Archive.today snapshot"),
      "ghostarchive.org": (url: string) =>
        url.includes("/search?")
          ? {
              ok: true,
              status: 200,
              text: vi.fn().mockResolvedValue(`
                <table>
                  <tr><td></td><td><a href="/archive/new1">https://example.com/</a></td><td>Sat, 15 Jun 2024 12:00:00 GMT</td><td>Archived webpage</td></tr>
                </table>
              `)
            }
          : archiveHtmlResponse("Ghostarchive"),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse()
    });

    const result = await lookupArchives(
      "https://example.com",
      "exact-only",
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.providerId).toBe("archive-today");
      expect(result.additionalSnapshots.map((snapshot) => snapshot.providerId)).toEqual([
        "ghostarchive"
      ]);
      expect(result.manualSources.map((source) => source.providerId)).toEqual([
        "yandex-cache",
        "wayback",
        "web-gyotaku",
        "webcite"
      ]);
    }
  });

  it("does not replace an already opened fallback snapshot with a later non-Wayback hit", async () => {
    const fetchImpl = dispatchByHost({
      "web.archive.org": () => emptyWaybackResponse(),
      "archive.ph": (url: string) =>
        url.includes("/timemap/")
          ? {
              ok: true,
              status: 200,
              text: vi
                .fn()
                .mockResolvedValue(
                  `<https://archive.ph/20240202000000/https://example.com>; rel="memento"; datetime="Fri, 02 Feb 2024 00:00:00 GMT"`
                )
            }
          : archiveHtmlResponse("Archive.today snapshot"),
      "ghostarchive.org": (url: string) =>
        url.includes("/search?")
          ? {
              ok: true,
              status: 200,
              text: vi.fn().mockResolvedValue(`
                <table>
                  <tr><td></td><td><a href="/archive/new1">https://example.com/</a></td><td>Sat, 15 Jun 2024 12:00:00 GMT</td><td>Archived webpage</td></tr>
                </table>
              `)
            }
          : archiveHtmlResponse("Ghostarchive"),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse()
    });

    const preferred: string[] = [];
    const result = await lookupArchives(
      "https://example.com",
      "exact-only",
      fetchImpl as unknown as typeof fetch,
      undefined,
      undefined,
      (snapshot) => preferred.push(snapshot.providerId)
    );

    expect(preferred).toEqual(["archive-today"]);
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.providerId).toBe("archive-today");
      expect(result.additionalSnapshots.map((snapshot) => snapshot.providerId)).toEqual([
        "ghostarchive"
      ]);
    }
  });

  it("emits a faster confirmed hit immediately while Wayback is still pending", async () => {
    let resolveWayback: (value: unknown) => void = () => {};
    const delayedWayback = new Promise((resolve) => {
      resolveWayback = resolve;
    });

    const fetchImpl = dispatchByHost({
      "web.archive.org": () => delayedWayback,
      "archive.ph": (url: string) =>
        url.includes("/timemap/")
          ? {
              ok: true,
              status: 200,
              text: vi
                .fn()
                .mockResolvedValue(
                  `<https://archive.ph/20240202000000/https://example.com>; rel="memento"; datetime="Fri, 02 Feb 2024 00:00:00 GMT"`
                )
            }
          : archiveHtmlResponse("Archive.today snapshot"),
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse()
    });

    const preferred: string[] = [];
    const lookupPromise = lookupArchives(
      "https://example.com",
      "exact-only",
      fetchImpl as unknown as typeof fetch,
      undefined,
      undefined,
      (snapshot) => preferred.push(snapshot.providerId)
    );

    await vi.waitFor(() => expect(preferred).toEqual(["archive-today"]));

    resolveWayback({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([["timestamp", "original", "mimetype", "statuscode", "digest", "length"]])
    });

    const result = await lookupPromise;
    expect(preferred).toEqual(["archive-today"]);
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.providerId).toBe("archive-today");
    }
  });

  it("keeps unresolved archive providers available as direct links on success", async () => {
    const fetchImpl = dispatchByHost({
      "web.archive.org": (url: string) => (url.includes("/web/") ? archiveHtmlResponse("Wayback") : waybackHit()),
      "archive.ph": () => emptyArchiveTodayResponse(),
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "webarchive.loc.gov": () => {
        throw new Error("Challenge page");
      },
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse()
    });

    const result = await lookupArchives(
      "https://www.whitehouse.gov/the-record/climate",
      "exact-only",
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.snapshot.providerId).toBe("wayback");
      expect(result.manualSources.map((source) => source.providerId)).toContain("archive-today");
      expect(result.manualSources.map((source) => source.providerId)).toContain("loc-web-archives");
      expect(result.failedProviders.map((provider) => provider.providerId)).toContain("loc-web-archives");
    }
  });

  it("uses the Portugal order for .pt URLs", async () => {
    const fetchImpl = dispatchByHost({
      "web.archive.org": () => emptyWaybackResponse(),
      "archive.ph": () => emptyArchiveTodayResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse()
    });

    const steps: string[] = [];
    await lookupArchives(
      "https://example.pt",
      "exact-only",
      fetchImpl as unknown as typeof fetch,
      (step: LookupProgressStep) => {
        if (step.phase === "querying") steps.push(`${step.providerId}:${step.strategy}`);
      }
    );

    expect(Array.from(new Set(steps))).toEqual([
      "wayback:exact",
      "archive-today:exact",
      "arquivo-pt:exact",
      "ghostarchive:exact",
      "perma-cc:exact",
      "web-gyotaku:exact",
      "webcite:exact"
    ]);
  });

  it("uses the Japan order for .co.jp URLs", async () => {
    const fetchImpl = dispatchByHost({
      "web.archive.org": () => emptyWaybackResponse(),
      "archive.ph": () => emptyArchiveTodayResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse(),
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse()
    });

    const steps: string[] = [];
    await lookupArchives(
      "https://example.co.jp",
      "exact-only",
      fetchImpl as unknown as typeof fetch,
      (step: LookupProgressStep) => {
        if (step.phase === "querying") steps.push(`${step.providerId}:${step.strategy}`);
      }
    );

    expect(Array.from(new Set(steps))).toEqual([
      "wayback:exact",
      "archive-today:exact",
      "web-gyotaku:exact",
      "ghostarchive:exact",
      "perma-cc:exact",
      "webcite:exact"
    ]);
  });

  it("inserts the UK and LOC government archives only for matching government URLs", async () => {
    const ukFetch = dispatchByHost({
      "web.archive.org": () => emptyWaybackResponse(),
      "archive.ph": () => emptyArchiveTodayResponse(),
      "webarchive.nationalarchives.gov.uk": () => emptyUkGovResponse(),
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse()
    });
    const ukSteps: string[] = [];

    await lookupArchives(
      "https://www.gov.uk",
      "exact-only",
      ukFetch as unknown as typeof fetch,
      (step: LookupProgressStep) => {
        if (step.phase === "querying") ukSteps.push(step.providerId);
      }
    );

    expect(Array.from(new Set(ukSteps))).toEqual([
      "wayback",
      "archive-today",
      "uk-gov-web-archive",
      "ghostarchive",
      "perma-cc",
      "web-gyotaku",
      "webcite"
    ]);

    const usFetch = dispatchByHost({
      "web.archive.org": () => emptyWaybackResponse(),
      "archive.ph": () => emptyArchiveTodayResponse(),
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "webarchive.loc.gov": () => emptyLocResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse()
    });
    const usSteps: string[] = [];

    await lookupArchives(
      "https://www.loc.gov",
      "exact-only",
      usFetch as unknown as typeof fetch,
      (step: LookupProgressStep) => {
        if (step.phase === "querying") usSteps.push(step.providerId);
      }
    );

    expect(Array.from(new Set(usSteps))).toEqual([
      "wayback",
      "archive-today",
      "ghostarchive",
      "loc-web-archives",
      "perma-cc",
      "web-gyotaku",
      "webcite"
    ]);

    const canadaFetch = dispatchByHost({
      "web.archive.org": () => emptyWaybackResponse(),
      "archive.ph": () => emptyArchiveTodayResponse(),
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "webarchiveweb.wayback.bac-lac.canada.ca": () => emptyCanadaGovResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse()
    });
    const canadaSteps: string[] = [];

    await lookupArchives(
      "https://www.canada.ca/en.html",
      "exact-only",
      canadaFetch as unknown as typeof fetch,
      (step: LookupProgressStep) => {
        if (step.phase === "querying") canadaSteps.push(step.providerId);
      }
    );

    expect(Array.from(new Set(canadaSteps))).toEqual([
      "wayback",
      "archive-today",
      "canada-gov-web-archive",
      "ghostarchive",
      "perma-cc",
      "web-gyotaku",
      "webcite"
    ]);

    const icelandFetch = dispatchByHost({
      "web.archive.org": () => emptyWaybackResponse(),
      "archive.ph": () => emptyArchiveTodayResponse(),
      "vefsafn.is": () => emptyPywbCdxResponse(),
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse()
    });
    const icelandSteps: string[] = [];

    await lookupArchives(
      "https://www.stjornarradid.is/",
      "exact-only",
      icelandFetch as unknown as typeof fetch,
      (step: LookupProgressStep) => {
        if (step.phase === "querying") icelandSteps.push(step.providerId);
      }
    );

    expect(Array.from(new Set(icelandSteps))).toEqual([
      "wayback",
      "archive-today",
      "vefsafn",
      "ghostarchive",
      "perma-cc",
      "web-gyotaku",
      "webcite"
    ]);

    const taiwanFetch = dispatchByHost({
      "web.archive.org": () => emptyWaybackResponse(),
      "archive.ph": () => emptyArchiveTodayResponse(),
      "webarchive.lib.ntu.edu.tw": () => emptyNtuwasResponse(),
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse()
    });
    const taiwanSteps: string[] = [];

    await lookupArchives(
      "https://www.ntu.edu.tw/",
      "exact-only",
      taiwanFetch as unknown as typeof fetch,
      (step: LookupProgressStep) => {
        if (step.phase === "querying") taiwanSteps.push(step.providerId);
      }
    );

    expect(Array.from(new Set(taiwanSteps))).toEqual([
      "wayback",
      "archive-today",
      "ntuwas",
      "ghostarchive",
      "perma-cc",
      "web-gyotaku",
      "webcite"
    ]);

    const cataloniaFetch = dispatchByHost({
      "web.archive.org": () => emptyWaybackResponse(),
      "archive.ph": () => emptyArchiveTodayResponse(),
      "wayback.padicat.cat": () => emptyPywbCdxResponse(),
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse()
    });
    const cataloniaSteps: string[] = [];

    await lookupArchives(
      "https://www.vilaweb.cat/",
      "exact-only",
      cataloniaFetch as unknown as typeof fetch,
      (step: LookupProgressStep) => {
        if (step.phase === "querying") cataloniaSteps.push(step.providerId);
      }
    );

    expect(Array.from(new Set(cataloniaSteps))).toEqual([
      "wayback",
      "archive-today",
      "padicat",
      "ghostarchive",
      "perma-cc",
      "web-gyotaku",
      "webcite"
    ]);
  });

  it("returns eligible direct links, including manual-only providers, and highlights provider failures", async () => {
    const fetchImpl = dispatchByHost({
      "web.archive.org": () => emptyWaybackResponse(),
      "archive.ph": () => {
        throw new Error("CORS blocked");
      },
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse(),
      "archive.softwareheritage.org": () => emptySoftwareHeritageResponse()
    });

    const result = await lookupArchives(
      "https://github.com/openai/openai",
      "exact-only",
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("not-found");
    if (result.status === "not-found") {
      expect(result.failedProviders).toHaveLength(1);
      expect(result.failedProviders[0].providerId).toBe("archive-today");
      expect(result.failedProviders[0].reason).toBeUndefined();
      expect(result.manualSources.map((source) => source.providerId)).toEqual([
        "yandex-cache",
        "wayback",
        "archive-today",
        "ghostarchive",
        "software-heritage",
        "web-gyotaku",
        "webcite"
      ]);
    }
  });

  it("adds cleaned manual source links when the requested URL has query parameters", async () => {
    const fetchImpl = dispatchByHost({
      "web.archive.org": () => emptyWaybackResponse(),
      "archive.ph": () => emptyArchiveTodayResponse(),
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse()
    });

    const result = await lookupArchives(
      "https://example.com/story?utm_source=chatgpt.com",
      "exact-only",
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("not-found");
    if (result.status === "not-found") {
      const ghostarchive = result.manualSources.find((source) => source.providerId === "ghostarchive");
      expect(ghostarchive?.url).toContain("utm_source");
      expect(ghostarchive?.cleanedUrl).toBe("https://ghostarchive.org/search?term=https%3A%2F%2Fexample.com%2Fstory");
    }
  });

  it("marks Archive.today 429 responses as a manual challenge fallback", async () => {
    const fetchImpl = dispatchByHost({
      "web.archive.org": () => emptyWaybackResponse(),
      "archive.ph": () => ({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue("<html><body>rate limited</body></html>")
      }),
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse()
    });

    const result = await lookupArchives(
      "https://example.com",
      "exact-only",
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("not-found");
    if (result.status === "not-found") {
      expect(result.failedProviders).toEqual([
        expect.objectContaining({
          providerId: "archive-today",
          reason: "challenge-required"
        })
      ]);
      expect(result.manualSources.map((source) => source.providerId)).toContain("archive-today");
    }
  });

  it("marks Wayback 429 responses as rate-limited while keeping the manual link available", async () => {
    const fetchImpl = dispatchByHost({
      "web.archive.org": () => ({
        ok: false,
        status: 429,
        json: vi.fn().mockResolvedValue([])
      }),
      "archive.ph": () => emptyArchiveTodayResponse(),
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse()
    });

    const result = await lookupArchives(
      "https://example.com",
      "exact-only",
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("not-found");
    if (result.status === "not-found") {
      expect(result.failedProviders).toEqual([
        expect.objectContaining({
          providerId: "wayback",
          reason: "rate-limited"
        })
      ]);
      expect(result.manualSources.map((source) => source.providerId)).toContain("wayback");
    }
  });

  it("returns unverified snapshot candidates when no provider can confirm a replay", async () => {
    const fetchImpl = dispatchByHost({
      "web.archive.org": () => emptyWaybackResponse(),
      "archive.ph": (url: string) =>
        url.includes("/timemap/")
          ? {
              ok: true,
              status: 200,
              text: vi
                .fn()
                .mockResolvedValue(
                  `<https://archive.ph/20240202000000/https://example.com>; rel="memento"; datetime="Fri, 02 Feb 2024 00:00:00 GMT"`
                )
            }
          : {
              ok: false,
              status: 429,
              redirected: false,
              headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
              text: vi.fn().mockResolvedValue("<html><body>rate limited</body></html>")
            },
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse()
    });

    const result = await lookupArchives(
      "https://example.com",
      "exact-only",
      fetchImpl as unknown as typeof fetch
    );

    expect(result.status).toBe("unverified");
    if (result.status === "unverified") {
      expect(result.snapshot.providerId).toBe("archive-today");
      expect(result.snapshot.verification).toBe("unverified");
      expect(result.manualSources.map((source) => source.providerId)).toEqual([
        "yandex-cache",
        "wayback",
        "ghostarchive",
        "web-gyotaku",
        "webcite"
      ]);
    }
  });

  it("finishes exact before starting cleaned for the same provider", async () => {
    const waybackRequests: string[] = [];
    let resolveExactLookup: (value: unknown) => void = () => {};
    const exactLookup = new Promise((resolve) => {
      resolveExactLookup = resolve;
    });

    const fetchImpl = vi.fn(async (url: string) => {
      const host = new URL(url).hostname;

      if (host.includes("web.archive.org")) {
        waybackRequests.push(url);
        if (url.includes("utm_source=test")) {
          return exactLookup;
        }

        return {
          ok: true,
          status: 200,
          json: vi
            .fn()
            .mockResolvedValue([["timestamp", "original", "mimetype", "statuscode", "digest", "length"]])
        };
      }

      if (host.includes("archive.ph") || host.includes("ghostarchive.org") || host.includes("megalodon.jp")) {
        return {
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue("<html><body>none</body></html>")
        };
      }

      if (host.includes("api.perma.cc")) {
        return { ok: true, status: 200, json: vi.fn().mockResolvedValue({ objects: [] }) };
      }

      if (host.includes("arquivo.pt")) {
        return { ok: true, status: 200, json: vi.fn().mockResolvedValue({ items: [] }) };
      }

      if (host.includes("webcitation.org")) {
        return emptyWebCiteResponse(url);
      }

      throw new Error(`unhandled host ${host}`);
    });

    const lookupPromise = lookupArchives(
      "https://example.com/missing?utm_source=test",
      "exact-then-cleaned",
      fetchImpl as unknown as typeof fetch
    );

    await vi.waitFor(() => expect(waybackRequests).toHaveLength(1));
    expect(decodeURIComponent(waybackRequests[0])).toContain("utm_source=test");

    resolveExactLookup({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([["timestamp", "original", "mimetype", "statuscode", "digest", "length"]])
    });

    await vi.waitFor(() => expect(waybackRequests).toHaveLength(2));
    expect(decodeURIComponent(waybackRequests[1])).toContain("https://example.com/missing");

    await lookupPromise;
  });

  it("marks a provider as failed when one candidate errors and another only misses", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const host = new URL(url).hostname;

      if (host.includes("web.archive.org")) {
        if (decodeURIComponent(url).includes("utm_source=test")) {
          return {
            ok: false,
            status: 429,
            json: vi.fn().mockResolvedValue([])
          };
        }

        return {
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue([["timestamp", "original", "mimetype", "statuscode", "digest", "length"]])
        };
      }

      if (host.includes("archive.ph") || host.includes("ghostarchive.org") || host.includes("megalodon.jp")) {
        return {
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue("<html><body>none</body></html>")
        };
      }

      if (host.includes("api.perma.cc")) {
        return { ok: true, status: 200, json: vi.fn().mockResolvedValue({ objects: [] }) };
      }

      if (host.includes("arquivo.pt")) {
        return { ok: true, status: 200, json: vi.fn().mockResolvedValue({ items: [] }) };
      }

      throw new Error(`unhandled host ${host}`);
    });

    const lookupPromise = lookupArchives(
      "https://example.com/missing?utm_source=test",
      "exact-then-cleaned",
      fetchImpl as unknown as typeof fetch
    );

    const result = await lookupPromise;
    expect(result.status).toBe("not-found");
    if (result.status === "not-found") {
      expect(result.failedProviders).toContainEqual(
        expect.objectContaining({
          providerId: "wayback",
          reason: "rate-limited",
          technicalDetail: "429 during query"
        })
      );
      expect(result.checked.filter((attempt) => attempt.providerId === "wayback")).toEqual([
        expect.objectContaining({ strategy: "exact", outcome: "error" })
      ]);
    }
  });

  it("applies the configured timeout to each archive call", async () => {
    vi.useFakeTimers();

    const fetchImpl = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new Error("aborted")),
          { once: true }
        );
      });
    });

    const lookupPromise = lookupArchives(
      "https://example.com",
      "exact-only",
      fetchImpl as unknown as typeof fetch,
      undefined,
      undefined,
      undefined,
      ["wayback"],
      undefined,
      50
    );

    await vi.advanceTimersByTimeAsync(50);
    const result = await lookupPromise;

    expect(result.status).toBe("not-found");
    if (result.status === "not-found") {
      expect(result.failedProviders).toEqual([
        expect.objectContaining({
          providerId: "wayback",
          reason: "timeout",
          technicalDetail: "query timeout"
        })
      ]);
    }

    vi.useRealTimers();
  });

  it("retries cleaned after an exact timeout with a fresh timeout budget", async () => {
    vi.useFakeTimers();

    const fetchImpl = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url);

      if (requestUrl.includes("/cdx?")) {
        if (decodeURIComponent(requestUrl).includes("utm_source=test")) {
          return new Promise((_, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(new Error("aborted")),
              { once: true }
            );
          });
        }

        return Promise.resolve(waybackHit());
      }

      if (requestUrl.includes("/web/")) {
        return Promise.resolve(archiveHtmlResponse("Wayback"));
      }

      throw new Error(`unhandled url ${requestUrl}`);
    });

    const lookupPromise = lookupArchives(
      "https://example.com/missing?utm_source=test",
      "exact-then-cleaned",
      fetchImpl as unknown as typeof fetch,
      undefined,
      undefined,
      undefined,
      ["wayback"],
      undefined,
      50
    );

    await vi.advanceTimersByTimeAsync(50);
    const result = await lookupPromise;

    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.snapshot.providerId).toBe("wayback");
      expect(result.snapshot.strategy).toBe("cleaned");
      expect(result.checked).toEqual([
        expect.objectContaining({ providerId: "wayback", strategy: "exact", outcome: "error" }),
        expect.objectContaining({ providerId: "wayback", strategy: "cleaned", outcome: "hit" })
      ]);
    }

    vi.useRealTimers();
  });

  it("retries the same provider on the next lookup after a rate-limit failure", async () => {
    const rateLimitedFetch = dispatchByHost({
      "web.archive.org": () => ({
        ok: false,
        status: 429,
        headers: { get: vi.fn().mockReturnValue("120") },
        json: vi.fn().mockResolvedValue([])
      }),
      "archive.ph": () => emptyArchiveTodayResponse(),
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse()
    });

    const firstResult = await lookupArchives(
      "https://example.com",
      "exact-only",
      rateLimitedFetch as unknown as typeof fetch
    );
    expect(firstResult.status).toBe("not-found");

    let waybackRetried = false;
    const secondFetch = dispatchByHost({
      "web.archive.org": () => {
        waybackRetried = true;
        return {
          ok: true,
          status: 200,
          json: vi
            .fn()
            .mockResolvedValue([["timestamp", "original", "mimetype", "statuscode", "digest", "length"]])
        };
      },
      "archive.ph": () => emptyArchiveTodayResponse(),
      "ghostarchive.org": () => emptyGhostarchiveResponse(),
      "api.perma.cc": () => emptyPermaCcResponse(),
      "arquivo.pt": () => emptyArquivoPtResponse(),
      "megalodon.jp": () => emptyWebGyotakuResponse()
    });

    const secondResult = await lookupArchives(
      "https://example.com",
      "exact-only",
      secondFetch as unknown as typeof fetch
    );
    expect(secondResult.status).toBe("not-found");
    expect(waybackRetried).toBe(true);
  });

  it("returns not-found without querying when the allowed provider scope is empty", async () => {
    const fetchImpl = vi.fn();

    const result = await lookupArchives(
      "https://example.com",
      "exact-only",
      fetchImpl as unknown as typeof fetch,
      undefined,
      undefined,
      undefined,
      []
    );

    expect(result.status).toBe("not-found");
    expect(fetchImpl).not.toHaveBeenCalled();
    if (result.status === "not-found") {
      expect(result.checked).toEqual([]);
      expect(result.failedProviders).toEqual([]);
      expect(result.manualSources).toEqual([]);
    }
  });
});
