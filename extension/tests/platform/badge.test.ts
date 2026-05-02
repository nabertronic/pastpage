import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateBadge } from "@/platform/badge";
import { DEFAULT_SETTINGS } from "@/core/settings";
import type { TabState } from "@/core/tabState";

describe("badge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (browser as unknown as {
      action?: {
        setBadgeText: ReturnType<typeof vi.fn>;
        setBadgeBackgroundColor: ReturnType<typeof vi.fn>;
        setBadgeTextColor: ReturnType<typeof vi.fn>;
      };
    }).action = {
      setBadgeText: vi.fn().mockResolvedValue(undefined),
      setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
      setBadgeTextColor: vi.fn().mockResolvedValue(undefined)
    };
  });

  it("falls back to the warning badge when no archive count is available", async () => {
    const storageGetMock = browser.storage.local.get as unknown as { mockResolvedValue: (value: unknown) => void };
    storageGetMock.mockResolvedValue({
      "pastPage.settings": DEFAULT_SETTINGS
    });

    const tabState: TabState = {
      status: "broken",
      error: {
        kind: "http",
        originalUrl: "https://example.com",
        statusCode: 404,
        detectedAt: Date.now(),
        explanation: {
          title: "404",
          short: "Not found",
          detail: "Missing"
        }
      },
      lookup: { status: "idle" }
    };

    await updateBadge(8, tabState);

    expect(browser.action.setBadgeText).toHaveBeenCalledWith({ tabId: 8, text: "!" });
    expect(browser.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ tabId: 8, color: "#b91c1c" });
  });

  it("falls back to browserAction when browser.action is unavailable", async () => {
    const storageGetMock = browser.storage.local.get as unknown as { mockResolvedValue: (value: unknown) => void };
    storageGetMock.mockResolvedValue({
      "pastPage.settings": DEFAULT_SETTINGS
    });

    (browser as unknown as { action?: unknown }).action = undefined;

    await updateBadge(5, { status: "idle" });

    expect(browser.browserAction.setBadgeText).toHaveBeenCalledWith({ tabId: 5, text: "" });
  });
});
