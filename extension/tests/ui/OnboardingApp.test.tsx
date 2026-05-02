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
    expect(screen.getByText("When a page is gone or changed, find what was there.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Learn how it works" })).toBeInTheDocument();
    expect(screen.getByText("Pin the toolbar icon")).toBeInTheDocument();
    expect(screen.getByText("Open the puzzle menu")).toBeInTheDocument();
    expect(screen.getByText("Open PastPage gear menu")).toBeInTheDocument();
    expect(screen.getByText("Pin to Toolbar")).toBeInTheDocument();
    expect(screen.queryByText("PASTPAGE")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rate on Firefox" })).toHaveAttribute(
      "href",
      "https://addons.mozilla.org/en-US/firefox/addon/pastpage-query-10-web-archives/"
    );
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

    expect(screen.getByText("Six ways PastPage helps")).toBeInTheDocument();
    expect(screen.getByText("Make it yours")).toBeInTheDocument();
    expect(screen.queryByText("One step setup")).not.toBeInTheDocument();
    expect(screen.queryByText("What it does")).not.toBeInTheDocument();
    expect(screen.queryByText("Make it yours", { selector: "span" })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "When a page fails to load, a quiet bar appears automatically with one button to search for archived copies."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Right-click on any page to jump straight into Wayback Machine, Archive.today, and other archive options."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/archived version from Wayback, Archive\.today, or Perma\.cc/i)
    ).not.toBeInTheDocument();
  });

  it("switches to German copy when the browser UI language is German", () => {
    (browser.i18n.getUILanguage as unknown as ReturnType<typeof vi.fn>).mockReturnValue("de-DE");

    render(<OnboardingApp />);

    expect(screen.getByText("Willkommen bei PastPage")).toBeInTheDocument();
    expect(screen.getByText("Wenn eine Seite weg ist oder verändert wurde, finde, was dort stand.")).toBeInTheDocument();
    expect(screen.queryByText("Ein Schritt Setup")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings öffnen" })).toBeInTheDocument();
  });
});
