import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/core/settings";
import {
  clearHistory,
  completeHistoryEntry,
  consumeFirstArchiveReviewPrompt,
  createHistoryEntry,
  getHistory,
  getLocalMeta,
  incrementSearchCountAndCheckReviewPrompt
} from "@/platform/storage";

describe("storage meta helpers", () => {
  const store: Record<string, unknown> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(store).forEach((key) => delete store[key]);
    store["pastPage.settings"] = DEFAULT_SETTINGS;

    const getMock = browser.storage.local.get as unknown as ReturnType<typeof vi.fn>;
    const setMock = browser.storage.local.set as unknown as ReturnType<typeof vi.fn>;
    getMock.mockImplementation(async (key?: string | string[] | null) => {
      if (typeof key === "string") return { [key]: store[key] };
      return { ...store };
    });
    setMock.mockImplementation(async (next: Record<string, unknown>) => {
      Object.assign(store, next);
    });
  });

  it("shows the review prompt exactly once after the first archive auto-open", async () => {
    await expect(consumeFirstArchiveReviewPrompt()).resolves.toBe(true);
    await expect(consumeFirstArchiveReviewPrompt()).resolves.toBe(false);

    const meta = await getLocalMeta();
    expect(meta.firstArchiveOpenedAt).toBeTypeOf("number");
    expect(meta.reviewPromptShownAt).toBeTypeOf("number");
  });

  it("shows the review prompt on each 100-search milestone", async () => {
    for (let index = 1; index < 100; index += 1) {
      await expect(incrementSearchCountAndCheckReviewPrompt()).resolves.toBe(false);
    }

    await expect(incrementSearchCountAndCheckReviewPrompt()).resolves.toBe(true);
    await expect(incrementSearchCountAndCheckReviewPrompt()).resolves.toBe(false);

    for (let index = 102; index < 200; index += 1) {
      await expect(incrementSearchCountAndCheckReviewPrompt()).resolves.toBe(false);
    }

    await expect(incrementSearchCountAndCheckReviewPrompt()).resolves.toBe(true);

    const meta = await getLocalMeta();
    expect(meta.searchCount).toBe(200);
    expect(meta.searchReviewPromptCount).toBe(200);
    expect(meta.searchReviewPromptShownAt).toBeTypeOf("number");
  });

  it("creates and completes a history entry with confirmed snapshots", async () => {
    const entry = await createHistoryEntry({
      targetUrl: "https://example.com/story",
      trigger: "manual-page",
      requestTrigger: "manual-page"
    });

    expect(entry).not.toBeNull();
    expect(entry?.targetUrl).toBe("https://example.com/story");
    expect(entry?.outcome).toBe("unknown");

    await completeHistoryEntry(entry!.id, {
      outcome: "hit",
      resultSnapshots: [
        {
          originalUrl: "https://example.com/story",
          matchedUrl: "https://example.com/story",
          archiveUrl: "https://web.archive.org/web/20240102030405/https://example.com/story",
          timestamp: "2024-01-02T03:04:05Z",
          statusCode: "200",
          mimeType: "text/html",
          strategy: "exact",
          providerId: "wayback"
        }
      ]
    });

    const history = await getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]?.outcome).toBe("hit");
    expect(history[0]?.resolvedAt).toBeTypeOf("number");
    expect(history[0]?.resultSnapshots).toHaveLength(1);
  });

  it("does not create history entries when history is disabled", async () => {
    store["pastPage.settings"] = {
      ...DEFAULT_SETTINGS,
      historyEnabled: false
    };

    await expect(
      createHistoryEntry({
        targetUrl: "https://example.com/story",
        trigger: "manual-page",
        requestTrigger: "manual-page"
      })
    ).resolves.toBeNull();
    await expect(getHistory()).resolves.toEqual([]);
  });

  it("clears saved history without changing settings", async () => {
    await createHistoryEntry({
      targetUrl: "https://example.com/story",
      trigger: "manual-page",
      requestTrigger: "manual-page"
    });

    await clearHistory();

    await expect(getHistory()).resolves.toEqual([]);
    expect(store["pastPage.settings"]).toEqual(DEFAULT_SETTINGS);
  });
});
