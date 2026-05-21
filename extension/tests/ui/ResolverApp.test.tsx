import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResolverApp, resetResolverAutoOpenStateForTests } from "@/components/ResolverApp";
import { DEFAULT_SETTINGS } from "@/core/settings";
import { resetStorageCachesForTests } from "@/platform/storage";

const storageGetMock = browser.storage.local.get as unknown as ReturnType<typeof vi.fn>;

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

function notFoundFetch() {
  return vi.fn(async (url: string) => {
    const host = new URL(url).hostname;

    if (host.includes("web.archive.org")) {
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
}

describe("ResolverApp", () => {
  beforeEach(() => {
    resetStorageCachesForTests();
    resetResolverAutoOpenStateForTests();
    vi.mocked(browser.tabs.create).mockClear();
    storageGetMock.mockResolvedValue({
      "pastPage.settings": DEFAULT_SETTINGS
    });
  });

  it("renders a not-found state for a broken-page lookup", async () => {
    vi.stubGlobal("fetch", notFoundFetch());
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fexample.com%2Fmissing&kind=http&statusCode=404"
    );

    render(<ResolverApp />);

    await waitFor(() =>
      expect(screen.getByText(/No archived HTML snapshot could be confirmed automatically/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/404: Page not found/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open original/i })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Copy original URL/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Check on Perma\.cc/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Check on Ghostarchive/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Check on /i }).length).toBeGreaterThan(0);
  });

  it("shows a manual Archive.today fallback hint when Archive.today returns 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const host = new URL(url).hostname;

        if (host.includes("web.archive.org")) {
          return {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue([["timestamp", "original", "mimetype", "statuscode", "digest", "length"]])
          };
        }

        if (host.includes("archive.ph")) {
          return {
            ok: false,
            status: 429,
            text: vi.fn().mockResolvedValue("<html><body>rate limited</body></html>")
          };
        }

        if (host.includes("ghostarchive.org") || host.includes("megalodon.jp")) {
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
      })
    );
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fexample.com%2Fmissing&kind=http&statusCode=404"
    );

    render(<ResolverApp />);

    const badge = await screen.findByRole("button", { name: "Captcha" });
    await userEvent.hover(badge);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/Archive\.today asked for a manual challenge step/i);
    await userEvent.unhover(badge);
    expect(screen.getByText(/Check on Archive\.today/i)).toBeInTheDocument();
  });

  it("shows a Wayback rate-limit hint when Wayback returns 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const host = new URL(url).hostname;

        if (host.includes("web.archive.org")) {
          return {
            ok: false,
            status: 429,
            json: vi.fn().mockResolvedValue([])
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
      })
    );
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fexample.com%2Fmissing&kind=http&statusCode=404"
    );

    render(<ResolverApp />);

    const badge = await screen.findByRole("button", { name: "Too Many Requests" });
    await userEvent.hover(badge);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/Wayback Machine rate-limited this request/i);
    await userEvent.unhover(badge);
    expect(screen.getByText(/Check on Wayback Machine/i)).toBeInTheDocument();
  });

  it("shows a manual-help badge for Yandex Cache with hover instructions", async () => {
    vi.stubGlobal("fetch", notFoundFetch());
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fexample.com%2Fmissing&kind=http&statusCode=404"
    );

    render(<ResolverApp />);

    await waitFor(() => expect(screen.getByText(/Check on Yandex Cache/i)).toBeInTheDocument());
    const badge = screen.getByRole("button", { name: "Manual" });
    await userEvent.hover(badge);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/Yandex Cache always has to be checked manually/i);
    await userEvent.unhover(badge);
    expect(screen.getByText(/Copy cache link/i)).toBeInTheDocument();
  });

  it("shows provider failures incrementally while another provider is still pending", async () => {
    let resolveArchiveToday: (value: unknown) => void = () => {};
    const archiveTodayPending = new Promise((resolve) => {
      resolveArchiveToday = resolve;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const host = new URL(url).hostname;

        if (host.includes("web.archive.org")) {
          return {
            ok: false,
            status: 429,
            json: vi.fn().mockResolvedValue([])
          };
        }

        if (host.includes("archive.ph")) {
          return archiveTodayPending;
        }

        if (host.includes("ghostarchive.org") || host.includes("megalodon.jp")) {
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
      })
    );
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fexample.com%2Fmissing&kind=http&statusCode=404"
    );

    render(<ResolverApp />);

    await waitFor(() => expect(screen.getByText(/Check on Ghostarchive/i)).toBeInTheDocument());
    expect(screen.getByText(/Check on Wayback Machine/i)).toBeInTheDocument();
    expect(screen.getByText(/Check on Yandex Cache/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/No archived HTML snapshot could be confirmed automatically/i)
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveArchiveToday({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue("<html><body>none</body></html>")
      });
    });

    await waitFor(() =>
      expect(screen.getByText(/No archived HTML snapshot could be confirmed automatically/i)).toBeInTheDocument()
    );
  });

  it("shows a Not Found badge for providers that returned miss", async () => {
    vi.stubGlobal("fetch", notFoundFetch());
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fexample.com%2Fmissing&kind=http&statusCode=404"
    );

    render(<ResolverApp />);

    await waitFor(() => expect(screen.getByText(/Check on Ghostarchive/i)).toBeInTheDocument());
    const badges = screen.getAllByRole("button", { name: "Not Found" });
    expect(badges.length).toBeGreaterThan(0);
    await userEvent.hover(badges[0]);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/did not have this URL archived/i);
  });

  it("shows completed provider results before a slow provider finishes", async () => {
    let resolveArchiveToday: (value: unknown) => void = () => {};
    const archiveTodayPending = new Promise((resolve) => {
      resolveArchiveToday = resolve;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const { hostname, pathname } = new URL(url);

        if (hostname.includes("web.archive.org")) {
          return pathname.includes("/web/")
            ? archiveHtmlResponse("Wayback")
            : {
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue([
                  ["timestamp", "original", "mimetype", "statuscode", "digest", "length"],
                  ["20170119233731", "https://example.com/missing", "text/html", "200", "digest", "120"]
                ])
              };
        }

        if (hostname.includes("archive.ph")) {
          return archiveTodayPending;
        }

        if (hostname.includes("ghostarchive.org") || hostname.includes("megalodon.jp")) {
          return {
            ok: true,
            status: 200,
            text: vi.fn().mockResolvedValue("<html><body>none</body></html>")
          };
        }

        if (hostname.includes("api.perma.cc")) {
          return { ok: true, status: 200, json: vi.fn().mockResolvedValue({ objects: [] }) };
        }

        if (hostname.includes("arquivo.pt")) {
          return { ok: true, status: 200, json: vi.fn().mockResolvedValue({ items: [] }) };
        }

        throw new Error(`unhandled host ${hostname}`);
      })
    );
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fexample.com%2Fmissing&kind=http&statusCode=404"
    );

    render(<ResolverApp />);

    await waitFor(() => expect(screen.getByText(/Archived version found on Wayback Machine/i)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/Check on Ghostarchive/i)).toBeInTheDocument());
    expect(screen.queryByText(/Check on Archive\.today/i)).not.toBeInTheDocument();

    await act(async () => {
      resolveArchiveToday({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue("<html><body>none</body></html>")
      });
    });

    await waitFor(() => expect(screen.getByText(/Check on Archive\.today/i)).toBeInTheDocument());
  });

  it("shows a Service Error badge for providers that failed with a server error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const host = new URL(url).hostname;

        if (host.includes("web.archive.org")) {
          return {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue([["timestamp", "original", "mimetype", "statuscode", "digest", "length"]])
          };
        }

        if (host.includes("archive.ph")) {
          return {
            ok: true,
            status: 200,
            text: vi.fn().mockResolvedValue("<html><body>none</body></html>")
          };
        }

        if (host.includes("ghostarchive.org") || host.includes("megalodon.jp")) {
          return {
            ok: false,
            status: 503,
            text: vi.fn().mockResolvedValue("Service Unavailable")
          };
        }

        if (host.includes("api.perma.cc")) {
          return { ok: true, status: 200, json: vi.fn().mockResolvedValue({ objects: [] }) };
        }

        if (host.includes("arquivo.pt")) {
          return { ok: true, status: 200, json: vi.fn().mockResolvedValue({ items: [] }) };
        }

        throw new Error(`unhandled host ${host}`);
      })
    );
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fexample.com%2Fmissing&kind=http&statusCode=404"
    );

    render(<ResolverApp />);

    await waitFor(() => expect(screen.getAllByRole("button", { name: "Service Error" }).length).toBeGreaterThan(0));
    const badge = screen.getAllByRole("button", { name: "Service Error" })[0];
    await userEvent.hover(badge);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/returned an error/i);
  });

  it("shows a Timeout badge for providers that timed out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const host = new URL(url).hostname;

        if (host.includes("web.archive.org")) {
          return {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue([["timestamp", "original", "mimetype", "statuscode", "digest", "length"]])
          };
        }

        if (host.includes("archive.ph")) {
          return {
            ok: true,
            status: 200,
            text: vi.fn().mockResolvedValue("<html><body>none</body></html>")
          };
        }

        if (host.includes("ghostarchive.org") || host.includes("megalodon.jp")) {
          const error = new DOMException("The operation was aborted", "AbortError");
          throw error;
        }

        if (host.includes("api.perma.cc")) {
          return { ok: true, status: 200, json: vi.fn().mockResolvedValue({ objects: [] }) };
        }

        if (host.includes("arquivo.pt")) {
          return { ok: true, status: 200, json: vi.fn().mockResolvedValue({ items: [] }) };
        }

        throw new Error(`unhandled host ${host}`);
      })
    );
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fexample.com%2Fmissing&kind=http&statusCode=404"
    );

    render(<ResolverApp />);

    await waitFor(() => expect(screen.getAllByRole("button", { name: "Timeout" }).length).toBeGreaterThan(0));
    const badge = screen.getAllByRole("button", { name: "Timeout" })[0];
    await userEvent.hover(badge);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/took too long to respond/i);
  });

  it("renders a neutral source summary for a manual-page lookup", async () => {
    vi.stubGlobal("fetch", notFoundFetch());
    window.history.replaceState({}, "", "?trigger=manual-page&url=https%3A%2F%2Fexample.com%2Fstory");

    render(<ResolverApp />);

    await waitFor(() => expect(screen.getByText(/Current source/i)).toBeInTheDocument());
    expect(screen.getByText(/Checking archived versions for this page/i)).toBeInTheDocument();
    expect(screen.queryByText(/404: Page not found/i)).not.toBeInTheDocument();
  });

  it("starts archive lookup before the async settings read resolves", async () => {
    let resolveSettings: (value: unknown) => void = () => {};
    const delayedSettings = new Promise((resolve) => {
      resolveSettings = resolve;
    });
    const fetchMock = notFoundFetch();

    storageGetMock.mockImplementation(async (key: string) => {
      if (key === "pastPage.settings") {
        return (await delayedSettings) as Record<string, unknown>;
      }

      if (key === "pastPage.meta") {
        return {};
      }

      return {};
    });
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", "?trigger=manual-page&url=https%3A%2F%2Fexample.com%2Fstory");

    render(<ResolverApp />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    resolveSettings({
      "pastPage.settings": DEFAULT_SETTINGS
    });
    await waitFor(() =>
      expect(screen.getByText(/No archived HTML snapshot could be confirmed automatically/i)).toBeInTheDocument()
    );
  });

  it("renders provider-scoped copy for a Perma.cc lookup", async () => {
    vi.stubGlobal("fetch", notFoundFetch());
    window.history.replaceState(
      {},
      "",
      "?trigger=manual-page&url=https%3A%2F%2Fexample.com%2Fstory&providerId=perma-cc"
    );

    render(<ResolverApp />);

    await waitFor(() =>
      expect(screen.getByText(/No archived HTML snapshot could be confirmed automatically/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/PastPage checks archived captures on Perma\.cc\./i)).toBeInTheDocument();
    expect(
      screen.getByText(/Checking archived versions for this page on Perma\.cc\./i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (text) => text.includes("Perma.cc") && text.includes("could not confirm a working archived HTML snapshot automatically")
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/across all archive providers/i)
    ).not.toBeInTheDocument();
  });

  it("opens the thanks page again on the 100th search", async () => {
    storageGetMock.mockResolvedValue({
      "pastPage.settings": DEFAULT_SETTINGS,
      "pastPage.meta": {
        searchCount: 99
      }
    });
    vi.stubGlobal("fetch", notFoundFetch());
    window.history.replaceState({}, "", "?trigger=manual-page&url=https%3A%2F%2Fexample.com%2Fstory");

    render(<ResolverApp />);

    await waitFor(() =>
      expect(screen.getByText(/No archived HTML snapshot could be confirmed automatically/i)).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(browser.tabs.create).toHaveBeenCalledWith({
        url: "moz-extension://test//thanks.html",
        active: false
      })
    );
  });

  it("opens the thanks page again on the 200th search", async () => {
    storageGetMock.mockResolvedValue({
      "pastPage.settings": DEFAULT_SETTINGS,
      "pastPage.meta": {
        searchCount: 199,
        searchReviewPromptCount: 100,
        searchReviewPromptShownAt: 1710000000000
      }
    });
    vi.stubGlobal("fetch", notFoundFetch());
    window.history.replaceState({}, "", "?trigger=manual-page&url=https%3A%2F%2Fexample.com%2Fstory");

    render(<ResolverApp />);

    await waitFor(() =>
      expect(screen.getByText(/No archived HTML snapshot could be confirmed automatically/i)).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(browser.tabs.create).toHaveBeenCalledWith({
        url: "moz-extension://test//thanks.html",
        active: false
      })
    );
  });

  it("does not query or render disabled Arquivo.pt sources", async () => {
    const fetchMock = notFoundFetch();
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", "?trigger=manual-page&url=https%3A%2F%2Fexample.com%2Fstory");

    render(<ResolverApp />);

    await waitFor(() =>
      expect(screen.getByText(/No archived HTML snapshot could be confirmed automatically/i)).toBeInTheDocument()
    );
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("arquivo.pt"), expect.anything());
    expect(screen.queryByText(/Arquivo\.pt/i)).not.toBeInTheDocument();
  });

  it("does not query Arquivo.pt for non-Portuguese URLs even when enabled", async () => {
    const fetchMock = notFoundFetch();
    storageGetMock.mockResolvedValue({
      "pastPage.settings": {
        ...DEFAULT_SETTINGS,
        enabledProviders: [...DEFAULT_SETTINGS.enabledProviders, "arquivo-pt"]
      }
    });
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", "?trigger=manual-page&url=https%3A%2F%2Fexample.com%2Fstory");

    render(<ResolverApp />);

    await waitFor(() =>
      expect(screen.getByText(/No archived HTML snapshot could be confirmed automatically/i)).toBeInTheDocument()
    );
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("arquivo.pt"), expect.anything());
    expect(screen.queryByText(/Arquivo\.pt/i)).not.toBeInTheDocument();
  });

  it("keeps the resolver page visible after finding a snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const host = new URL(url).hostname;

        if (host.includes("web.archive.org")) {
          return url.includes("/web/")
            ? archiveHtmlResponse("Wayback")
            : {
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue([
                  ["timestamp", "original", "mimetype", "statuscode", "digest", "length"],
                  ["20240102030405", "https://example.com/missing", "text/html", "200", "digest", "120"]
                ])
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
      })
    );
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fexample.com%2Fmissing&kind=http&statusCode=404"
    );

    render(<ResolverApp />);

    await waitFor(() => expect(screen.getByText(/Archived version found/i)).toBeInTheDocument());
    expect(screen.queryByText(/Opening the Wayback Machine capture in a new tab/i)).not.toBeInTheDocument();
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
    });
  });

  it("does not auto-open a confirmed snapshot when manual opening is enabled", async () => {
    storageGetMock.mockResolvedValue({
      "pastPage.settings": {
        ...DEFAULT_SETTINGS,
        resolverSuccessBehavior: "manual-open-only"
      }
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const host = new URL(url).hostname;

        if (host.includes("web.archive.org")) {
          return url.includes("/web/")
            ? archiveHtmlResponse("Wayback")
            : {
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue([
                  ["timestamp", "original", "mimetype", "statuscode", "digest", "length"],
                  ["20240102030405", "https://example.com/missing", "text/html", "200", "digest", "120"]
                ])
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
      })
    );
    const createSpy = vi.mocked(browser.tabs.create);
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fexample.com%2Fmissing&kind=http&statusCode=404"
    );

    render(<ResolverApp />);

    await waitFor(() => expect(screen.getByText(/Archived version found/i)).toBeInTheDocument());
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
    });

    expect(
      createSpy.mock.calls.some(
        ([options]) => options.url === "https://web.archive.org/web/20240102030405/https://example.com/missing"
      )
    ).toBe(false);
    expect(window.location.search).toContain("trigger=broken-page");
  });

  it("opens the fastest confirmed hit in a new tab and lists additional archive matches", async () => {
    storageGetMock.mockResolvedValue({
      "pastPage.settings": {
        ...DEFAULT_SETTINGS,
        resolverSuccessBehavior: "keep-resolver"
      }
    });
    let resolveWayback: (value: unknown) => void = () => {};
    const delayedWayback = new Promise((resolve) => {
      resolveWayback = resolve;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const host = new URL(url).hostname;

        if (host.includes("web.archive.org")) {
          return url.includes("/web/")
            ? archiveHtmlResponse("Wayback")
            : delayedWayback;
        }

        if (host.includes("archive.ph")) {
          return url.includes("/timemap/")
            ? {
                ok: true,
                status: 200,
                text: vi
                  .fn()
                  .mockResolvedValue(
                    `<https://archive.ph/20240203040506/https://example.com/missing>; rel="memento"; datetime="Sat, 03 Feb 2024 04:05:06 GMT"`
                  )
              }
            : archiveHtmlResponse("Archive.today");
        }

        if (host.includes("ghostarchive.org") || host.includes("megalodon.jp")) {
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
      })
    );
    const createSpy = vi.mocked(browser.tabs.create);
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fexample.com%2Fmissing-foreground&kind=http&statusCode=404"
    );

    render(<ResolverApp />);

    await waitFor(() => expect(screen.getByText(/Archived version found on Archive\.today/i)).toBeInTheDocument());
    await waitFor(() =>
      expect(
        createSpy.mock.calls.some(
          ([options]) =>
            options.active === true &&
            options.openerTabId === undefined &&
            options.url === "https://archive.ph/20240203040506/https://example.com/missing"
        )
      ).toBe(true)
    );
    expect(
      createSpy.mock.calls.filter(
        ([options]) =>
          options.active === true &&
          options.url === "https://archive.ph/20240203040506/https://example.com/missing"
      )
    ).toHaveLength(1);
    resolveWayback({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([
        ["timestamp", "original", "mimetype", "statuscode", "digest", "length"],
        [
          "20240102030405",
          "https://example.com/missing-foreground",
          "text/html",
          "200",
          "digest",
          "120"
        ]
      ])
    });
    await waitFor(() => expect(screen.getByText(/Other archived versions found/i)).toBeInTheDocument());
    expect(screen.getAllByText(/Open archived version/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Archive\.today/i).length).toBeGreaterThan(0);
  });

  it("shows an unverified provider snapshot when automatic replay validation is blocked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const host = new URL(url).hostname;

        if (host.includes("web.archive.org")) {
          return {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue([["timestamp", "original", "mimetype", "statuscode", "digest", "length"]])
          };
        }

        if (host.includes("archive.ph")) {
          return url.includes("/timemap/")
            ? {
                ok: true,
                status: 200,
                text: vi
                  .fn()
                  .mockResolvedValue(
                    `<https://archive.ph/20240203040506/https://example.com/missing>; rel="memento"; datetime="Sat, 03 Feb 2024 04:05:06 GMT"`
                  )
              }
            : {
                ok: false,
                status: 429,
                redirected: false,
                headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
                text: vi.fn().mockResolvedValue("<html><body>rate limited</body></html>")
              };
        }

        if (host.includes("ghostarchive.org") || host.includes("megalodon.jp")) {
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
      })
    );
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fexample.com%2Fmissing&kind=http&statusCode=404"
    );

    render(<ResolverApp />);

    await waitFor(() =>
      expect(screen.getByText(/Archive\.today reported an archived snapshot/i)).toBeInTheDocument()
    );
    expect(
      screen.getByText(/could not verify or open it automatically/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Open this provider-reported snapshot manually/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/No archived HTML snapshot could be confirmed automatically/i)
    ).not.toBeInTheDocument();
  });

  it("shows an unverified snapshot early and upgrades it when replay validation later succeeds", async () => {
    let resolveArchiveTodayReplay: (value: unknown) => void = () => {};
    const delayedArchiveTodayReplay = new Promise((resolve) => {
      resolveArchiveTodayReplay = resolve;
    });

    storageGetMock.mockResolvedValue({
      "pastPage.settings": DEFAULT_SETTINGS
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const host = new URL(url).hostname;

        if (host.includes("web.archive.org")) {
          return {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue([["timestamp", "original", "mimetype", "statuscode", "digest", "length"]])
          };
        }

        if (host.includes("archive.ph")) {
          return url.includes("/timemap/")
            ? {
                ok: true,
                status: 200,
                text: vi
                  .fn()
                  .mockResolvedValue(
                    `<https://archive.ph/20240203040506/https://example.com/missing>; rel="memento"; datetime="Sat, 03 Feb 2024 04:05:06 GMT"`
                  )
              }
            : delayedArchiveTodayReplay;
        }

        if (host.includes("ghostarchive.org") || host.includes("megalodon.jp")) {
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
      })
    );
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fexample.com%2Fmissing&kind=http&statusCode=404"
    );

    render(<ResolverApp />);

    await waitFor(() =>
      expect(screen.getByText(/Archive\.today reported an archived snapshot/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/could not verify or open it automatically/i)).toBeInTheDocument();

    resolveArchiveTodayReplay(archiveHtmlResponse("Archive.today"));

    await waitFor(() =>
      expect(screen.getByText(/Archived version found on Archive\.today/i)).toBeInTheDocument()
    );
  });

  it("does not auto-open an unverified snapshot when manual opening is enabled", async () => {
    storageGetMock.mockResolvedValue({
      "pastPage.settings": {
        ...DEFAULT_SETTINGS,
        resolverSuccessBehavior: "manual-open-only"
      }
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const host = new URL(url).hostname;

        if (host.includes("web.archive.org")) {
          return {
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue([["timestamp", "original", "mimetype", "statuscode", "digest", "length"]])
          };
        }

        if (host.includes("archive.ph")) {
          return url.includes("/timemap/")
            ? {
                ok: true,
                status: 200,
                text: vi
                  .fn()
                  .mockResolvedValue(
                    `<https://archive.ph/20240203040506/https://example.com/missing>; rel="memento"; datetime="Sat, 03 Feb 2024 04:05:06 GMT"`
                  )
              }
            : {
                ok: false,
                status: 429,
                redirected: false,
                headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
                text: vi.fn().mockResolvedValue("<html><body>rate limited</body></html>")
              };
        }

        if (host.includes("ghostarchive.org") || host.includes("megalodon.jp")) {
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
      })
    );
    const createSpy = vi.mocked(browser.tabs.create);
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fexample.com%2Fmissing&kind=http&statusCode=404"
    );

    render(<ResolverApp />);

    await waitFor(() =>
      expect(screen.getByText(/Archive\.today reported an archived snapshot/i)).toBeInTheDocument()
    );
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
    });

    expect(createSpy).not.toHaveBeenCalled();
    expect(window.location.search).toContain("trigger=broken-page");
  });

  it("shows unverified candidates after confirmed snapshots", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const host = new URL(url).hostname;

        if (host.includes("web.archive.org")) {
          return url.includes("/web/")
            ? archiveHtmlResponse("Wayback")
            : {
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue([
                  ["timestamp", "original", "mimetype", "statuscode", "digest", "length"],
                  ["20240102030405", "https://example.com/missing", "text/html", "200", "digest", "120"]
                ])
              };
        }

        if (host.includes("archive.ph")) {
          return url.includes("/timemap/")
            ? {
                ok: true,
                status: 200,
                text: vi
                  .fn()
                  .mockResolvedValue(
                    `<https://archive.ph/20240203040506/https://example.com/missing>; rel="memento"; datetime="Sat, 03 Feb 2024 04:05:06 GMT"`
                  )
              }
            : {
                ok: false,
                status: 429,
                redirected: false,
                headers: { get: vi.fn().mockReturnValue("text/html; charset=utf-8") },
                text: vi.fn().mockResolvedValue("<html><body>rate limited</body></html>")
              };
        }

        if (host.includes("ghostarchive.org") || host.includes("megalodon.jp")) {
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
      })
    );
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fexample.com%2Fmissing&kind=http&statusCode=404"
    );

    render(<ResolverApp />);

    await waitFor(() => expect(screen.getByText(/Archived version found/i)).toBeInTheDocument());
    expect(screen.getByText(/Other archived versions found/i)).toBeInTheDocument();
    expect(screen.getByText(/Open this provider-reported snapshot manually/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Archive\.today/i).length).toBeGreaterThan(0);
  });

  it("shows fallback matches immediately while Wayback is still pending", async () => {
    storageGetMock.mockResolvedValue({
      "pastPage.settings": {
        ...DEFAULT_SETTINGS,
        resolverSuccessBehavior: "keep-resolver"
      }
    });
    let resolveWayback: (value: unknown) => void = () => {};
    const delayedWayback = new Promise((resolve) => {
      resolveWayback = resolve;
    });
    let resolveArquivoPt: (value: unknown) => void = () => {};
    const delayedArquivoPt = new Promise((resolve) => {
      resolveArquivoPt = resolve;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const host = new URL(url).hostname;

        if (host.includes("web.archive.org")) {
          return delayedWayback;
        }

        if (host.includes("archive.ph")) {
          return url.includes("/timemap/")
            ? {
                ok: true,
                status: 200,
                text: vi
                  .fn()
                  .mockResolvedValue(
                    `<https://archive.ph/20240203040506/https://example.com/missing>; rel="memento"; datetime="Sat, 03 Feb 2024 04:05:06 GMT"`
                  )
              }
            : archiveHtmlResponse("Archive.today");
        }

        if (host.includes("ghostarchive.org")) {
          return url.includes("/search?")
            ? {
                ok: true,
                status: 200,
                text: vi.fn().mockResolvedValue(`
                  <table>
                    <tr><td></td><td><a href="/archive/new1">https://example.com/missing</a></td><td>Sat, 15 Jun 2024 12:00:00 GMT</td><td>Archived webpage</td></tr>
                  </table>
                `)
              }
            : archiveHtmlResponse("Ghostarchive");
        }

        if (host.includes("arquivo.pt")) {
          return delayedArquivoPt;
        }

        if (host.includes("api.perma.cc")) {
          return { ok: true, status: 200, json: vi.fn().mockResolvedValue({ objects: [] }) };
        }

        if (host.includes("megalodon.jp")) {
          return {
            ok: true,
            status: 200,
            text: vi.fn().mockResolvedValue("<html><body>none</body></html>")
          };
        }

        throw new Error(`unhandled host ${host}`);
      })
    );
    const createSpy = vi.mocked(browser.tabs.create);
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fexample.com%2Fmissing&kind=http&statusCode=404"
    );

    render(<ResolverApp />);

    await waitFor(() =>
      expect(screen.getByText(/Archived version found on Archive\.today/i)).toBeInTheDocument()
    );
    expect(screen.getAllByText(/Ghostarchive/i).length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith({
        url: "https://archive.ph/20240203040506/https://example.com/missing",
        active: true,
        openerTabId: undefined
      })
    );
    expect(
      createSpy.mock.calls.filter(
        ([options]) => options.url === "https://archive.ph/20240203040506/https://example.com/missing"
      )
    ).toHaveLength(1);

    resolveWayback({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([["timestamp", "original", "mimetype", "statuscode", "digest", "length"]])
    });

    resolveArquivoPt({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ items: [] })
    });

    await waitFor(() =>
      expect(screen.queryByText(/Continuing to check other archive providers/i)).not.toBeInTheDocument()
    );
  });

  it("shows unresolved archive providers as additional sources after a Wayback hit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const host = new URL(url).hostname;

        if (host.includes("web.archive.org")) {
          return url.includes("/web/")
            ? archiveHtmlResponse("Wayback")
            : {
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue([
                  ["timestamp", "original", "mimetype", "statuscode", "digest", "length"],
                  ["20170119233731", "https://www.whitehouse.gov/the-record/climate", "text/html", "200", "digest", "120"]
                ])
              };
        }

        if (host.includes("archive.ph")) {
          return { ok: true, status: 200, text: vi.fn().mockResolvedValue("<html><head><title>archive.ph</title></head><body>challenge</body></html>") };
        }

        if (host.includes("webarchive.loc.gov")) {
          throw new Error("Challenge page");
        }

        if (host.includes("ghostarchive.org") || host.includes("megalodon.jp")) {
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
      })
    );
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fwww.whitehouse.gov%2Fthe-record%2Fclimate&kind=http&statusCode=404"
    );

    render(<ResolverApp />);

    await waitFor(() => expect(screen.getByText(/Check Other archive sources/i)).toBeInTheDocument());
    expect(screen.getAllByText(/Archive.today/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Library of Congress Web Archives/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Provider link/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Check on Archive.today/i)).toBeInTheDocument();
  });

  it("shows the actual cleaned URL step only when it is checked", async () => {
    let resolveSecondLookup: (value: unknown) => void = () => {};
    const secondLookup = new Promise((resolve) => {
      resolveSecondLookup = resolve;
    });
    let waybackCalls = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const host = new URL(url).hostname;

        if (host.includes("web.archive.org")) {
          waybackCalls += 1;
          if (waybackCalls === 1) {
            return {
              ok: true,
              status: 200,
              json: vi.fn().mockResolvedValue([["timestamp", "original", "mimetype", "statuscode", "digest", "length"]])
            };
          }
          return secondLookup;
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
      })
    );
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fexample.com%2Fmissing%3Futm_source%3Dtest&kind=http&statusCode=404"
    );

    render(<ResolverApp />);

    await waitFor(() => expect(screen.queryByText(/original URL/i)).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/cleaned URL/i)).toBeInTheDocument());
    resolveSecondLookup({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([["timestamp", "original", "mimetype", "statuscode", "digest", "length"]])
    });
  });

  it("rotates through the provider checks that have already started", async () => {
    vi.useFakeTimers();

    let resolveWayback: (value: unknown) => void = () => {};
    const delayedWayback = new Promise((resolve) => {
      resolveWayback = resolve;
    });
    let resolveArchiveToday: (value: unknown) => void = () => {};
    const delayedArchiveToday = new Promise((resolve) => {
      resolveArchiveToday = resolve;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const host = new URL(url).hostname;

        if (host.includes("web.archive.org")) {
          return delayedWayback;
        }

        if (host.includes("archive.ph")) {
          return delayedArchiveToday;
        }

        if (host.includes("megalodon.jp") || host.includes("ghostarchive.org")) {
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
      })
    );
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fexample.co.jp%2Fmissing&kind=http&statusCode=404"
    );

    render(<ResolverApp />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(screen.getAllByText(/Checking /i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Check on Megalodon\/Web Gyotaku/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(550);
    });

    expect(screen.getAllByText(/Checking /i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Check on Megalodon\/Web Gyotaku/i)).toBeInTheDocument();

    resolveWayback({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([["timestamp", "original", "mimetype", "statuscode", "digest", "length"]])
    });
    resolveArchiveToday({ ok: true, status: 200, text: vi.fn().mockResolvedValue("") });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    vi.useRealTimers();
  });

  it("keeps rotating through parallel-started providers while Wayback is still hanging", async () => {
    vi.useFakeTimers();

    let resolveWayback: (value: unknown) => void = () => {};
    const delayedWayback = new Promise((resolve) => {
      resolveWayback = resolve;
    });
    let resolveArchiveToday: (value: unknown) => void = () => {};
    const delayedArchiveToday = new Promise((resolve) => {
      resolveArchiveToday = resolve;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const host = new URL(url).hostname;

        if (host.includes("web.archive.org")) {
          return delayedWayback;
        }

        if (host.includes("archive.ph")) {
          return delayedArchiveToday;
        }

        if (host.includes("ghostarchive.org") || host.includes("megalodon.jp")) {
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
      })
    );
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fexample.com%2Fmissing&kind=http&statusCode=404"
    );

    render(<ResolverApp />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(screen.getAllByText(/Checking /i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Check on Ghostarchive/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(screen.getAllByText(/Checking /i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Check on Ghostarchive/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(screen.getAllByText(/Checking /i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Check on Ghostarchive/i)).toBeInTheDocument();

    resolveWayback({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([["timestamp", "original", "mimetype", "statuscode", "digest", "length"]])
    });
    resolveArchiveToday({ ok: true, status: 200, text: vi.fn().mockResolvedValue("") });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    vi.useRealTimers();
  });

  it("updates the existing history entry when a lookup resolves", async () => {
    const store: Record<string, unknown> = {
      "pastPage.settings": DEFAULT_SETTINGS,
      "pastPage.history": [
        {
          id: "hist_123",
          startedAt: Date.parse("2024-01-02T03:04:05Z"),
          targetUrl: "https://example.com/missing",
          trigger: "broken-page",
          requestTrigger: "broken-page",
          outcome: "unknown",
          resultSnapshots: []
        }
      ]
    };
    storageGetMock.mockImplementation(async (key?: string | string[] | null) => {
      if (typeof key === "string") return { [key]: store[key] };
      return { ...store };
    });
    (browser.storage.local.set as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (next: Record<string, unknown>) => {
        Object.assign(store, next);
      }
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const host = new URL(url).hostname;

        if (host.includes("web.archive.org")) {
          return url.includes("/web/")
            ? archiveHtmlResponse("Wayback")
            : {
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue([
                  ["timestamp", "original", "mimetype", "statuscode", "digest", "length"],
                  ["20240102030405", "https://example.com/missing", "text/html", "200", "digest", "120"]
                ])
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
      })
    );
    window.history.replaceState(
      {},
      "",
      "?trigger=broken-page&url=https%3A%2F%2Fexample.com%2Fmissing&kind=http&statusCode=404&historyId=hist_123"
    );

    render(<ResolverApp />);

    await waitFor(() => expect(screen.getByText(/Archived version found/i)).toBeInTheDocument());
    const history = store["pastPage.history"] as Array<Record<string, unknown>>;
    expect(history[0]?.outcome).toBe("hit");
    expect(Array.isArray(history[0]?.resultSnapshots)).toBe(true);
    expect((history[0]?.resultSnapshots as unknown[]).length).toBeGreaterThan(0);
  });
});
