import { beforeEach, describe, expect, it, vi } from "vitest";

describe("background onboarding install flow", () => {
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
    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: "moz-extension://test//onboarding.html",
      active: true
    });

    vi.mocked(browser.tabs.create).mockClear();
    onInstalled?.({ reason: "update" });
    expect(browser.tabs.create).not.toHaveBeenCalled();
  });
});
