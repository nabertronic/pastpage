import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WhatsNewApp } from "@/components/WhatsNewApp";

const storageGetMock = browser.storage.local.get as unknown as ReturnType<typeof vi.fn>;
const storageSetMock = browser.storage.local.set as unknown as ReturnType<typeof vi.fn>;

describe("WhatsNewApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageGetMock.mockResolvedValue({});
    storageSetMock.mockResolvedValue(undefined);
    vi.mocked(browser.runtime.getManifest).mockReturnValue({ version: "1.0.7" } as never);
    vi.mocked(browser.runtime.getURL).mockReturnValue("chrome-extension://test/" as never);
  });

  it("renders versions in descending order and expands the latest release by default", async () => {
    render(<WhatsNewApp />);

    expect(await screen.findByText("What's new")).toBeInTheDocument();

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings[0]).toHaveTextContent("v1.0.8");
    expect(headings.at(-1)).toHaveTextContent("v1.0.1");

    expect(screen.getByText(/use “Browser default” as the theme/)).toBeInTheDocument();
    expect(screen.getByText(/including “Not Found”, “Timeout”, “Service Error”, and “Too Many Requests”/)).toBeInTheDocument();
    expect(screen.queryByText(/Simplified the onboarding flow around the two primary actions/)).not.toBeInTheDocument();
  });

  it("toggles older versions open and closed", async () => {
    render(<WhatsNewApp />);

    await screen.findByText("What's new");

    const previousReleaseButton = screen.getByRole("button", { name: "Expand v1.0.6" });
    await userEvent.click(previousReleaseButton);
    expect(screen.getByText(/Simplified the onboarding flow around the two primary actions/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Collapse v1.0.6" }));
    expect(screen.queryByText(/Simplified the onboarding flow around the two primary actions/)).not.toBeInTheDocument();
  });

  it("shows a store review prompt with browser-specific copy", async () => {
    vi.mocked(browser.runtime.getURL).mockReturnValue("moz-extension://test/" as never);

    render(<WhatsNewApp />);

    expect(await screen.findByText(/rating the add-on on Firefox Add-ons/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rate add-on" })).toHaveAttribute(
      "href",
      "https://addons.mozilla.org/en-US/firefox/addon/pastpage-query-10-web-archives/"
    );
  });
});
