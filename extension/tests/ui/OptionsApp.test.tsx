import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OptionsApp } from "@/components/OptionsApp";
import { FIREFOX_ADDONS_URL } from "@/core/constants";
import { DEFAULT_SETTINGS } from "@/core/settings";

const storageGetMock = browser.storage.local.get as unknown as ReturnType<typeof vi.fn>;
const storageSetMock = browser.storage.local.set as unknown as ReturnType<typeof vi.fn>;
const runtimeSendMessageMock = browser.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;

describe("OptionsApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    storageGetMock.mockResolvedValue({});
    storageSetMock.mockResolvedValue(undefined);
    runtimeSendMessageMock.mockResolvedValue(undefined);
    (browser.runtime.getURL as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (path: string) => `moz-extension://test/${path.replace(/^\//, "")}`
    );
  });

  it("renders key settings", async () => {
    render(<OptionsApp />);

    expect(await screen.findByText("Recovery behavior")).toBeInTheDocument();
    expect(screen.getByText("Recovery behavior")).toBeInTheDocument();
    expect(screen.getByText("Open archived pages")).toBeInTheDocument();
    expect(screen.getByText("Open provider-specific checks")).toBeInTheDocument();
    expect(screen.getByText("Show archive list in popup")).toBeInTheDocument();
    expect(screen.getByText("Show archive icons in popup")).toBeInTheDocument();
    expect(screen.getByText("Show archive icons in context menu")).toBeInTheDocument();
    expect(screen.getByText("Archive settings")).toBeInTheDocument();
    expect(
      screen.getByText(/Some archives only appear for relevant URLs/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Wayback Machine")).toBeInTheDocument();
    expect(screen.getByText("After a snapshot is found")).toBeInTheDocument();
    expect(screen.getByText("URL matching")).toBeInTheDocument();
    expect(screen.getByText("Provider timeout")).toBeInTheDocument();
    expect(screen.getByText("Wayback Machine host")).toBeInTheDocument();
    expect(screen.getByText("Archive.today host")).toBeInTheDocument();
    expect(screen.getByText("Browser shortcuts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage browser shortcuts" })).toBeInTheDocument();
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByText("Custom action color")).toBeInTheDocument();
    expect(screen.getByText("Custom color preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset custom colors" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset to defaults" })).toBeInTheDocument();
    expect(screen.queryByText("Share PastPage")).not.toBeInTheDocument();
    expect(screen.getByText("Version and updates")).toBeInTheDocument();
    expect(screen.getByText("Installed version: 1.0.3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check for updates" })).toBeInTheDocument();
    expect(screen.getByText("Sites to ignore")).toBeInTheDocument();
    expect(screen.getByText("Deutsch")).toBeInTheDocument();
    expect(screen.getByText("Español")).toBeInTheDocument();
    expect(screen.getByText("Français")).toBeInTheDocument();
  }, 10000);

  it("renders sites to ignore at the bottom of recovery behavior", async () => {
    render(<OptionsApp />);

    const recoverySection = (await screen.findByRole("heading", { name: "Recovery behavior" })).closest("section");
    const archiveSection = screen.getByRole("heading", { name: "Archive settings" }).closest("section");
    const sitesToIgnore = screen.getByText("Sites to ignore");
    const archiveTodayHost = screen.getByText("Archive.today host");

    expect(recoverySection).not.toBeNull();
    expect(archiveSection).not.toBeNull();
    expect(recoverySection).toContainElement(sitesToIgnore);
    expect(archiveSection).not.toContainElement(sitesToIgnore);
    expect(archiveTodayHost.compareDocumentPosition(sitesToIgnore) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the context menu icons toggle on Firefox only", async () => {
    (browser.runtime.getURL as unknown as ReturnType<typeof vi.fn>).mockReturnValue("moz-extension://test/");

    const { rerender } = render(<OptionsApp />);

    expect(await screen.findByRole("button", { name: /show archive icons in context menu/i })).toBeInTheDocument();

    (browser.runtime.getURL as unknown as ReturnType<typeof vi.fn>).mockReturnValue("chrome-extension://test/");
    rerender(<OptionsApp />);

    await screen.findByText("Recovery behavior");
    expect(screen.queryByRole("button", { name: /show archive icons in context menu/i })).not.toBeInTheDocument();
  });

  it("shows the correct review listing for each browser when store URLs are configured", async () => {
    (browser.runtime.getURL as unknown as ReturnType<typeof vi.fn>).mockReturnValue("chrome-extension://test/");

    const { rerender } = render(<OptionsApp />);
    const chromeReviewSection = (await screen.findByRole("heading", { name: "Review the extension" })).closest("section");

    expect(chromeReviewSection).not.toBeNull();
    expect(within(chromeReviewSection as HTMLElement).getByRole("link", { name: "Chrome Web Store" })).toHaveAttribute(
      "href",
      "https://chromewebstore.google.com/detail/pastpage-query-10+-web-ar/icpegbecignmplpkjjcegmjmfadpcpoo"
    );
    expect(within(chromeReviewSection as HTMLElement).queryByRole("link", { name: "Firefox Add-ons" })).not.toBeInTheDocument();

    (browser.runtime.getURL as unknown as ReturnType<typeof vi.fn>).mockReturnValue("moz-extension://test/");
    rerender(<OptionsApp />);
    const firefoxReviewSection = (await screen.findByRole("heading", { name: "Review the extension" })).closest("section");

    expect(firefoxReviewSection).not.toBeNull();
    expect(within(firefoxReviewSection as HTMLElement).getByRole("link", { name: "Firefox Add-ons" })).toHaveAttribute(
      "href",
      "https://addons.mozilla.org/en-US/firefox/addon/pastpage-query-10-web-archives/"
    );
    expect(within(firefoxReviewSection as HTMLElement).queryByRole("link", { name: "Chrome Web Store" })).not.toBeInTheDocument();
  });

  it("resets settings after confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    storageGetMock.mockResolvedValue({
      "pastPage.settings": {
        ...DEFAULT_SETTINGS,
        popupArchiveListEnabled: false
      }
    });

    render(<OptionsApp />);
    await screen.findByText("Recovery behavior");
    vi.mocked(browser.storage.local.set).mockClear();

    await userEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));

    expect(confirmSpy).toHaveBeenCalledWith("Reset all settings to their default values?");
    await waitFor(() =>
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "pastPage.settings": DEFAULT_SETTINGS
      })
    );
  });

  it("saves the popup archive list toggle", async () => {
    render(<OptionsApp />);
    await screen.findByText("Recovery behavior");
    vi.mocked(browser.storage.local.set).mockClear();

    await userEvent.click(screen.getByRole("button", { name: /show archive list in popup/i }));

    await waitFor(() =>
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "pastPage.settings": {
          ...DEFAULT_SETTINGS,
          popupArchiveListEnabled: false
        }
      })
    );
  });

  it("saves the popup archive icons toggle", async () => {
    render(<OptionsApp />);
    await screen.findByText("Recovery behavior");
    vi.mocked(browser.storage.local.set).mockClear();

    await userEvent.click(screen.getByRole("button", { name: /show archive icons in popup/i }));

    await waitFor(() =>
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "pastPage.settings": {
          ...DEFAULT_SETTINGS,
          showSearchEngineIcons: false
        }
      })
    );
  });

  it("saves the context menu archive icons toggle", async () => {
    (browser.runtime.getURL as unknown as ReturnType<typeof vi.fn>).mockReturnValue("moz-extension://test/");
    render(<OptionsApp />);
    await screen.findByText("Recovery behavior");
    vi.mocked(browser.storage.local.set).mockClear();

    await userEvent.click(screen.getByRole("button", { name: /show archive icons in context menu/i }));

    await waitFor(() =>
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "pastPage.settings": {
          ...DEFAULT_SETTINGS,
          showContextMenuIcons: false
        }
      })
    );
  });

  it("saves deselected archives", async () => {
    render(<OptionsApp />);
    await screen.findByText("Recovery behavior");
    vi.mocked(browser.storage.local.set).mockClear();

    await userEvent.click(screen.getByText("Ghostarchive"));

    await waitFor(() =>
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "pastPage.settings": {
          ...DEFAULT_SETTINGS,
          enabledProviders: DEFAULT_SETTINGS.enabledProviders.filter((providerId) => providerId !== "ghostarchive")
        }
      })
    );
  });

  it("saves archive reordering from the arrow buttons", async () => {
    render(<OptionsApp />);
    await screen.findByText("Recovery behavior");
    vi.mocked(browser.storage.local.set).mockClear();

    await userEvent.click(screen.getByRole("button", { name: "Move Perma.cc up" }));

    await waitFor(() =>
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "pastPage.settings": {
          ...DEFAULT_SETTINGS,
          archiveDisplayOrder: [
            "wayback",
            "archive-today",
            "ghostarchive",
            "webcite",
            "uk-gov-web-archive",
            "loc-web-archives",
            "arquivo-pt",
            "web-gyotaku",
            "perma-cc",
            "yandex-cache",
            "software-heritage"
          ]
        }
      })
    );
  });

  it("applies and saves the selected light theme", async () => {
    render(<OptionsApp />);
    await screen.findByText("Recovery behavior");
    vi.mocked(browser.storage.local.set).mockClear();

    await userEvent.selectOptions(screen.getByLabelText("Theme"), "light");
    expect(document.documentElement).not.toHaveClass("dark");

    await waitFor(() =>
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "pastPage.settings": {
          ...DEFAULT_SETTINGS,
          themeMode: "light"
        }
      })
    );
  });

  it("saves the selected Archive.today host", async () => {
    render(<OptionsApp />);
    await screen.findByText("Recovery behavior");
    vi.mocked(browser.storage.local.set).mockClear();

    await userEvent.selectOptions(screen.getByLabelText("Archive.today host"), "archive.today");

    await waitFor(() =>
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "pastPage.settings": {
          ...DEFAULT_SETTINGS,
          archiveTodayHost: "archive.today"
        }
      })
    );
  });

  it("saves the manual-only resolver behavior", async () => {
    render(<OptionsApp />);
    await screen.findByText("Recovery behavior");
    vi.mocked(browser.storage.local.set).mockClear();

    await userEvent.selectOptions(screen.getByLabelText("After a snapshot is found"), "manual-open-only");

    await waitFor(() =>
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "pastPage.settings": {
          ...DEFAULT_SETTINGS,
          resolverSuccessBehavior: "manual-open-only"
        }
      })
    );
  });

  it("saves the manual-only resolver behavior", async () => {
    render(<OptionsApp />);
    await screen.findByText("Recovery behavior");
    vi.mocked(browser.storage.local.set).mockClear();

    await userEvent.selectOptions(screen.getByLabelText("After a snapshot is found"), "manual-open-only");

    await waitFor(() =>
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "pastPage.settings": {
          ...DEFAULT_SETTINGS,
          resolverSuccessBehavior: "manual-open-only"
        }
      })
    );
  });

  it("saves the selected Wayback onion host", async () => {
    render(<OptionsApp />);
    await screen.findByText("Recovery behavior");
    vi.mocked(browser.storage.local.set).mockClear();

    await userEvent.selectOptions(
      screen.getByLabelText("Wayback Machine host"),
      "web.archivep75mbjunhxc6x4j5mwjmomyxb573v42baldlqu56ruil2oiad.onion"
    );

    await waitFor(() =>
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "pastPage.settings": {
          ...DEFAULT_SETTINGS,
          waybackHost: "web.archivep75mbjunhxc6x4j5mwjmomyxb573v42baldlqu56ruil2oiad.onion"
        }
      })
    );
  });

  it("saves the provider timeout in seconds", async () => {
    render(<OptionsApp />);
    await screen.findByText("Recovery behavior");
    vi.mocked(browser.storage.local.set).mockClear();

    await userEvent.clear(screen.getByLabelText("Provider timeout"));
    await userEvent.type(screen.getByLabelText("Provider timeout"), "90");

    await waitFor(() =>
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "pastPage.settings": {
          ...DEFAULT_SETTINGS,
          providerTimeoutSeconds: 90
        }
      })
    );
  });

  it("opens Chrome shortcut settings from the shortcuts section", async () => {
    (browser.runtime.getURL as unknown as ReturnType<typeof vi.fn>).mockReturnValue("chrome-extension://test/");
    render(<OptionsApp />);

    await userEvent.click(await screen.findByRole("button", { name: "Manage browser shortcuts" }));

    expect(browser.tabs.create).toHaveBeenCalledWith({ url: "chrome://extensions/shortcuts" });
  });

  it("opens Firefox shortcut settings from the shortcuts section", async () => {
    const browserCommands = browser.commands as typeof browser.commands & {
      openShortcutSettings: ReturnType<typeof vi.fn>;
    };
    (browser.runtime.getURL as unknown as ReturnType<typeof vi.fn>).mockReturnValue("moz-extension://test/");
    render(<OptionsApp />);

    await userEvent.click(await screen.findByRole("button", { name: "Manage browser shortcuts" }));

    expect(browserCommands.openShortcutSettings).toHaveBeenCalledTimes(1);
  });

  it("does not reset settings when confirmation is cancelled", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<OptionsApp />);
    await screen.findByText("Recovery behavior");
    vi.mocked(browser.storage.local.set).mockClear();

    await userEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));

    expect(confirmSpy).toHaveBeenCalledWith("Reset all settings to their default values?");
    expect(browser.storage.local.set).not.toHaveBeenCalled();
  });

  it("checks updates directly on Chrome", async () => {
    (browser.runtime.getURL as unknown as ReturnType<typeof vi.fn>).mockReturnValue("chrome-extension://test/");
    (browser.runtime.requestUpdateCheck as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("update_available");

    render(<OptionsApp />);

    await userEvent.click(await screen.findByRole("button", { name: "Check for updates" }));

    await waitFor(() =>
      expect(browser.runtime.requestUpdateCheck).toHaveBeenCalledTimes(1)
    );
    expect(browser.tabs.create).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/Chrome should download it automatically/i)
    ).toBeInTheDocument();
  });

  it("opens the Firefox add-ons listing for a manual update check", async () => {
    (browser.runtime.getURL as unknown as ReturnType<typeof vi.fn>).mockReturnValue("moz-extension://test/");

    render(<OptionsApp />);

    await userEvent.click(await screen.findByRole("button", { name: "Check for updates" }));

    await waitFor(() =>
      expect(browser.tabs.create).toHaveBeenCalledWith({ url: FIREFOX_ADDONS_URL })
    );
    expect(browser.runtime.requestUpdateCheck).not.toHaveBeenCalled();
    expect(screen.queryByText(/Firefox Add-ons Manager was opened/i)).not.toBeInTheDocument();
  });

  it("saves the history toggle", async () => {
    render(<OptionsApp />);
    await screen.findByText("Recovery behavior");
    vi.mocked(browser.storage.local.set).mockClear();

    await userEvent.click(screen.getByRole("button", { name: /save search history/i }));

    await waitFor(() =>
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "pastPage.settings": {
          ...DEFAULT_SETTINGS,
          historyEnabled: false
        }
      })
    );
  });

  it("renders the history controls and link", async () => {
    render(<OptionsApp />);

    expect(await screen.findByRole("heading", { name: "History" })).toBeInTheDocument();
    expect(screen.getByText(/turn the saved archive search history on or off/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open history page" })).toHaveAttribute(
      "href",
      "moz-extension://test/archive-history.html"
    );
  });

  it("clears history from the history section", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<OptionsApp />);
    await screen.findByRole("heading", { name: "History" });
    vi.mocked(browser.storage.local.set).mockClear();

    await userEvent.click(screen.getByRole("button", { name: "Clear history" }));

    expect(confirmSpy).toHaveBeenCalledWith("Delete the saved archive search history?");
    await waitFor(() =>
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "pastPage.history": []
      })
    );
  });
});
