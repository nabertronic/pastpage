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
