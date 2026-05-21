import { DEFAULT_SETTINGS, parseSettings, type Settings } from "../core/settings";
import {
  parseHistory,
  type CompleteHistoryEntryInput,
  type CreateHistoryEntryInput,
  type HistoryEntry
} from "../core/history";

const SETTINGS_KEY = "pastPage.settings";
const META_KEY = "pastPage.meta";
const HISTORY_KEY = "pastPage.history";

export type LocalMeta = {
  firstArchiveOpenedAt?: number;
  searchCount?: number;
  reviewPromptShownAt?: number;
  searchReviewPromptCount?: number;
  searchReviewPromptShownAt?: number;
  lastSeenWhatsNewVersion?: string;
};

function parseTimestamp(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function parseCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function parseMeta(value: unknown): LocalMeta {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const meta = value as Record<string, unknown>;
  return {
    firstArchiveOpenedAt: parseTimestamp(meta.firstArchiveOpenedAt),
    searchCount: parseCount(meta.searchCount),
    reviewPromptShownAt: parseTimestamp(meta.reviewPromptShownAt),
    searchReviewPromptCount: parseCount(meta.searchReviewPromptCount),
    searchReviewPromptShownAt: parseTimestamp(meta.searchReviewPromptShownAt),
    lastSeenWhatsNewVersion: typeof meta.lastSeenWhatsNewVersion === "string" ? meta.lastSeenWhatsNewVersion : undefined
  };
}

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  return parseSettings(stored[SETTINGS_KEY]);
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
  return settings;
}

export function getCachedSettings(): Settings | undefined {
  return undefined;
}

export async function ensureSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  if (stored[SETTINGS_KEY]) return parseSettings(stored[SETTINGS_KEY]);
  await saveSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export function resetStorageCachesForTests(): void {
  return;
}

export async function getLocalMeta(): Promise<LocalMeta> {
  const stored = await browser.storage.local.get(META_KEY);
  return parseMeta(stored[META_KEY]);
}

async function saveLocalMeta(meta: LocalMeta): Promise<LocalMeta> {
  await browser.storage.local.set({ [META_KEY]: meta });
  return meta;
}

export async function markWhatsNewVersionSeen(version: string): Promise<void> {
  const meta = await getLocalMeta();
  await saveLocalMeta({
    ...meta,
    lastSeenWhatsNewVersion: version
  });
}

function createHistoryId(): string {
  return `hist_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const stored = await browser.storage.local.get(HISTORY_KEY);
  return parseHistory(stored[HISTORY_KEY]).sort((a, b) => b.startedAt - a.startedAt);
}

async function saveHistory(history: HistoryEntry[]): Promise<HistoryEntry[]> {
  await browser.storage.local.set({ [HISTORY_KEY]: history });
  return history;
}

async function isHistoryEnabled(): Promise<boolean> {
  const settings = await getSettings();
  return settings.historyEnabled;
}

export async function createHistoryEntry(input: CreateHistoryEntryInput): Promise<HistoryEntry | null> {
  if (!(await isHistoryEnabled())) return null;

  const history = await getHistory();
  const entry: HistoryEntry = {
    id: createHistoryId(),
    startedAt: Date.now(),
    targetUrl: input.targetUrl,
    trigger: input.trigger,
    requestTrigger: input.requestTrigger,
    scopedProviderId: input.scopedProviderId,
    outcome: "unknown",
    resultSnapshots: []
  };

  await saveHistory([entry, ...history]);
  return entry;
}

export async function completeHistoryEntry(
  id: string,
  input: CompleteHistoryEntryInput
): Promise<HistoryEntry | null> {
  const history = await getHistory();
  let updatedEntry: HistoryEntry | null = null;

  const nextHistory = history.map((entry) => {
    if (entry.id !== id) return entry;

    updatedEntry = {
      ...entry,
      outcome: input.outcome,
      resolvedAt: input.resolvedAt ?? Date.now(),
      resultSnapshots: input.resultSnapshots ?? entry.resultSnapshots,
      failedProviders: input.failedProviders ?? entry.failedProviders,
      checkedAttempts: input.checkedAttempts ?? entry.checkedAttempts
    };
    return updatedEntry;
  });

  if (!updatedEntry) return null;
  await saveHistory(nextHistory);
  return updatedEntry;
}

export async function appendHistorySnapshots(
  id: string,
  snapshots: HistoryEntry["resultSnapshots"]
): Promise<HistoryEntry | null> {
  if (snapshots.length === 0) {
    const history = await getHistory();
    return history.find((entry) => entry.id === id) ?? null;
  }

  const history = await getHistory();
  let updatedEntry: HistoryEntry | null = null;

  const nextHistory = history.map((entry) => {
    if (entry.id !== id) return entry;

    const seen = new Set(entry.resultSnapshots.map((snapshot) => snapshot.openUrl ?? snapshot.archiveUrl));
    const nextSnapshots = [...entry.resultSnapshots];
    for (const snapshot of snapshots) {
      const key = snapshot.openUrl ?? snapshot.archiveUrl;
      if (seen.has(key)) continue;
      seen.add(key);
      nextSnapshots.push(snapshot);
    }

    updatedEntry = {
      ...entry,
      resultSnapshots: nextSnapshots
    };
    return updatedEntry;
  });

  if (!updatedEntry) return null;
  await saveHistory(nextHistory);
  return updatedEntry;
}

export async function clearHistory(): Promise<void> {
  await browser.storage.local.set({ [HISTORY_KEY]: [] });
}

export async function deleteHistoryEntries(ids: string[]): Promise<HistoryEntry[]> {
  if (ids.length === 0) {
    return getHistory();
  }

  const idSet = new Set(ids);
  const history = await getHistory();
  const nextHistory = history.filter((entry) => !idSet.has(entry.id));
  await saveHistory(nextHistory);
  return nextHistory;
}

export async function deleteHistoryEntry(id: string): Promise<HistoryEntry[]> {
  return deleteHistoryEntries([id]);
}

export async function consumeFirstArchiveReviewPrompt(): Promise<boolean> {
  const meta = await getLocalMeta();
  if (meta.reviewPromptShownAt || meta.firstArchiveOpenedAt) {
    return false;
  }

  const now = Date.now();
  await saveLocalMeta({
    ...meta,
    firstArchiveOpenedAt: now,
    reviewPromptShownAt: now
  });
  return true;
}

export async function incrementSearchCountAndCheckReviewPrompt(): Promise<boolean> {
  const meta = await getLocalMeta();
  const nextSearchCount = (meta.searchCount ?? 0) + 1;
  const nextPromptCount =
    nextSearchCount > 0 && nextSearchCount % 100 === 0 ? nextSearchCount : undefined;
  const shouldPrompt =
    nextPromptCount !== undefined && meta.searchReviewPromptCount !== nextPromptCount;

  await saveLocalMeta({
    ...meta,
    searchCount: nextSearchCount,
    searchReviewPromptCount: shouldPrompt ? nextPromptCount : meta.searchReviewPromptCount,
    searchReviewPromptShownAt: shouldPrompt ? Date.now() : meta.searchReviewPromptShownAt
  });

  return shouldPrompt;
}
