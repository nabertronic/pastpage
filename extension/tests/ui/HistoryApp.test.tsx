import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryApp } from "@/components/HistoryApp";
import { DEFAULT_SETTINGS } from "@/core/settings";

const storageGetMock = browser.storage.local.get as unknown as ReturnType<typeof vi.fn>;
const storageSetMock = browser.storage.local.set as unknown as ReturnType<typeof vi.fn>;

describe("HistoryApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageGetMock.mockResolvedValue({
      "pastPage.settings": DEFAULT_SETTINGS,
      "pastPage.history": []
    });
    storageSetMock.mockResolvedValue(undefined);
    (browser.runtime.getURL as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (path: string) => `moz-extension://test/${path.replace(/^\//, "")}`
    );
  });

  it("renders the history table stats and filters", async () => {
    storageGetMock.mockResolvedValue({
      "pastPage.settings": DEFAULT_SETTINGS,
      "pastPage.history": [
        {
          id: "hist_2",
          startedAt: Date.parse("2024-02-04T05:06:07Z"),
          resolvedAt: Date.parse("2024-02-04T05:07:07Z"),
          targetUrl: "https://example.com/missing",
          trigger: "broken-page",
          requestTrigger: "broken-page",
          outcome: "hit",
          resultSnapshots: [
            {
              originalUrl: "https://example.com/missing",
              matchedUrl: "https://example.com/missing",
              archiveUrl: "https://web.archive.org/web/20240204050607/https://example.com/missing",
              timestamp: "2024-02-04T05:06:07Z",
              statusCode: "200",
              mimeType: "text/html",
              strategy: "exact",
              providerId: "wayback"
            }
          ]
        },
        {
          id: "hist_1",
          startedAt: Date.parse("2024-01-02T03:04:05Z"),
          targetUrl: "https://example.com/direct",
          trigger: "provider-direct",
          requestTrigger: "manual-page",
          scopedProviderId: "ghostarchive",
          outcome: "unknown",
          resultSnapshots: []
        }
      ]
    });

    render(<HistoryApp />);

    expect(await screen.findByText("Stored search runs")).toBeInTheDocument();
    expect(screen.getByText("Search runs with confirmed hits")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Search history"), "direct");
    expect(screen.getByText("/direct")).toBeInTheDocument();
    expect(screen.queryByText("/missing")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Search history"));
    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    await userEvent.selectOptions(screen.getByLabelText("Outcome"), "hit");
    expect(screen.queryByText("/direct")).not.toBeInTheDocument();
    expect(screen.getByText("/missing")).toBeInTheDocument();
  });

  it("reruns the resolver for the original target url", async () => {
    storageGetMock.mockResolvedValue({
      "pastPage.settings": DEFAULT_SETTINGS,
      "pastPage.history": [
        {
          id: "hist_1",
          startedAt: Date.parse("2024-01-02T03:04:05Z"),
          targetUrl: "https://example.com/direct",
          trigger: "provider-direct",
          requestTrigger: "manual-page",
          outcome: "unknown",
          resultSnapshots: []
        }
      ]
    });

    render(<HistoryApp />);

    await userEvent.click(await screen.findByRole("button", { name: "Rerun" }));

    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: "moz-extension://test/resolver.html?url=https%3A%2F%2Fexample.com%2Fdirect&trigger=manual-page",
      active: true
    });
  });

  it("supports clearing history from the dedicated page", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    storageGetMock.mockResolvedValue({
      "pastPage.settings": DEFAULT_SETTINGS,
      "pastPage.history": [
        {
          id: "hist_1",
          startedAt: Date.parse("2024-01-02T03:04:05Z"),
          targetUrl: "https://example.com/direct",
          trigger: "provider-direct",
          requestTrigger: "manual-page",
          scopedProviderId: "ghostarchive",
          outcome: "unknown",
          resultSnapshots: []
        }
      ]
    });

    render(<HistoryApp />);

    await userEvent.click(await screen.findByRole("button", { name: "Clear history" }));

    expect(confirmSpy).toHaveBeenCalledWith("Delete the saved archive search history?");
    await waitFor(() =>
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "pastPage.history": []
      })
    );
  });

  it("formats history timestamps with the selected app language", async () => {
    const now = Date.parse("2024-02-04T05:07:07Z");
    vi.spyOn(Date, "now").mockReturnValue(now);

    const OriginalRelativeTimeFormat = Intl.RelativeTimeFormat;
    const OriginalDateTimeFormat = Intl.DateTimeFormat;
    const relativeTimeFormatSpy = vi
      .spyOn(Intl, "RelativeTimeFormat")
      .mockImplementation(
        (function (
          locale?: Intl.LocalesArgument,
          options?: Intl.RelativeTimeFormatOptions
        ) {
          return new OriginalRelativeTimeFormat(locale, options);
        }) as unknown as typeof Intl.RelativeTimeFormat
      );
    const dateTimeFormatSpy = vi
      .spyOn(Intl, "DateTimeFormat")
      .mockImplementation(
        (function (
          locale?: Intl.LocalesArgument,
          options?: Intl.DateTimeFormatOptions
        ) {
          return new OriginalDateTimeFormat(locale, options);
        }) as unknown as typeof Intl.DateTimeFormat
      );

    storageGetMock.mockResolvedValue({
      "pastPage.settings": {
        ...DEFAULT_SETTINGS,
        language: "en"
      },
      "pastPage.history": [
        {
          id: "hist_1",
          startedAt: Date.parse("2024-02-04T05:06:07Z"),
          targetUrl: "https://example.com/direct",
          trigger: "provider-direct",
          requestTrigger: "manual-page",
          outcome: "unknown",
          resultSnapshots: []
        }
      ]
    });

    render(<HistoryApp />);

    await screen.findByText("1 minute ago");

    expect(relativeTimeFormatSpy).toHaveBeenCalledWith("en", { numeric: "auto" });
    expect(dateTimeFormatSpy).toHaveBeenCalledWith("en", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  });
});
