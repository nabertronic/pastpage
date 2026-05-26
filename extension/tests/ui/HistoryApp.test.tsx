import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryApp } from "@/components/HistoryApp";
import { DEFAULT_SETTINGS } from "@/core/settings";

const storageGetMock = browser.storage.local.get as unknown as ReturnType<typeof vi.fn>;
const storageSetMock = browser.storage.local.set as unknown as ReturnType<typeof vi.fn>;

function parseCsvRow(row: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    if (char === '"') {
      const next = row[index + 1];
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current);
  return cells;
}

function parseCsv(text: string): string[][] {
  return text.split("\n").map((row, index) => {
    const cells = parseCsvRow(row);
    if (index === 0 && cells[0]?.startsWith("\uFEFF")) {
      cells[0] = cells[0].slice(1);
    }
    return cells;
  });
}

function setupCsvExportCapture() {
  class MockBlob {
    parts: string[];
    type: string;

    constructor(parts: unknown[], options?: { type?: string }) {
      this.parts = parts.map((part) => String(part));
      this.type = options?.type ?? "";
    }
  }

  vi.stubGlobal("Blob", MockBlob);

  let exportedBlob: MockBlob | null = null;
  let downloadLink: HTMLAnchorElement | null = null;
  const originalCreateElement = document.createElement.bind(document);

  vi.spyOn(document, "createElement").mockImplementation((tagName) => {
    const element = originalCreateElement(tagName);
    if (tagName.toLowerCase() === "a") {
      downloadLink = element as HTMLAnchorElement;
      vi.spyOn(element as HTMLAnchorElement, "click").mockImplementation(() => {});
    }
    return element;
  });

  (URL.createObjectURL as unknown as ReturnType<typeof vi.fn>).mockImplementation((blob: MockBlob) => {
    exportedBlob = blob;
    return "blob:history-export";
  });

  return {
    getCsv() {
      expect(exportedBlob).not.toBeNull();
      return exportedBlob!.parts.join("");
    },
    getRawCsv() {
      expect(exportedBlob).not.toBeNull();
      return exportedBlob!.parts.join("");
    },
    getDownloadLink() {
      return downloadLink;
    }
  };
}

describe("HistoryApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      value: vi.fn(() => "blob:history-export")
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      value: vi.fn()
    });
    storageGetMock.mockResolvedValue({
      "pastPage.settings": DEFAULT_SETTINGS,
      "pastPage.history": []
    });
    storageSetMock.mockResolvedValue(undefined);
    (browser.runtime.getURL as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (path: string) => `moz-extension://test/${path.replace(/^\//, "")}`
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("updates automatically when history changes in local storage", async () => {
    let currentHistory: Array<Record<string, unknown>> = [
      {
        id: "hist_1",
        startedAt: Date.parse("2024-01-02T03:04:05Z"),
        targetUrl: "https://example.com/older",
        trigger: "manual-page",
        requestTrigger: "manual-page",
        outcome: "unknown",
        resultSnapshots: []
      }
    ];

    const listeners: Array<(changes: Record<string, unknown>, areaName: string) => void> = [];
    const storageGet = browser.storage.local.get as unknown as ReturnType<typeof vi.fn>;
    const onChangedAdd = browser.storage.onChanged.addListener as unknown as ReturnType<typeof vi.fn>;
    const onChangedRemove = browser.storage.onChanged.removeListener as unknown as ReturnType<typeof vi.fn>;

    storageGet.mockImplementation(async (key?: string | string[] | null) => {
      if (key === "pastPage.settings") {
        return { "pastPage.settings": DEFAULT_SETTINGS };
      }
      if (key === "pastPage.history") {
        return { "pastPage.history": currentHistory };
      }
      return {
        "pastPage.settings": DEFAULT_SETTINGS,
        "pastPage.history": currentHistory
      };
    });

    onChangedAdd.mockImplementation((listener) => {
      listeners.push(listener);
    });
    onChangedRemove.mockImplementation((listener) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    });

    render(<HistoryApp />);

    expect(await screen.findByText("/older")).toBeInTheDocument();
    expect(screen.queryByText("/newer")).not.toBeInTheDocument();

    currentHistory = [
      {
        id: "hist_2",
        startedAt: Date.parse("2024-02-04T05:06:07Z"),
        targetUrl: "https://example.com/newer",
        trigger: "manual-page",
        requestTrigger: "manual-page",
        outcome: "hit",
        resultSnapshots: []
      },
      ...currentHistory
    ];

    listeners.forEach((listener) => {
      listener(
        {
          "pastPage.history": {
            oldValue: [],
            newValue: currentHistory
          }
        },
        "local"
      );
    });

    expect(await screen.findByText("/newer")).toBeInTheDocument();
    expect(screen.getByText("/older")).toBeInTheDocument();
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

  it("exports the current filtered view as structured csv", async () => {
    const exportCapture = setupCsvExportCapture();

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
          resultSnapshots: [
            {
              originalUrl: "https://example.com/direct",
              matchedUrl: "https://example.com/direct",
              archiveUrl: "https://archive.example/direct-raw",
              openUrl: "https://archive.example/direct-open",
              timestamp: "2024-01-02T03:04:05Z",
              statusCode: "200",
              mimeType: "text/html",
              strategy: "exact",
              providerId: "ghostarchive"
            },
            {
              originalUrl: "https://example.com/direct",
              matchedUrl: "https://example.com/direct",
              archiveUrl: "https://archive.example/direct-fallback",
              timestamp: "2024-01-03T03:04:05Z",
              statusCode: "200",
              mimeType: "text/html",
              strategy: "cleaned",
              providerId: "wayback"
            }
          ]
        }
      ]
    });

    render(<HistoryApp />);

    expect(screen.queryByRole("button", { name: "Export current view CSV" })).not.toBeInTheDocument();
    await userEvent.type(await screen.findByLabelText("Search history"), "direct");
    expect(screen.getByRole("button", { name: "Export current view CSV" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Export current view CSV" }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:history-export");
    const downloadLink = exportCapture.getDownloadLink();
    expect(downloadLink).not.toBeNull();
    expect(downloadLink!.download).toMatch(/^pastpage-history-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(downloadLink!.href).toBe("blob:history-export");

    expect(exportCapture.getRawCsv().startsWith("\uFEFF")).toBe(true);
    const rows = parseCsv(exportCapture.getCsv());
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(expect.arrayContaining([
      "exportedAt",
      "historySchemaVersion",
      "filtersApplied",
      "waybackMachineTimestamp",
      "waybackMachineUrl",
      "ghostarchiveTimestamp",
      "ghostarchiveUrl"
    ]));
    expect(rows[1]).toEqual(expect.arrayContaining([
      "3",
      "hist_1",
      "https://example.com/direct",
      "2",
      "2024-01-03T03:04:05Z",
      "https://archive.example/direct-fallback",
      "2024-01-02T03:04:05Z",
      "https://archive.example/direct-open"
    ]));
    expect(rows[1]?.[2]).toContain("\"direct\"");
  });

  it("exports the full history with provider, failure, and attempt columns", async () => {
    const exportCapture = setupCsvExportCapture();

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
            },
            {
              originalUrl: "https://example.com/missing",
              matchedUrl: "https://example.com/missing",
              archiveUrl: "https://web.archive.org/web/20240206050607/https://example.com/missing?alt=1",
              timestamp: "2024-02-06T05:06:07Z",
              statusCode: "200",
              mimeType: "text/html",
              strategy: "cleaned",
              providerId: "wayback"
            },
            {
              originalUrl: "https://example.com/missing",
              matchedUrl: "https://example.com/missing",
              archiveUrl: "https://archive.example/missing-fallback",
              openUrl: "https://archive.example/missing-open",
              timestamp: "2024-02-05T05:06:07Z",
              statusCode: "200",
              mimeType: "text/html",
              strategy: "exact",
              providerId: "webcite"
            }
          ],
          failedProviders: [
            {
              providerId: "ghostarchive",
              directLink: "https://ghostarchive.org/search",
              reason: "rate-limited"
            }
          ],
          checkedAttempts: [
            {
              providerId: "wayback",
              strategy: "exact",
              url: "https://example.com/missing",
              outcome: "hit"
            },
            {
              providerId: "wayback",
              strategy: "cleaned",
              url: "https://example.com/missing?cleaned=1",
              outcome: "miss"
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

    await userEvent.type(await screen.findByLabelText("Search history"), "direct");
    await userEvent.click(screen.getByRole("button", { name: "Export full CSV" }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const rows = parseCsv(exportCapture.getCsv());
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(expect.arrayContaining([
      "exportedAt",
      "historySchemaVersion",
      "filtersApplied",
      "waybackMachineTimestamp",
      "waybackMachineUrl",
      "waybackMachineTimestamp2",
      "waybackMachineUrl2",
      "webciteTimestamp",
      "webciteUrl",
      "ghostarchiveFailed",
      "ghostarchiveFailureReason",
      "ghostarchiveDirectLink",
      "waybackMachineAttempt1Strategy",
      "waybackMachineAttempt1Outcome",
      "waybackMachineAttempt1Url",
      "waybackMachineAttempt2Strategy",
      "waybackMachineAttempt2Outcome",
      "waybackMachineAttempt2Url"
    ]));
    expect(rows[1]).toEqual(expect.arrayContaining([
      "3",
      "hist_2",
      "https://example.com/missing",
      "3",
      "2024-02-04T05:06:07Z",
      "https://web.archive.org/web/20240204050607/https://example.com/missing",
      "2024-02-06T05:06:07Z",
      "https://web.archive.org/web/20240206050607/https://example.com/missing?alt=1",
      "2024-02-05T05:06:07Z",
      "https://archive.example/missing-open",
      "true",
      "rate-limited",
      "https://ghostarchive.org/search",
      "exact",
      "hit",
      "https://example.com/missing",
      "cleaned",
      "miss",
      "https://example.com/missing?cleaned=1"
    ]));
  });

  it("omits snapshot columns when the exported data has no snapshots", async () => {
    const exportCapture = setupCsvExportCapture();

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

    await userEvent.click(await screen.findByRole("button", { name: "Export full CSV" }));

    const rows = parseCsv(exportCapture.getCsv());
    expect(rows[0]).toEqual([
      "exportedAt",
      "historySchemaVersion",
      "filtersApplied",
      "id",
      "startedAt",
      "resolvedAt",
      "targetUrl",
      "trigger",
      "requestTrigger",
      "scopedProviderId",
      "outcome",
      "snapshotCount"
    ]);
    expect(rows[1]).toEqual([
      expect.any(String),
      "3",
      '{"mode":"full","query":"","outcomeFilter":"all","triggerFilter":"all","providerFilter":"all","dateFrom":"","dateTo":"","sortMode":"startedAtDesc"}',
      "hist_1",
      "2024-01-02T03:04:05.000Z",
      "",
      "https://example.com/direct",
      "provider-direct",
      "manual-page",
      "",
      "unknown",
      "0"
    ]);
  });

  it("shows current-view export only while filters are active and selected export only with a selection", async () => {
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

    const view = render(<HistoryApp />);

    expect(await screen.findByRole("button", { name: "Export full CSV" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Export current view CSV" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export selected CSV" })).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Search history"), "no-match");

    expect(screen.getByRole("button", { name: "Export full CSV" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export current view CSV" })).toBeDisabled();

    storageGetMock.mockResolvedValue({
      "pastPage.settings": DEFAULT_SETTINGS,
      "pastPage.history": []
    });

    view.unmount();
    render(<HistoryApp />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Export full CSV" })).toBeDisabled());
    expect(screen.queryByRole("button", { name: "Export current view CSV" })).not.toBeInTheDocument();
  });

  it("exports selected entries as csv and reruns selected entries", async () => {
    const exportCapture = setupCsvExportCapture();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const storedHistories: Array<Array<Record<string, unknown>>> = [];
    storageSetMock.mockImplementation(async (next: Record<string, unknown>) => {
      if (Array.isArray(next["pastPage.history"])) {
        storedHistories.push(next["pastPage.history"] as Array<Record<string, unknown>>);
      }
    });

    storageGetMock.mockResolvedValue({
      "pastPage.settings": DEFAULT_SETTINGS,
      "pastPage.history": [
        {
          id: "hist_2",
          startedAt: Date.parse("2024-02-04T05:06:07Z"),
          targetUrl: "https://example.com/two",
          trigger: "manual-page",
          requestTrigger: "manual-page",
          outcome: "unknown",
          resultSnapshots: []
        },
        {
          id: "hist_1",
          startedAt: Date.parse("2024-01-02T03:04:05Z"),
          targetUrl: "https://example.com/one",
          trigger: "provider-direct",
          requestTrigger: "manual-page",
          outcome: "unknown",
          resultSnapshots: []
        }
      ]
    });

    render(<HistoryApp />);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Select history entry for https://example.com/two" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select history entry for https://example.com/one" }));
    await userEvent.click(screen.getByRole("button", { name: "Export selected CSV" }));

    const rows = parseCsv(exportCapture.getCsv());
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual(expect.arrayContaining(["hist_2"]));
    expect(rows[2]).toEqual(expect.arrayContaining(["hist_1"]));

    await userEvent.click(screen.getByRole("button", { name: "Rerun selected" }));

    expect(confirmSpy).toHaveBeenCalledWith("Rerun 2 selected history entries?");
    expect(browser.tabs.create).toHaveBeenCalledTimes(2);
    const firstNewEntryId = String(storedHistories[0]?.[0]?.id ?? "");
    const secondNewEntryId = String(storedHistories[1]?.[0]?.id ?? "");
    expect(browser.tabs.create).toHaveBeenNthCalledWith(1, {
      url: `moz-extension://test/resolver.html?url=https%3A%2F%2Fexample.com%2Ftwo&trigger=manual-page&historyId=${encodeURIComponent(firstNewEntryId)}`,
      active: true
    });
    expect(browser.tabs.create).toHaveBeenNthCalledWith(2, {
      url: `moz-extension://test/resolver.html?url=https%3A%2F%2Fexample.com%2Fone&trigger=manual-page&historyId=${encodeURIComponent(secondNewEntryId)}`,
      active: false
    });
  });

  it("saves and applies filter presets", async () => {
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Hits only");

    storageGetMock.mockResolvedValue({
      "pastPage.settings": DEFAULT_SETTINGS,
      "pastPage.history": [
        {
          id: "hist_2",
          startedAt: Date.parse("2024-02-04T05:06:07Z"),
          targetUrl: "https://example.com/missing",
          trigger: "broken-page",
          requestTrigger: "broken-page",
          outcome: "hit",
          resultSnapshots: []
        },
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

    await userEvent.click(await screen.findByRole("button", { name: "Filters" }));
    await userEvent.selectOptions(screen.getByLabelText("Outcome"), "hit");
    await userEvent.click(screen.getByRole("button", { name: "Save preset" }));

    expect(promptSpy).toHaveBeenCalledWith("Name this filter preset", "");
    await waitFor(() =>
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "pastPage.settings": expect.objectContaining({
          historyFilterPresets: [
            expect.objectContaining({
              name: "Hits only",
              outcomeFilter: "hit"
            })
          ]
        })
      })
    );

    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await userEvent.click(screen.getByRole("button", { name: "Hits only" }));

    expect(screen.getByText("/missing")).toBeInTheDocument();
    expect(screen.queryByText("/direct")).not.toBeInTheDocument();
  });

  it("supports sorting and detailed mode", async () => {
    storageGetMock.mockResolvedValue({
      "pastPage.settings": DEFAULT_SETTINGS,
      "pastPage.history": [
        {
          id: "hist_2",
          startedAt: Date.parse("2024-02-04T05:06:07Z"),
          targetUrl: "https://example.com/newer",
          trigger: "broken-page",
          requestTrigger: "broken-page",
          outcome: "hit",
          resultSnapshots: [],
          failedProviders: [{ providerId: "ghostarchive", reason: "rate-limited" }]
        },
        {
          id: "hist_1",
          startedAt: Date.parse("2024-01-02T03:04:05Z"),
          targetUrl: "https://example.com/older",
          trigger: "provider-direct",
          requestTrigger: "manual-page",
          outcome: "unknown",
          resultSnapshots: [
            {
              originalUrl: "https://example.com/older",
              matchedUrl: "https://example.com/older",
              archiveUrl: "https://archive.example/older",
              timestamp: "2024-01-02T03:04:05Z",
              statusCode: "200",
              mimeType: "text/html",
              strategy: "exact",
              providerId: "wayback"
            }
          ],
          checkedAttempts: [{ providerId: "wayback", strategy: "exact", outcome: "hit", url: "https://example.com/older" }]
        }
      ]
    });

    render(<HistoryApp />);

    await userEvent.click(await screen.findByRole("button", { name: "Filters" }));
    await userEvent.selectOptions(screen.getByLabelText("Sort by"), "startedAtAsc");
    expect(await screen.findByText("/older")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("/older");

    await userEvent.selectOptions(screen.getByLabelText("View"), "detailed");
    expect(screen.getByText("Failed providers")).toBeInTheDocument();
    expect(screen.getByText("1 checked attempts")).toBeInTheDocument();
  });

  it("reruns the resolver for the original target url", async () => {
    const createdEntries: Array<Record<string, unknown>> = [];
    let historyCounter = 0;
    storageSetMock.mockImplementation(async (next: Record<string, unknown>) => {
      if (Array.isArray(next["pastPage.history"])) {
        createdEntries.push(...(next["pastPage.history"] as Array<Record<string, unknown>>));
      }
    });
    vi.spyOn(Date, "now").mockImplementation(() => 1710000000000 + historyCounter++);

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

    expect(browser.storage.local.set).toHaveBeenCalledWith({
      "pastPage.history": [
        expect.objectContaining({
          targetUrl: "https://example.com/direct",
          trigger: "manual-page",
          requestTrigger: "manual-page",
          outcome: "unknown"
        }),
        expect.objectContaining({ id: "hist_1" })
      ]
    });
    const newEntry = createdEntries[0];
    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: `moz-extension://test/resolver.html?url=https%3A%2F%2Fexample.com%2Fdirect&trigger=manual-page&historyId=${encodeURIComponent(String(newEntry?.id))}`,
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

  it("deletes a single history entry from the dedicated page", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    storageGetMock.mockResolvedValue({
      "pastPage.settings": DEFAULT_SETTINGS,
      "pastPage.history": [
        {
          id: "hist_2",
          startedAt: Date.parse("2024-02-04T05:06:07Z"),
          targetUrl: "https://example.com/keep",
          trigger: "manual-page",
          requestTrigger: "manual-page",
          outcome: "unknown",
          resultSnapshots: []
        },
        {
          id: "hist_1",
          startedAt: Date.parse("2024-01-02T03:04:05Z"),
          targetUrl: "https://example.com/delete",
          trigger: "provider-direct",
          requestTrigger: "manual-page",
          outcome: "unknown",
          resultSnapshots: []
        }
      ]
    });

    render(<HistoryApp />);

    const deleteButtons = await screen.findAllByRole("button", { name: "Delete entry" });
    await userEvent.click(deleteButtons[1]!);

    expect(confirmSpy).toHaveBeenCalledWith("Delete this history entry?");
    await waitFor(() =>
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "pastPage.history": [
          expect.objectContaining({ id: "hist_2" })
        ]
      })
    );
    expect(screen.queryByText("/delete")).not.toBeInTheDocument();
    expect(screen.getByText("/keep")).toBeInTheDocument();
  });

  it("deletes multiple selected history entries in bulk", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    storageGetMock.mockResolvedValue({
      "pastPage.settings": DEFAULT_SETTINGS,
      "pastPage.history": [
        {
          id: "hist_3",
          startedAt: Date.parse("2024-03-05T05:06:07Z"),
          targetUrl: "https://example.com/three",
          trigger: "manual-page",
          requestTrigger: "manual-page",
          outcome: "unknown",
          resultSnapshots: []
        },
        {
          id: "hist_2",
          startedAt: Date.parse("2024-02-04T05:06:07Z"),
          targetUrl: "https://example.com/two",
          trigger: "manual-page",
          requestTrigger: "manual-page",
          outcome: "unknown",
          resultSnapshots: []
        },
        {
          id: "hist_1",
          startedAt: Date.parse("2024-01-02T03:04:05Z"),
          targetUrl: "https://example.com/one",
          trigger: "provider-direct",
          requestTrigger: "manual-page",
          outcome: "unknown",
          resultSnapshots: []
        }
      ]
    });

    render(<HistoryApp />);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Select history entry for https://example.com/three" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select history entry for https://example.com/one" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete selected" }));

    expect(confirmSpy).toHaveBeenCalledWith("Delete 2 selected history entries?");
    await waitFor(() =>
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        "pastPage.history": [
          expect.objectContaining({ id: "hist_2" })
        ]
      })
    );
    expect(screen.queryByText("/three")).not.toBeInTheDocument();
    expect(screen.queryByText("/one")).not.toBeInTheDocument();
    expect(screen.getByText("/two")).toBeInTheDocument();
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
