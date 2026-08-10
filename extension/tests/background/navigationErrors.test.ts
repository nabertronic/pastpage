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

  it("does not register an automatic network-error handler", async () => {
    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();

    expect(browser.webRequest.onErrorOccurred.addListener).not.toHaveBeenCalled();
  });

  it("keeps authenticator security checks out of broken-page state", async () => {
    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();
    const onCompleted = vi.mocked(browser.webRequest.onCompleted.addListener).mock.calls[0]?.[0] as
      | ((details: { tabId: number; type: string; statusCode: number; url: string }) => void)
      | undefined;
    const onMessage = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0]?.[0] as
      | ((message: unknown, sender?: unknown) => Promise<unknown>)
      | undefined;

    onCompleted?.({
      tabId: 1,
      type: "main_frame",
      statusCode: 403,
      url: "https://authenticator.cursor.sh/"
    });
    await flushPromises();

    await expect(onMessage?.({ type: "GET_TAB_STATE", tabId: 1 }, {})).resolves.toEqual({
      state: { status: "idle" }
    });
  });

  it("keeps Cloudflare challenge responses on arbitrary hosts out of broken-page state", async () => {
    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();
    const onCompleted = vi.mocked(browser.webRequest.onCompleted.addListener).mock.calls[0]?.[0] as
      | ((details: {
          tabId: number;
          type: string;
          statusCode: number;
          url: string;
          responseHeaders?: Array<{ name: string; value?: string }>;
        }) => void)
      | undefined;
    const onMessage = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0]?.[0] as
      | ((message: unknown, sender?: unknown) => Promise<unknown>)
      | undefined;

    onCompleted?.({
      tabId: 1,
      type: "main_frame",
      statusCode: 403,
      url: "https://site-with-any-hostname.example/protected",
      responseHeaders: [{ name: "cf-mitigated", value: "challenge" }]
    });
    await flushPromises();

    await expect(onMessage?.({ type: "GET_TAB_STATE", tabId: 1 }, {})).resolves.toEqual({
      state: { status: "idle" }
    });
  });

  it("still records ordinary 403 pages as broken", async () => {
    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();
    const onCompleted = vi.mocked(browser.webRequest.onCompleted.addListener).mock.calls[0]?.[0] as
      | ((details: { tabId: number; type: string; statusCode: number; url: string }) => void)
      | undefined;
    const onMessage = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0]?.[0] as
      | ((message: unknown, sender?: unknown) => Promise<unknown>)
      | undefined;

    onCompleted?.({
      tabId: 1,
      type: "main_frame",
      statusCode: 403,
      url: "https://example.com/private"
    });
    await flushPromises();

    const response = await onMessage?.({ type: "GET_TAB_STATE", tabId: 1 }, {});
    expect(response).toMatchObject({
      state: {
        status: "broken",
        error: {
          kind: "http",
          originalUrl: "https://example.com/private",
          statusCode: 403
        }
      }
    });
  });

  it("keeps tab state idle instead of auto-reacting to DNS failures", async () => {
    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();
    const onMessage = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0]?.[0] as
      | ((message: unknown, sender?: unknown) => Promise<unknown>)
      | undefined;

    await flushPromises();

    expect(browser.tabs.create).not.toHaveBeenCalled();
    await expect(onMessage?.({ type: "GET_TAB_STATE", tabId: 1 }, {})).resolves.toEqual({
      state: { status: "idle" }
    });
  });

  it("does not open the fallback page for timeout failures", async () => {
    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();
    const onMessage = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0]?.[0] as
      | ((message: unknown, sender?: unknown) => Promise<unknown>)
      | undefined;

    await flushPromises();

    expect(browser.tabs.create).not.toHaveBeenCalled();
    await expect(onMessage?.({ type: "GET_TAB_STATE", tabId: 1 }, {})).resolves.toEqual({
      state: { status: "idle" }
    });
  });

  it("does not open the fallback page for TLS failures", async () => {
    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();
    const onMessage = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0]?.[0] as
      | ((message: unknown, sender?: unknown) => Promise<unknown>)
      | undefined;

    await flushPromises();

    expect(browser.tabs.create).not.toHaveBeenCalled();
    await expect(onMessage?.({ type: "GET_TAB_STATE", tabId: 1 }, {})).resolves.toEqual({
      state: { status: "idle" }
    });
  });
});
