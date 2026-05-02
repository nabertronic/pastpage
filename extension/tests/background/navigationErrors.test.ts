import { beforeEach, describe, expect, it, vi } from "vitest";

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("background navigation errors", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("defineBackground", (listener: () => void) => listener);
  });

  it("ignores aborted top-level navigations", async () => {
    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();

    const onErrorOccurred = vi.mocked(browser.webRequest.onErrorOccurred.addListener).mock.calls[0]?.[0] as
      | ((details: unknown) => void)
      | undefined;

    expect(onErrorOccurred).toBeTypeOf("function");

    onErrorOccurred?.({
      tabId: 1,
      type: "main_frame",
      url: "https://www.blackmagazin.com/",
      error: "net::ERR_ABORTED"
    } as unknown);

    await flushPromises();

    expect(browser.tabs.create).not.toHaveBeenCalled();
  });

  it("ignores generic connection failures to avoid false positives", async () => {
    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();

    const onErrorOccurred = vi.mocked(browser.webRequest.onErrorOccurred.addListener).mock.calls[0]?.[0] as
      | ((details: unknown) => void)
      | undefined;

    expect(onErrorOccurred).toBeTypeOf("function");

    onErrorOccurred?.({
      tabId: 1,
      type: "main_frame",
      url: "https://de.wikipedia.org/wiki/Black_(Musiker)",
      error: "net::ERR_CONNECTION_CLOSED"
    } as unknown);

    await flushPromises();

    expect(browser.tabs.create).not.toHaveBeenCalled();
  });

  it("opens the fallback page in a new tab for genuine top-level network failures", async () => {
    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();

    const onErrorOccurred = vi.mocked(browser.webRequest.onErrorOccurred.addListener).mock.calls[0]?.[0] as
      | ((details: unknown) => void)
      | undefined;

    expect(onErrorOccurred).toBeTypeOf("function");

    onErrorOccurred?.({
      tabId: 1,
      type: "main_frame",
      url: "https://www.blackmagazin.com/",
      error: "net::ERR_NAME_NOT_RESOLVED"
    } as unknown);

    await flushPromises();
    await flushPromises();

    expect(browser.tabs.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(browser.tabs.create).mock.calls[0]?.[0]).toMatchObject({
      url: expect.stringContaining("fallback.html?url=https%3A%2F%2Fwww.blackmagazin.com%2F"),
      active: true,
      openerTabId: 1
    });
  });
});
