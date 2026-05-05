import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PopupApp } from "@/components/PopupApp";
import { explainHttpStatus } from "@/core/errors";
import { DEFAULT_SETTINGS } from "@/core/settings";

describe("PopupApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.close = vi.fn();
    (browser.tabs.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 1, url: "https://example.com/story" }]);
    (browser.storage.local.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it("shows the current popup copy and footer links", async () => {
    (browser.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      state: { status: "idle" }
    });

    render(<PopupApp />);

    expect(await screen.findByText("Find archived versions of pages.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tab" })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /check archived versions/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open all archives in tabs/i })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Wayback Machine" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Megalodon" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Web Gyotaku/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Perma.cc" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /github/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /history/i })).toBeInTheDocument();
  });

  it("lets you enter a custom URL and uses it for the resolver flow", async () => {
    const sendMessage = browser.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessage.mockResolvedValueOnce({ state: { status: "idle" } });
    sendMessage.mockResolvedValueOnce({ ok: true });

    render(<PopupApp />);

    await userEvent.click(await screen.findByRole("button", { name: "Tab" }));
    await userEvent.click(screen.getByRole("button", { name: "URL" }));
    await userEvent.type(screen.getByRole("textbox"), "https://custom.example.com/report");
    await userEvent.click(screen.getByRole("button", { name: /check archived versions/i }));

    expect(sendMessage).toHaveBeenNthCalledWith(2, {
      type: "START_RESOLVER",
      tabId: 1,
      historyTrigger: "manual-page",
      request: {
        trigger: "manual-page",
        originalUrl: "https://custom.example.com/report"
      }
    });
  });

  it("accepts a custom URL without protocol", async () => {
    const sendMessage = browser.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessage.mockResolvedValueOnce({ state: { status: "idle" } });
    sendMessage.mockResolvedValueOnce({ ok: true });

    render(<PopupApp />);

    await userEvent.click(await screen.findByRole("button", { name: "Tab" }));
    await userEvent.click(screen.getByRole("button", { name: "URL" }));
    await userEvent.type(screen.getByRole("textbox"), "custom.example.com/report");
    await userEvent.click(screen.getByRole("button", { name: /check archived versions/i }));

    expect(sendMessage).toHaveBeenNthCalledWith(2, {
      type: "START_RESOLVER",
      tabId: 1,
      historyTrigger: "manual-page",
      request: {
        trigger: "manual-page",
        originalUrl: "https://custom.example.com/report"
      }
    });
  });

  it("shows broken-page recovery details when the current tab is broken", async () => {
    (browser.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      state: {
        status: "broken",
        error: {
          kind: "http",
          originalUrl: "https://example.com/missing",
          statusCode: 404,
          explanation: explainHttpStatus(404),
          detectedAt: 1
        },
        lookup: { status: "idle" }
      }
    });

    render(<PopupApp />);

    expect(await screen.findByText(/404: Page not found/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /find archived version/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wayback Machine" })).toBeInTheDocument();
  });

  it("starts a manual lookup for a healthy page", async () => {
    const sendMessage = browser.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessage.mockResolvedValueOnce({ state: { status: "idle" } });
    sendMessage.mockResolvedValueOnce({ ok: true });

    render(<PopupApp />);

    await userEvent.click(await screen.findByRole("button", { name: /check archived versions/i }));

    expect(sendMessage).toHaveBeenNthCalledWith(2, {
      type: "START_RESOLVER",
      tabId: 1,
      historyTrigger: "manual-page",
      request: {
        trigger: "manual-page",
        originalUrl: "https://example.com/story"
      }
    });
  });

  it("shows an ineligible-page message for unsupported tabs", async () => {
    (browser.tabs.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 1, url: "chrome://extensions" }]);
    (browser.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      state: { status: "idle" }
    });

    render(<PopupApp />);

    expect(await screen.findByText(/Archived lookup is not available for this tab/i)).toBeInTheDocument();
    expect(screen.getByText(/Only HTTP and HTTPS URLs are supported/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /check archived versions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Wayback Machine" })).not.toBeInTheDocument();
  });

  it("shows a validation message for an invalid custom URL", async () => {
    (browser.tabs.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 1, url: "chrome://extensions" }]);
    (browser.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      state: { status: "idle" }
    });

    render(<PopupApp />);

    await userEvent.click(await screen.findByRole("button", { name: "Tab" }));
    await userEvent.click(screen.getByRole("button", { name: "URL" }));
    await userEvent.type(screen.getByRole("textbox"), "notaurl");

    expect(screen.queryByText("Enter a valid archive URL")).not.toBeInTheDocument();
    expect(screen.queryByText(/invalid url/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /check archived versions/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /open all archives in tabs/i })).toBeDisabled();
  });

  it("shows disabled archive actions on the custom URL view before input is usable", async () => {
    (browser.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      state: { status: "idle" }
    });

    render(<PopupApp />);

    await userEvent.click(await screen.findByRole("button", { name: "Tab" }));
    await userEvent.click(screen.getByRole("button", { name: "URL" }));

    expect(screen.getByRole("button", { name: /check archived versions/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /open all archives in tabs/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Wayback Machine" })).toBeDisabled();
  });

  it("hides the archive list when disabled in settings", async () => {
    (browser.storage.local.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      "pastPage.settings": {
        ...DEFAULT_SETTINGS,
        popupArchiveListEnabled: false
      }
    });
    (browser.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      state: { status: "idle" }
    });

    render(<PopupApp />);

    expect(await screen.findByRole("button", { name: /check archived versions/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Wayback Machine" })).not.toBeInTheDocument();
  });

  it("hides provider icons when disabled in settings", async () => {
    (browser.storage.local.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      "pastPage.settings": {
        ...DEFAULT_SETTINGS,
        showSearchEngineIcons: false
      }
    });
    (browser.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      state: { status: "idle" }
    });

    render(<PopupApp />);

    expect(await screen.findByRole("button", { name: "Wayback Machine" })).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("hides deselected archives from the popup list", async () => {
    (browser.storage.local.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      "pastPage.settings": {
        ...DEFAULT_SETTINGS,
        enabledProviders: DEFAULT_SETTINGS.enabledProviders.filter((providerId) => providerId !== "wayback")
      }
    });
    (browser.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      state: { status: "idle" }
    });

    render(<PopupApp />);

    expect(await screen.findByRole("button", { name: "Ghostarchive" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Wayback Machine" })).not.toBeInTheDocument();
  });

  it("uses the configured archive order in the popup list", async () => {
    (browser.storage.local.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      "pastPage.settings": {
        ...DEFAULT_SETTINGS,
        enabledProviders: [...DEFAULT_SETTINGS.enabledProviders, "perma-cc"],
        archiveDisplayOrder: [
          "perma-cc",
          "wayback",
          ...DEFAULT_SETTINGS.archiveDisplayOrder.filter((providerId) => !["perma-cc", "wayback"].includes(providerId))
        ]
      }
    });
    (browser.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      state: { status: "idle" }
    });

    render(<PopupApp />);

    const manualSection = (await screen.findByRole("button", { name: "Wayback Machine" })).closest("section");
    const archiveButtons = within(manualSection as HTMLElement)
      .getAllByRole("button")
      .map((button) => button.textContent?.trim())
      .filter(Boolean);

    expect(archiveButtons.slice(0, 2)).toEqual(["Perma.cc", "Wayback Machine"]);
  });

  it("opens a specific archive directly from the popup list", async () => {
    (browser.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      state: { status: "idle" }
    });

    render(<PopupApp />);

    await userEvent.click(await screen.findByRole("button", { name: "Wayback Machine" }));

    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: "https://web.archive.org/web/*/https://example.com/story",
      active: true,
      openerTabId: 1
    });
    expect(window.close).toHaveBeenCalled();
  });

  it("uses the custom URL for direct archive buttons", async () => {
    (browser.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      state: { status: "idle" }
    });

    render(<PopupApp />);

    await userEvent.click(await screen.findByRole("button", { name: "Tab" }));
    await userEvent.click(screen.getByRole("button", { name: "URL" }));
    await userEvent.type(screen.getByRole("textbox"), "https://custom.example.com/report");
    await userEvent.click(screen.getByRole("button", { name: "Wayback Machine" }));

    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: "https://web.archive.org/web/*/https://custom.example.com/report",
      active: true,
      openerTabId: 1
    });
  });

  it("opens a provider-scoped resolver from the popup list for Perma.cc", async () => {
    (browser.storage.local.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      "pastPage.settings": {
        ...DEFAULT_SETTINGS,
        enabledProviders: [...DEFAULT_SETTINGS.enabledProviders, "perma-cc"]
      }
    });
    (browser.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      state: { status: "idle" }
    });

    render(<PopupApp />);

    await userEvent.click(await screen.findByRole("button", { name: "Perma.cc" }));

    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: expect.stringContaining(
        "moz-extension://test//resolver.html?url=https%3A%2F%2Fexample.com%2Fstory&trigger=manual-page&sourceTabId=1&providerId=perma-cc"
      ),
      active: true,
      openerTabId: 1
    });
    expect(window.close).toHaveBeenCalled();
  });

  it("opens all archives in separate tabs from the popup", async () => {
    (browser.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      state: { status: "idle" }
    });

    render(<PopupApp />);

    await userEvent.click(await screen.findByRole("button", { name: /open all archives in tabs/i }));

    expect(browser.tabs.create).toHaveBeenNthCalledWith(1, {
      url: "https://web.archive.org/web/*/https://example.com/story",
      active: true,
      openerTabId: 1
    });
    expect(
      vi.mocked(browser.tabs.create).mock.calls.map(([call]) => call.url)
    ).not.toContainEqual(
      expect.stringContaining(
        "moz-extension://test//resolver.html?url=https%3A%2F%2Fexample.com%2Fstory&trigger=manual-page&sourceTabId=1&providerId=perma-cc"
      )
    );
    expect(window.close).toHaveBeenCalled();
  });

  it("opens the extension settings page in a normal tab", async () => {
    (browser.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      state: { status: "idle" }
    });

    render(<PopupApp />);

    await userEvent.click(await screen.findByRole("button", { name: /settings/i }));

    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: "moz-extension://test//options.html",
      active: true
    });
    expect(browser.runtime.openOptionsPage).not.toHaveBeenCalled();
  });

  it("opens the history page in a normal tab", async () => {
    (browser.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      state: { status: "idle" }
    });

    render(<PopupApp />);

    await userEvent.click(await screen.findByRole("link", { name: /history/i }));

    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: "moz-extension://test//history.html",
      active: true
    });
    expect(window.close).toHaveBeenCalled();
  });
});
