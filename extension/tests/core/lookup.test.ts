import { describe, expect, it, vi } from "vitest";
import { lookupArchives } from "@/core/lookup";
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

function dispatchByHost(handlers: Record<string, (url: string) => unknown>) {
  return vi.fn(async (url: string) => {
    const host = new URL(url).hostname;
    const key = Object.keys(handlers).find((handlerHost) => host.includes(handlerHost));
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
        "archive-today",
        "ghostarchive",
        "web-gyotaku",
        "yandex-cache",
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
          : archiveHtmlResponse("Archive.today"),
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
        "ghostarchive",
        "web-gyotaku",
        "yandex-cache",
        "webcite"
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
          : archiveHtmlResponse("Archive.today"),
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
        "wayback",
        "web-gyotaku",
        "yandex-cache",
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
          : archiveHtmlResponse("Archive.today"),
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

  it("opens a faster fallback only after Wayback finishes without a hit", async () => {
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
          : archiveHtmlResponse("Archive.today"),
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

    await Promise.resolve();
    expect(preferred).toEqual([]);

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

    expect(steps).toEqual([
      "wayback:exact",
      "archive-today:exact",
      "arquivo-pt:exact",
      "ghostarchive:exact",
      "perma-cc:exact",
      "web-gyotaku:exact"
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

    expect(steps).toEqual([
      "wayback:exact",
      "archive-today:exact",
      "web-gyotaku:exact",
      "ghostarchive:exact",
      "perma-cc:exact"
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

    expect(ukSteps).toEqual([
      "wayback",
      "archive-today",
      "uk-gov-web-archive",
      "ghostarchive",
      "perma-cc",
      "web-gyotaku"
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

    expect(usSteps).toEqual([
      "wayback",
      "archive-today",
      "ghostarchive",
      "loc-web-archives",
      "perma-cc",
      "web-gyotaku"
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
      expect(result.manualSources.map((source) => source.providerId)).toEqual([
        "wayback",
        "archive-today",
        "ghostarchive",
        "software-heritage",
        "web-gyotaku",
        "yandex-cache",
        "webcite"
      ]);
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
        "wayback",
        "ghostarchive",
        "web-gyotaku",
        "yandex-cache",
        "webcite"
      ]);
    }
  });

  it("applies the central timeout to provider requests", async () => {
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
      expect(result.failedProviders.map((provider) => provider.providerId)).toEqual(["wayback"]);
    }

    vi.useRealTimers();
  });
});
