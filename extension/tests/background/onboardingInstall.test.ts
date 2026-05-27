import { beforeEach, describe, expect, it, vi } from "vitest";

describe("background onboarding install flow", () => {
  const storageGetMock = browser.storage.local.get as unknown as ReturnType<typeof vi.fn>;
  const storageSetMock = browser.storage.local.set as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("defineBackground", (listener: () => void) => listener);
  });

  it("opens the onboarding page on first install only", async () => {
    const background = await import("../../entrypoints/background");
    (background.default as unknown as () => void)();

    const onInstalled = vi.mocked(browser.runtime.onInstalled.addListener).mock.calls[0]?.[0] as
      | ((details: { reason: string }) => void)
      | undefined;

    expect(onInstalled).toBeTypeOf("function");

    onInstalled?.({ reason: "install" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(browser.tabs.create).toHaveBeenNthCalledWith(1, {
      url: "moz-extension://test//onboarding.html",
      active: true
    });
    expect(browser.tabs.create).toHaveBeenNthCalledWith(2, {
      url: "moz-extension://test//whats-new.html",
      active: false
    });
    expect(storageSetMock).toHaveBeenCalledWith({
      "pastPage.meta": { lastSeenWhatsNewVersion: "1.0.3" }
    });

    vi.mocked(browser.tabs.create).mockClear();
    storageGetMock.mockResolvedValue({});
    onInstalled?.({ reason: "update" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: "moz-extension://test//whats-new.html",
      active: true
    });

    vi.mocked(browser.tabs.create).mockClear();
    storageGetMock.mockResolvedValue({
      "pastPage.meta": { lastSeenWhatsNewVersion: "1.0.3" }
    });
    onInstalled?.({ reason: "update" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(browser.tabs.create).not.toHaveBeenCalled();
  });
});
