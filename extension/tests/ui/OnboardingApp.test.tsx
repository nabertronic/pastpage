import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingApp } from "@/components/OnboardingApp";

describe("OnboardingApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (browser.runtime.getURL as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (path: string) => `moz-extension://test/${path}`
    );
    (browser.i18n.getUILanguage as unknown as ReturnType<typeof vi.fn>).mockReturnValue("en-US");
  });

  it("renders Firefox-specific pinning guidance with PastPage branding", () => {
    render(<OnboardingApp />);

    expect(screen.queryByText("PASTPAGE")).not.toBeInTheDocument();
    expect(screen.getByText("Welcome to PastPage")).toBeInTheDocument();
    expect(screen.getByText("Find an earlier version when a page is gone or changed.")).toBeInTheDocument();
    expect(screen.getByText("Recovery bar")).toBeInTheDocument();
    expect(screen.getByText("Look up the current page")).toBeInTheDocument();
    expect(screen.getByText("Pin the toolbar icon")).toBeInTheDocument();
    expect(screen.getByText("Open the puzzle menu")).toBeInTheDocument();
    expect(screen.getByText("Open PastPage gear menu")).toBeInTheDocument();
    expect(screen.getByText("Pin to Toolbar")).toBeInTheDocument();
    const firefoxIcon = document.querySelector('[data-browser-icon="firefox-extension"]');
    expect(firefoxIcon).not.toBeNull();
    expect(firefoxIcon).toHaveAttribute("src", "moz-extension://test//browser-icons/firefox-extension.svg");
    expect(document.querySelector('[data-browser-icon="chrome-puzzle"]')).toBeNull();
    expect(screen.queryByText("PASTPAGE")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rate on Firefox" })).toHaveAttribute(
      "href",
      "https://addons.mozilla.org/en-US/firefox/addon/pastpage-query-10-web-archives/"
    );
  });

  it("renders the Chrome extension puzzle icon in Chromium builds", () => {
    (browser.runtime.getURL as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (path: string) => `chrome-extension://test/${path}`
    );

    render(<OnboardingApp />);

    expect(screen.getByText("Open puzzle by bar")).toBeInTheDocument();
    expect(document.querySelector('[data-browser-icon="chrome-puzzle"]')).not.toBeNull();
    expect(document.querySelector('[data-browser-icon="firefox-extension"]')).toBeNull();
  });

  it("opens the settings page in a tab from the customize action", async () => {
    render(<OnboardingApp />);

    await userEvent.click(screen.getByRole("button", { name: "Open settings" }));

    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: "moz-extension://test//options.html",
      active: true
    });
  });

  it("uses the revised multi-archive capability copy", () => {
    render(<OnboardingApp />);

    expect(screen.getByText("Start with these two options")).toBeInTheDocument();
    expect(screen.getByText("Adjust the details")).toBeInTheDocument();
    expect(screen.queryByText("One step setup")).not.toBeInTheDocument();
    expect(screen.queryByText("What it does")).not.toBeInTheDocument();
    expect(screen.queryByText("Make it yours", { selector: "span" })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "When a page breaks, PastPage can show a bar with a button to look for an archived version."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("Pick one archive")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/archived version from Wayback, Archive\.today, or Perma\.cc/i)
    ).not.toBeInTheDocument();
  });

  it("reveals secondary actions only after expanding the details section", async () => {
    render(<OnboardingApp />);

    expect(screen.queryByText("Pick one archive")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /More ways to look up pages/i }));

    expect(screen.getByText("Pick one archive")).toBeInTheDocument();
    expect(screen.getByText("Search archives for a link target")).toBeInTheDocument();
  });

  it("switches to German copy when the browser UI language is German", () => {
    (browser.i18n.getUILanguage as unknown as ReturnType<typeof vi.fn>).mockReturnValue("de-DE");

    render(<OnboardingApp />);

    expect(screen.getByText("Willkommen bei PastPage")).toBeInTheDocument();
    expect(screen.getByText("Finde archivierte Versionen von geänderten oder verschwundenen Webseiten.")).toBeInTheDocument();
    expect(screen.getByText("Rettungsleiste")).toBeInTheDocument();
    expect(screen.getByText("Aktuelle Seite nachschlagen")).toBeInTheDocument();
    expect(screen.queryByText("Ein Schritt Setup")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings öffnen" })).toBeInTheDocument();
  });

  it("switches to Italian copy when the browser UI language is Italian", () => {
    (browser.i18n.getUILanguage as unknown as ReturnType<typeof vi.fn>).mockReturnValue("it-IT");

    render(<OnboardingApp />);

    expect(screen.getByText("Benvenuto in PastPage")).toBeInTheDocument();
    expect(screen.getByText("Trova una versione precedente quando una pagina non c'è più o è cambiata.")).toBeInTheDocument();
    expect(screen.getByText("Barra di recupero")).toBeInTheDocument();
    expect(screen.getByText("Controlla la pagina corrente")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apri impostazioni" })).toBeInTheDocument();
  });
});
