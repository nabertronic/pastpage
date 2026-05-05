import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/core/settings";

const contextMenusApi = browser.contextMenus as typeof browser.contextMenus & {
  onShown?: { addListener: ReturnType<typeof vi.fn> };
  refresh?: ReturnType<typeof vi.fn>;
};

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function expectResolverUrl(
  actualUrl: string,
  expectedParams: Record<string, string>,
  expectedHistoryId = true
) {
  const parsed = new URL(actualUrl);

  expect(actualUrl.startsWith("moz-extension://test//resolver.html?")).toBe(true);
  for (const [key, value] of Object.entries(expectedParams)) {
    expect(parsed.searchParams.get(key)).toBe(value);
  }
  if (expectedHistoryId) {
    expect(parsed.searchParams.get("historyId")).toMatch(/^hist_/);
  } else {
    expect(parsed.searchParams.has("historyId")).toBe(false);
  }
}

describe("background context menus", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("defineBackground", (listener: () => void) => listener);

    let firstRemoveAllResolve: (() => void) | undefined;
    let removeAllCallCount = 0;

    vi.mocked(browser.contextMenus.removeAll).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          removeAllCallCount += 1;
          if (removeAllCallCount === 1) {
            firstRemoveAllResolve = resolve;
            return;
          }

          resolve();
        })
    );

    vi.mocked(browser.contextMenus.create).mockImplementation((_, callback) => {
      callback?.();
      return undefined as never;
    });

    Object.assign(globalThis, {
      __releaseFirstContextMenuRemoveAll: () => firstRemoveAllResolve?.()
    });
  });

  it("serializes overlapping context menu rebuilds", async () => {
    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();
    await flushPromises();

    const onInstalled = vi.mocked(browser.runtime.onInstalled.addListener).mock.calls[0]?.[0] as
      | ((details: { reason: string }) => void)
      | undefined;

    expect(onInstalled).toBeTypeOf("function");
    expect(browser.contextMenus.removeAll).toHaveBeenCalledTimes(1);

    onInstalled?.({ reason: "update" });
    await flushPromises();

    expect(browser.contextMenus.removeAll).toHaveBeenCalledTimes(1);

    (
      globalThis as typeof globalThis & {
        __releaseFirstContextMenuRemoveAll?: () => void;
      }
    ).__releaseFirstContextMenuRemoveAll?.();

    await flushPromises();
    await flushPromises();

    expect(browser.contextMenus.removeAll).toHaveBeenCalledTimes(2);
  });

  it("starts the resolver for the active tab when the browser command fires", async () => {
    (browser.tabs.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 9, url: "https://example.com/story" }
    ]);

    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();
    await flushPromises();

    const onCommand = vi.mocked(browser.commands.onCommand.addListener).mock.calls[0]?.[0] as
      | ((command: string) => void)
      | undefined;

    expect(onCommand).toBeTypeOf("function");

    onCommand?.("start-resolver-current-page");
    await flushPromises();

    expect(browser.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        active: false,
        openerTabId: 9
      })
    );
    expectResolverUrl(
      vi.mocked(browser.tabs.create).mock.calls[0]?.[0]?.url as string,
      {
        url: "https://example.com/story",
        trigger: "manual-page",
        sourceTabId: "9"
      }
    );
  });

  it("opens a provider-scoped resolver for Perma.cc context-menu clicks", async () => {
    (browser.storage.local.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      "pastPage.settings": {
        ...DEFAULT_SETTINGS,
        enabledProviders: [...DEFAULT_SETTINGS.enabledProviders, "perma-cc"]
      }
    });
    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();
    await flushPromises();

    const onClicked = vi.mocked(browser.contextMenus.onClicked.addListener).mock.calls[0]?.[0] as
      | ((info: { menuItemId: string; pageUrl?: string }, tab?: { id?: number; url?: string }) => void)
      | undefined;

    expect(onClicked).toBeTypeOf("function");

    onClicked?.(
      { menuItemId: "provider:perma-cc", pageUrl: "https://example.com/story" },
      { id: 7, url: "https://example.com/story" }
    );
    await flushPromises();

    expect(browser.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        active: true,
        openerTabId: 7
      })
    );
    expectResolverUrl(
      vi.mocked(browser.tabs.create).mock.calls[0]?.[0]?.url as string,
      {
        url: "https://example.com/story",
        trigger: "manual-page",
        sourceTabId: "7",
        providerId: "perma-cc"
      }
    );
  });

  it("prefers the clicked link target over the current page URL", async () => {
    (browser.storage.local.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      "pastPage.settings": {
        ...DEFAULT_SETTINGS,
        enabledProviders: [...DEFAULT_SETTINGS.enabledProviders, "perma-cc"]
      }
    });
    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();
    await flushPromises();

    const onClicked = vi.mocked(browser.contextMenus.onClicked.addListener).mock.calls[0]?.[0] as
      | ((info: { menuItemId: string; linkUrl?: string; pageUrl?: string }, tab?: { id?: number; url?: string }) => void)
      | undefined;

    expect(onClicked).toBeTypeOf("function");

    onClicked?.(
      {
        menuItemId: "provider:perma-cc:link",
        linkUrl: "https://target.example.com/article",
        pageUrl: "https://source.example.com/index"
      },
      { id: 7, url: "https://source.example.com/index" }
    );
    await flushPromises();

    expect(browser.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        active: true,
        openerTabId: 7
      })
    );
    expectResolverUrl(
      vi.mocked(browser.tabs.create).mock.calls[0]?.[0]?.url as string,
      {
        url: "https://target.example.com/article",
        trigger: "manual-page",
        sourceTabId: "7",
        providerId: "perma-cc"
      }
    );
  });

  it("prefers a selected text URL over the current page URL", async () => {
    (browser.storage.local.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      "pastPage.settings": {
        ...DEFAULT_SETTINGS,
        enabledProviders: [...DEFAULT_SETTINGS.enabledProviders, "perma-cc"]
      }
    });
    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();
    await flushPromises();

    const onClicked = vi.mocked(browser.contextMenus.onClicked.addListener).mock.calls[0]?.[0] as
      | ((info: { menuItemId: string; selectionText?: string; pageUrl?: string }, tab?: { id?: number; url?: string }) => void)
      | undefined;

    expect(onClicked).toBeTypeOf("function");

    onClicked?.(
      {
        menuItemId: "provider:perma-cc:selection",
        selectionText: "https://quoted.example.com/story).",
        pageUrl: "https://source.example.com/index"
      },
      { id: 7, url: "https://source.example.com/index" }
    );
    await flushPromises();

    expect(browser.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        active: true,
        openerTabId: 7
      })
    );
    expectResolverUrl(
      vi.mocked(browser.tabs.create).mock.calls[0]?.[0]?.url as string,
      {
        url: "https://quoted.example.com/story",
        trigger: "manual-page",
        sourceTabId: "7",
        providerId: "perma-cc"
      }
    );
  });

  it("hides irrelevant provider items for selected URLs", async () => {
    (browser.storage.local.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      "pastPage.settings": {
        ...DEFAULT_SETTINGS,
        enabledProviders: [...DEFAULT_SETTINGS.enabledProviders, "perma-cc"]
      }
    });
    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();
    await flushPromises();

    const onShown = vi.mocked(contextMenusApi.onShown!.addListener).mock.calls[0]?.[0] as
      | ((info: { contexts?: string[]; selectionText?: string }, tab?: { id?: number; url?: string }) => void)
      | undefined;

    expect(onShown).toBeTypeOf("function");

    onShown?.(
      {
        contexts: ["selection"],
        selectionText: "https://example.com/article"
      },
      { id: 7, url: "https://webcache.example/view" }
    );
    await flushPromises();
    await flushPromises();

    expect(browser.contextMenus.update).toHaveBeenCalledWith(
      "provider:uk-gov-web-archive:selection",
      { visible: false },
      expect.any(Function)
    );
    expect(browser.contextMenus.update).toHaveBeenCalledWith(
      "provider:perma-cc:selection",
      { visible: true },
      expect.any(Function)
    );
    expect(contextMenusApi.refresh).toHaveBeenCalled();
  });

  it("hides irrelevant provider items for right-clicked links", async () => {
    (browser.storage.local.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      "pastPage.settings": {
        ...DEFAULT_SETTINGS,
        enabledProviders: [...DEFAULT_SETTINGS.enabledProviders, "perma-cc"]
      }
    });
    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();
    await flushPromises();

    const onShown = vi.mocked(contextMenusApi.onShown!.addListener).mock.calls[0]?.[0] as
      | ((info: { contexts?: string[]; linkUrl?: string; pageUrl?: string }, tab?: { id?: number; url?: string }) => void)
      | undefined;

    expect(onShown).toBeTypeOf("function");

    onShown?.(
      {
        contexts: ["link"],
        linkUrl: "https://example.com/article",
        pageUrl: "https://archive.example/view"
      },
      { id: 7, url: "https://archive.example/view" }
    );
    await flushPromises();
    await flushPromises();

    expect(browser.contextMenus.update).toHaveBeenCalledWith(
      "provider:uk-gov-web-archive:link",
      { visible: false },
      expect.any(Function)
    );
    expect(browser.contextMenus.update).toHaveBeenCalledWith(
      "provider:perma-cc:link",
      { visible: true },
      expect.any(Function)
    );
    expect(contextMenusApi.refresh).toHaveBeenCalled();
  });

  it("opens all enabled archives in tabs from the context menu", async () => {
    (browser.storage.local.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      "pastPage.settings": {
        ...DEFAULT_SETTINGS,
        enabledProviders: [...DEFAULT_SETTINGS.enabledProviders, "perma-cc"]
      }
    });
    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();
    await flushPromises();

    const onClicked = vi.mocked(browser.contextMenus.onClicked.addListener).mock.calls[0]?.[0] as
      | ((info: { menuItemId: string; pageUrl?: string }, tab?: { id?: number; url?: string }) => void)
      | undefined;

    expect(onClicked).toBeTypeOf("function");

    onClicked?.(
      { menuItemId: "open-all-archives-tabs", pageUrl: "https://example.com/story" },
      { id: 7, url: "https://example.com/story" }
    );
    await flushPromises();

    expect(browser.tabs.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        active: true,
        openerTabId: 7
      })
    );
    expectResolverUrl(
      vi.mocked(browser.tabs.create).mock.calls[0]?.[0]?.url as string,
      {
        url: "https://example.com/story",
        trigger: "manual-page",
        sourceTabId: "7",
        providerId: "perma-cc"
      }
    );
    expect(browser.tabs.create).toHaveBeenNthCalledWith(2, {
      url: "https://web.archive.org/web/*/https://example.com/story",
      active: false,
      openerTabId: 7
    });
  });

  it("ignores disabled provider menu clicks", async () => {
    (browser.storage.local.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      "pastPage.settings": {
        enabledProviders: ["wayback"]
      }
    });

    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();
    await flushPromises();
    const onClicked = vi.mocked(browser.contextMenus.onClicked.addListener).mock.calls[0]?.[0] as
      | ((info: { menuItemId: string; pageUrl?: string }, tab?: { id?: number; url?: string }) => void)
      | undefined;

    expect(onClicked).toBeTypeOf("function");

    onClicked?.(
      { menuItemId: "provider:ghostarchive", pageUrl: "https://example.com/story" },
      { id: 7, url: "https://example.com/story" }
    );
    await flushPromises();

    expect(browser.tabs.create).not.toHaveBeenCalled();
  });

  it("uses the configured archive order when rebuilding provider context menus", async () => {
    (browser.storage.local.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      "pastPage.settings": {
        ...DEFAULT_SETTINGS,
        archiveDisplayOrder: [
          "perma-cc",
          "wayback",
          "archive-today",
          "ghostarchive",
          "uk-gov-web-archive",
          "loc-web-archives",
          "arquivo-pt",
          "web-gyotaku",
          "yandex-cache",
          "webcite",
          "software-heritage"
        ],
        enabledProviders: ["perma-cc", "wayback", "archive-today"]
      }
    });

    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();
    await flushPromises();
    (
      globalThis as typeof globalThis & {
        __releaseFirstContextMenuRemoveAll?: () => void;
      }
    ).__releaseFirstContextMenuRemoveAll?.();
    await flushPromises();
    await flushPromises();

    const providerCreateOrder = Array.from(
      new Set(
        vi
          .mocked(browser.contextMenus.create)
          .mock.calls.map(([item]) => item.id)
          .filter((id): id is string => typeof id === "string" && id.startsWith("provider:"))
          .map((id) => id.replace(/:(link|selection)$/, ""))
      )
    );

    expect(providerCreateOrder.slice(0, 3)).toEqual([
      "provider:perma-cc",
      "provider:wayback",
      "provider:archive-today"
    ]);
  });

  it("adds link and selection menu items without document URL restrictions", async () => {
    (browser.storage.local.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      "pastPage.settings": {
        ...DEFAULT_SETTINGS,
        enabledProviders: [...DEFAULT_SETTINGS.enabledProviders, "perma-cc"]
      }
    });
    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();
    await flushPromises();
    (
      globalThis as typeof globalThis & {
        __releaseFirstContextMenuRemoveAll?: () => void;
      }
    ).__releaseFirstContextMenuRemoveAll?.();
    await flushPromises();
    await flushPromises();

    const createCalls = vi.mocked(browser.contextMenus.create).mock.calls.map(([item]) => item);
    const resolverLinkItem = createCalls.find((item) => item.id === "check-archived-versions-link");
    const resolverSelectionItem = createCalls.find((item) => item.id === "check-archived-versions-selection");
    expect(resolverLinkItem?.documentUrlPatterns).toBeUndefined();
    expect(resolverLinkItem?.targetUrlPatterns).toEqual(["http://*/*", "https://*/*"]);
    expect(resolverSelectionItem?.documentUrlPatterns).toBeUndefined();
    const providerLinkItem = createCalls.find((item) => item.id === "provider:perma-cc:link");
    const providerSelectionItem = createCalls.find((item) => item.id === "provider:perma-cc:selection");
    expect(providerLinkItem).toBeDefined();
    expect(providerSelectionItem).toBeDefined();
  });

  it("keeps page-specific menu items restricted to http pages", async () => {
    (browser.storage.local.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      "pastPage.settings": {
        ...DEFAULT_SETTINGS,
        enabledProviders: [...DEFAULT_SETTINGS.enabledProviders, "perma-cc"]
      }
    });
    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();
    await flushPromises();
    (
      globalThis as typeof globalThis & {
        __releaseFirstContextMenuRemoveAll?: () => void;
      }
    ).__releaseFirstContextMenuRemoveAll?.();
    await flushPromises();
    await flushPromises();

    const createCalls = vi.mocked(browser.contextMenus.create).mock.calls.map(([item]) => item);
    const resolverPageItem = createCalls.find((item) => item.id === "check-archived-versions");
    expect(resolverPageItem?.documentUrlPatterns).toEqual(["http://*/*", "https://*/*"]);
    const providerPageItem = createCalls.find((item) => item.id === "provider:perma-cc");
    expect(providerPageItem).toBeDefined();
  });

  it("uses the short Megalodon label in provider context menus", async () => {
    (browser.storage.local.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      "pastPage.settings": {
        enabledProviders: ["web-gyotaku"],
        archiveDisplayOrder: ["web-gyotaku"]
      }
    });

    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();
    await flushPromises();
    (
      globalThis as typeof globalThis & {
        __releaseFirstContextMenuRemoveAll?: () => void;
      }
    ).__releaseFirstContextMenuRemoveAll?.();
    await flushPromises();
    await flushPromises();

    const createCalls = vi.mocked(browser.contextMenus.create).mock.calls.map(([item]) => item);
    const providerPageItem = createCalls.find(
      (item) => item.id === "provider:web-gyotaku" || item.id === "provider:web-gyotaku:link"
    );

    expect(providerPageItem?.title).toBe("Megalodon");
  });

  it("does not restrict the context-menu root to http pages", async () => {
    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();
    await flushPromises();
    (
      globalThis as typeof globalThis & {
        __releaseFirstContextMenuRemoveAll?: () => void;
      }
    ).__releaseFirstContextMenuRemoveAll?.();
    await flushPromises();
    await flushPromises();

    const createCalls = vi.mocked(browser.contextMenus.create).mock.calls.map(([item]) => item);
    const rootItem = createCalls.find((item) => item.id === "pastpage-root");

    expect(rootItem?.documentUrlPatterns).toBeUndefined();
  });
});
