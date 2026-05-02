import { beforeEach, describe, expect, it, vi } from "vitest";
import { openArchiveUrl } from "@/platform/archiveNavigation";

describe("openArchiveUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the current tab when requested", async () => {
    await openArchiveUrl("https://web.archive.org/web/*/https://example.com", "current-tab", 7);

    expect(browser.tabs.update).toHaveBeenCalledWith(7, {
      url: "https://web.archive.org/web/*/https://example.com"
    });
  });

  it("opens a background tab when requested", async () => {
    await openArchiveUrl("https://archive.ph/newest/https://example.com", "new-tab-background", 3);

    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: "https://archive.ph/newest/https://example.com",
      active: false,
      openerTabId: 3
    });
  });

  it("opens a foreground tab when requested", async () => {
    await openArchiveUrl("https://web.archive.org/web/*/https://example.com", "new-tab-foreground", 5);

    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: "https://web.archive.org/web/*/https://example.com",
      active: true,
      openerTabId: 5
    });
  });

  it("opens a new window when requested", async () => {
    await openArchiveUrl("https://ghostarchive.org/search?term=https://example.com", "new-window");

    expect(browser.windows.create).toHaveBeenCalledWith({
      url: "https://ghostarchive.org/search?term=https://example.com",
      focused: true
    });
  });
});
