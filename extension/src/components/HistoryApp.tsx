import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  ExternalLink,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X
} from "lucide-react";
import { Button } from "./Button";
import { PageShell } from "./PageShell";
import { ResearcherFooter } from "./AppLinks";
import { SelectField } from "./FieldControls";
import { createManualPageLookupRequest } from "../core/lookupRequest";
import { I18nProvider, resolveLocaleFromLanguageMode, useI18n } from "../i18n";
import { PROVIDERS } from "../core/providers";
import type { ProviderId } from "../core/providers/types";
import type { HistoryEntry, HistoryOutcome, HistoryTrigger } from "../core/history";
import {
  DEFAULT_SETTINGS,
  type HistoryFilterPreset,
  type HistoryFilterProvider,
  type HistoryFilterTrigger,
  type HistoryFilterOutcome,
  type HistorySortMode,
  type HistoryViewMode,
  type Settings
} from "../core/settings";
import {
  clearHistory,
  createHistoryEntry,
  deleteHistoryEntries,
  deleteHistoryEntry,
  getHistory,
  getSettings,
  saveSettings
} from "../platform/storage";
import { resolverUrl } from "../platform/urls";
import { useAppliedTheme } from "./useAppliedTheme";

const PAGE_SIZE = 25;
const PRODUCT_PROVIDER_ORDER = [...DEFAULT_SETTINGS.archiveDisplayOrder];
const PRODUCT_PROVIDER_INDEX = new Map(PRODUCT_PROVIDER_ORDER.map((providerId, index) => [providerId, index]));
const HISTORY_SCHEMA_VERSION = "3";

export function HistoryApp() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useAppliedTheme(settings.themeMode);

  useEffect(() => {
    void Promise.all([getSettings(), getHistory()]).then(([nextSettings, nextHistory]) => {
      setSettings(nextSettings);
      setHistory(nextHistory);
    });

    const handleStorageChanged = (
      changes: Record<string, browser.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "local") return;

      if (changes["pastPage.settings"]) {
        void getSettings().then((nextSettings) => {
          setSettings(nextSettings);
        });
      }

      if (changes["pastPage.history"]) {
        void getHistory().then((nextHistory) => {
          setHistory(nextHistory);
        });
      }
    };

    browser.storage.local.onChanged.addListener(handleStorageChanged);

    return () => {
      browser.storage.local.onChanged.removeListener(handleStorageChanged);
    };
  }, []);

  return (
    <I18nProvider locale={resolveLocaleFromLanguageMode(settings.language)}>
      <HistoryContent history={history} settings={settings} setHistory={setHistory} setSettings={setSettings} />
    </I18nProvider>
  );
}

function HistoryContent({
  history,
  settings,
  setHistory,
  setSettings
}: {
  history: HistoryEntry[];
  settings: Settings;
  setHistory: (history: HistoryEntry[]) => void;
  setSettings: (settings: Settings) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<HistoryFilterOutcome>("all");
  const [triggerFilter, setTriggerFilter] = useState<HistoryFilterTrigger>("all");
  const [providerFilter, setProviderFilter] = useState<HistoryFilterProvider>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<HistorySortMode>("startedAtDesc");
  const [viewMode, setViewMode] = useState<HistoryViewMode>("compact");

  const stats = useMemo(
    () => ({
      total: history.length,
      hits: history.filter((e) => e.outcome === "hit").length
    }),
    [history]
  );

  const activeFilterCount = [
    outcomeFilter !== "all",
    triggerFilter !== "all",
    providerFilter !== "all",
    !!dateFrom,
    !!dateTo
  ].filter(Boolean).length;

  const providerOptions = useMemo(() => {
    const providerIds = new Set<ProviderId>();
    for (const entry of history) {
      if (entry.scopedProviderId) providerIds.add(entry.scopedProviderId);
      for (const snapshot of entry.resultSnapshots) providerIds.add(snapshot.providerId);
    }
    return settings.archiveDisplayOrder.filter((id) => providerIds.has(id));
  }, [history, settings.archiveDisplayOrder]);

  const filteredHistory = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const fromTimestamp = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTimestamp = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    return history.filter((entry) => {
      if (outcomeFilter !== "all" && entry.outcome !== outcomeFilter) return false;
      if (triggerFilter !== "all" && entry.trigger !== triggerFilter) return false;
      if (providerFilter !== "all") {
        const matchesScoped = entry.scopedProviderId === providerFilter;
        const matchesSnapshot = entry.resultSnapshots.some((s) => s.providerId === providerFilter);
        if (!matchesScoped && !matchesSnapshot) return false;
      }
      if (fromTimestamp !== null && entry.startedAt < fromTimestamp) return false;
      if (toTimestamp !== null && entry.startedAt > toTimestamp) return false;
      if (!normalizedQuery) return true;

      const haystacks = [
        entry.targetUrl,
        ...entry.resultSnapshots.map((s) => s.openUrl ?? s.archiveUrl)
      ];
      return haystacks.some((v) => v.toLowerCase().includes(normalizedQuery));
    });
  }, [history, outcomeFilter, triggerFilter, providerFilter, dateFrom, dateTo, query]);

  const sortedHistory = useMemo(() => {
    const entries = [...filteredHistory];
    entries.sort((left, right) => compareHistoryEntries(left, right, sortMode));
    return entries;
  }, [filteredHistory, sortMode]);

  useEffect(() => {
    setPage(1);
  }, [query, outcomeFilter, triggerFilter, providerFilter, dateFrom, dateTo, sortMode]);

  const totalPages = Math.max(1, Math.ceil(sortedHistory.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleHistory = sortedHistory.slice(pageStart, pageStart + PAGE_SIZE);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedVisibleCount = visibleHistory.filter((entry) => selectedIdSet.has(entry.id)).length;
  const allVisibleSelected = visibleHistory.length > 0 && selectedVisibleCount === visibleHistory.length;
  const selectedCount = selectedIds.length;
  const selectedEntries = useMemo(
    () => [...history.filter((entry) => selectedIdSet.has(entry.id))].sort((left, right) => compareHistoryEntries(left, right, sortMode)),
    [history, selectedIdSet, sortMode]
  );

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => history.some((entry) => entry.id === id)));
  }, [history]);

  function clearFilters() {
    setQuery("");
    setOutcomeFilter("all");
    setTriggerFilter("all");
    setProviderFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  function buildCurrentFilterPreset(): Omit<HistoryFilterPreset, "id" | "name"> {
    return {
      query,
      outcomeFilter,
      triggerFilter,
      providerFilter,
      dateFrom,
      dateTo
    };
  }

  async function persistSettings(nextSettings: Settings) {
    const savedSettings = await saveSettings(nextSettings);
    setSettings(savedSettings);
  }

  async function handleSavePreset() {
    const name = window.prompt(t("historyPage.presets.savePrompt"), query.trim());
    if (!name) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const preset: HistoryFilterPreset = {
      id: `preset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name: trimmedName,
      ...buildCurrentFilterPreset()
    };

    await persistSettings({
      ...settings,
      historyFilterPresets: [...settings.historyFilterPresets, preset]
    });
  }

  function applyPreset(preset: HistoryFilterPreset) {
    setQuery(preset.query);
    setOutcomeFilter(preset.outcomeFilter);
    setTriggerFilter(preset.triggerFilter);
    setProviderFilter(preset.providerFilter);
    setDateFrom(preset.dateFrom);
    setDateTo(preset.dateTo);
  }

  async function handleDeletePreset(presetId: string) {
    await persistSettings({
      ...settings,
      historyFilterPresets: settings.historyFilterPresets.filter((preset) => preset.id !== presetId)
    });
  }

  async function handleClearHistory() {
    if (!window.confirm(t("options.history.clearConfirm"))) return;
    await clearHistory();
    setHistory([]);
    setSelectedIds([]);
  }

  function toggleEntrySelection(entryId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(entryId) ? current : [...current, entryId];
      }
      return current.filter((id) => id !== entryId);
    });
  }

  function toggleVisibleSelection(checked: boolean) {
    const visibleIds = visibleHistory.map((entry) => entry.id);
    const visibleIdSet = new Set(visibleIds);
    setSelectedIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...visibleIds]));
      }
      return current.filter((id) => !visibleIdSet.has(id));
    });
  }

  async function handleDeleteEntry(entryId: string) {
    if (!window.confirm(t("historyPage.delete.singleConfirm"))) return;
    const nextHistory = await deleteHistoryEntry(entryId);
    setHistory(nextHistory);
    setSelectedIds((current) => current.filter((id) => id !== entryId));
  }

  async function handleDeleteSelected() {
    if (selectedIds.length === 0) return;
    if (!window.confirm(t("historyPage.delete.bulkConfirm", { count: String(selectedIds.length) }))) return;
    const nextHistory = await deleteHistoryEntries(selectedIds);
    setHistory(nextHistory);
    setSelectedIds([]);
  }

  function buildFiltersApplied(mode: "full" | "current-view" | "selected"): string {
    return JSON.stringify({
      mode,
      query,
      outcomeFilter,
      triggerFilter,
      providerFilter,
      dateFrom,
      dateTo,
      sortMode,
      selectedIds: mode === "selected" ? selectedIds : undefined
    });
  }

  async function handleRerunSelected() {
    if (selectedEntries.length === 0) return;
    if (!window.confirm(t("historyPage.selection.rerunConfirm", { count: String(selectedEntries.length) }))) {
      return;
    }

    for (const [index, entry] of selectedEntries.entries()) {
      const historyEntry = await createHistoryEntry({
        targetUrl: entry.targetUrl,
        trigger: "manual-page",
        requestTrigger: "manual-page"
      });
      await browser.tabs.create({
        url: resolverUrl(createManualPageLookupRequest(entry.targetUrl), undefined, undefined, historyEntry?.id),
        active: index === 0
      });
    }
  }

  const hasActiveFilters = activeFilterCount > 0 || !!query;

  return (
    <PageShell title={t("historyPage.title")} description={t("historyPage.description")}>
      <div className="space-y-4">
        {/* Stats + status bar */}
        <section className="rounded-2xl border border-[var(--wf-border)] bg-[var(--wf-surface)] shadow-[0_1px_0_rgba(17,17,17,0.04),0_12px_30px_rgba(17,17,17,0.05)] backdrop-blur dark:border-stone-800 dark:bg-stone-950/88">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-2xl font-semibold tabular-nums text-stone-950 dark:text-yellow-50">
                  {stats.total}
                </p>
                <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                  {t("historyPage.stats.storedSearchRuns")}
                </p>
              </div>
              <div className="h-9 w-px bg-stone-200 dark:bg-stone-800" />
              <div>
                <p className="text-2xl font-semibold tabular-nums text-stone-950 dark:text-yellow-50">
                  {stats.hits}
                </p>
                <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                  {t("historyPage.stats.searchRunsWithConfirmedHits")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void handleClearHistory()}
              >
                <Trash2 aria-hidden="true" size={13} />
                {t("options.history.clear")}
              </Button>
            </div>
          </div>
        </section>

        {/* Search + filters */}
        <section className="rounded-2xl border border-[var(--wf-border)] bg-[var(--wf-surface)] shadow-[0_1px_0_rgba(17,17,17,0.04),0_12px_30px_rgba(17,17,17,0.05)] backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
          <div className="p-4">
            <div className="flex gap-2">
              <label className="relative flex-1">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                  size={15}
                />
                <input
                  type="search"
                  aria-label={t("options.history.searchLabel")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("options.history.searchPlaceholder")}
                  className="h-10 w-full rounded-xl border border-[var(--wf-border-strong)] bg-[var(--wf-surface)] pl-9 pr-3 text-sm text-stone-950 transition hover:border-yellow-400 focus-visible:outline-yellow-400 dark:border-stone-700 dark:bg-stone-950 dark:text-yellow-50"
                />
              </label>
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition ${
                  filtersOpen || activeFilterCount > 0
                    ? "border-yellow-400 bg-yellow-50 text-stone-950 dark:border-yellow-300 dark:bg-yellow-300/15 dark:text-yellow-50"
                    : "border-[var(--wf-border-strong)] bg-[var(--wf-surface)] text-stone-600 hover:border-yellow-400 hover:bg-yellow-50 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300 dark:hover:border-yellow-300 dark:hover:bg-yellow-300/10"
                }`}
              >
                <SlidersHorizontal aria-hidden="true" size={14} />
                {t("historyPage.filters.toggle")}
                {activeFilterCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-bold text-stone-950">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-10 items-center gap-1 rounded-xl border border-[var(--wf-border)] bg-[var(--wf-surface)] px-3 text-sm text-stone-500 transition hover:border-[var(--wf-border-strong)] hover:text-stone-950 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-400 dark:hover:border-stone-700 dark:hover:text-yellow-50"
                >
                  <X aria-hidden="true" size={14} />
                  {t("historyPage.filters.clear")}
                </button>
              )}
            </div>

            <AnimatePresence>
              {filtersOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 grid gap-3 border-t border-[var(--wf-border)] pt-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-stone-900">
                    <SelectField
                      label={t("options.history.filters.outcome")}
                      value={outcomeFilter}
                      onChange={(v) => setOutcomeFilter(v)}
                      options={[
                        { value: "all", label: t("options.history.filters.allOutcomes") },
                        { value: "hit", label: t("options.history.outcome.hit") },
                        { value: "miss", label: t("options.history.outcome.miss") },
                        { value: "unknown", label: t("options.history.outcome.unknown") }
                      ]}
                    />
                    <SelectField
                      label={t("options.history.filters.trigger")}
                      value={triggerFilter}
                      onChange={(v) => setTriggerFilter(v)}
                      options={[
                        { value: "all", label: t("options.history.filters.allTriggers") },
                        { value: "broken-page", label: t("options.history.trigger.broken-page") },
                        { value: "manual-page", label: t("options.history.trigger.manual-page") },
                        { value: "context-menu", label: t("options.history.trigger.context-menu") },
                        {
                          value: "provider-direct",
                          label: t("options.history.trigger.provider-direct")
                        },
                        {
                          value: "all-archives",
                          label: t("options.history.trigger.all-archives")
                        }
                      ]}
                    />
                    <SelectField
                      label={t("options.history.filters.provider")}
                      value={providerFilter}
                      onChange={(v) => setProviderFilter(v)}
                      options={[
                        { value: "all", label: t("options.history.filters.allProviders") },
                        ...providerOptions.map((id) => ({
                          value: id,
                          label: PROVIDERS[id].displayName
                        }))
                      ]}
                    />
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-semibold text-stone-950 dark:text-yellow-50">
                        {t("options.history.filters.dateFrom")}
                      </span>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="h-10 rounded-xl border border-[var(--wf-border-strong)] bg-[var(--wf-surface)] px-3 text-sm text-stone-950 transition hover:border-yellow-400 focus-visible:outline-yellow-400 dark:border-stone-700 dark:bg-stone-950 dark:text-yellow-50"
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-semibold text-stone-950 dark:text-yellow-50">
                        {t("options.history.filters.dateTo")}
                      </span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="h-10 rounded-xl border border-[var(--wf-border-strong)] bg-[var(--wf-surface)] px-3 text-sm text-stone-950 transition hover:border-yellow-400 focus-visible:outline-yellow-400 dark:border-stone-700 dark:bg-stone-950 dark:text-yellow-50"
                      />
                    </label>
                    <SelectField
                      label={t("historyPage.sort.label")}
                      value={sortMode}
                      onChange={(value) => setSortMode(value)}
                      options={[
                        { value: "startedAtDesc", label: t("historyPage.sort.startedAtDesc") },
                        { value: "startedAtAsc", label: t("historyPage.sort.startedAtAsc") },
                        { value: "outcome", label: t("historyPage.sort.outcome") },
                        { value: "provider", label: t("historyPage.sort.provider") },
                        { value: "snapshotCount", label: t("historyPage.sort.snapshotCount") }
                      ]}
                    />
                    <SelectField
                      label={t("historyPage.view.label")}
                      value={viewMode}
                      onChange={(value) => setViewMode(value)}
                      options={[
                        { value: "compact", label: t("historyPage.view.compact") },
                        { value: "detailed", label: t("historyPage.view.detailed") }
                      ]}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--wf-border)] pt-4 dark:border-stone-900">
                    <Button type="button" variant="secondary" size="sm" onClick={() => void handleSavePreset()}>
                      {t("historyPage.presets.save")}
                    </Button>
                    {settings.historyFilterPresets.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400 dark:text-stone-500">
                          {t("historyPage.presets.label")}
                        </span>
                        {settings.historyFilterPresets.map((preset) => (
                          <div
                            key={preset.id}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--wf-border)] bg-[var(--wf-surface)] px-2 py-1 text-xs dark:border-stone-800 dark:bg-stone-950"
                          >
                            <button
                              type="button"
                              className="text-stone-700 transition hover:text-stone-950 dark:text-stone-300 dark:hover:text-yellow-50"
                              onClick={() => applyPreset(preset)}
                            >
                              {preset.name}
                            </button>
                            <button
                              type="button"
                              aria-label={t("historyPage.presets.delete", { name: preset.name })}
                              className="text-stone-400 transition hover:text-stone-950 dark:text-stone-500 dark:hover:text-yellow-50"
                              onClick={() => void handleDeletePreset(preset.id)}
                            >
                              <X aria-hidden="true" size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-stone-500 dark:text-stone-400">
                        {t("historyPage.presets.empty")}
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* History list */}
        <section className="overflow-hidden rounded-2xl border border-[var(--wf-border)] bg-[var(--wf-surface)] shadow-[0_1px_0_rgba(17,17,17,0.04),0_12px_30px_rgba(17,17,17,0.05)] dark:border-stone-800 dark:bg-stone-950/92">
          {history.length === 0 ? (
            <EmptyState message={t("options.history.empty")} />
          ) : filteredHistory.length === 0 ? (
            <EmptyState message={t("options.history.noMatches")} />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--wf-border)] px-5 py-3 dark:border-stone-900">
                <label className="inline-flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => toggleVisibleSelection(e.target.checked)}
                    aria-label={t("historyPage.selection.selectVisible")}
                    className="h-4 w-4 rounded border-[var(--wf-border-strong)] text-yellow-500 focus:ring-yellow-400 dark:border-stone-700 dark:bg-stone-950"
                  />
                  <span>{t("historyPage.selection.selectVisible")}</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500 dark:text-stone-400">
                    {selectedCount > 0
                      ? t("historyPage.selection.selectedCount", { count: String(selectedCount) })
                      : t("historyPage.selection.none")}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleDeleteSelected()}
                    disabled={selectedCount === 0}
                  >
                    <Trash2 aria-hidden="true" size={13} />
                    {t("historyPage.delete.bulkAction")}
                  </Button>
                  {selectedCount > 0 ? (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          downloadHistoryCsv(selectedEntries, {
                            mode: "selected",
                            filtersApplied: buildFiltersApplied("selected")
                          })
                        }
                      >
                        <Download aria-hidden="true" size={13} />
                        {t("historyPage.selection.exportSelected")}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleRerunSelected()}
                      >
                        <RotateCcw aria-hidden="true" size={13} />
                        {t("historyPage.selection.rerunSelected")}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
              <ul role="list" className="divide-y divide-[var(--wf-border)] dark:divide-stone-900">
                {visibleHistory.map((entry) => (
                  <HistoryCard
                    key={entry.id}
                    entry={entry}
                    viewMode={viewMode}
                    selected={selectedIdSet.has(entry.id)}
                    onSelectedChange={toggleEntrySelection}
                    onDelete={handleDeleteEntry}
                  />
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--wf-border)] px-5 py-3 dark:border-stone-900">
                <p className="text-xs text-stone-400 dark:text-stone-500">
                  {t("historyPage.pagination.status", {
                    start: String(sortedHistory.length === 0 ? 0 : pageStart + 1),
                    end: String(Math.min(pageStart + PAGE_SIZE, sortedHistory.length)),
                    total: String(sortedHistory.length)
                  })}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft aria-hidden="true" size={14} />
                    {t("historyPage.pagination.previous")}
                  </Button>
                  <span className="min-w-[80px] text-center text-xs text-stone-500 dark:text-stone-400">
                    {t("historyPage.pagination.page", {
                      page: String(currentPage),
                      total: String(totalPages)
                    })}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    {t("historyPage.pagination.next")}
                    <ChevronRight aria-hidden="true" size={14} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-stone-500 hover:text-stone-950 dark:text-stone-400 dark:hover:text-yellow-50"
            onClick={() => downloadHistoryCsv(history, { mode: "full", filtersApplied: buildFiltersApplied("full") })}
            disabled={history.length === 0}
          >
            <Download aria-hidden="true" size={13} />
            {t("historyPage.exportFullCsv")}
          </Button>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-stone-500 hover:text-stone-950 dark:text-stone-400 dark:hover:text-yellow-50"
              onClick={() =>
                downloadHistoryCsv(sortedHistory, {
                  mode: "current-view",
                  filtersApplied: buildFiltersApplied("current-view")
                })
              }
              disabled={sortedHistory.length === 0}
            >
              <Download aria-hidden="true" size={13} />
              {t("historyPage.exportCurrentViewCsv")}
            </Button>
          )}
        </div>

        <ResearcherFooter />
      </div>
    </PageShell>
  );
}

function HistoryCard({
  entry,
  viewMode,
  selected,
  onSelectedChange,
  onDelete
}: {
  entry: HistoryEntry;
  viewMode: HistoryViewMode;
  selected: boolean;
  onSelectedChange: (entryId: string, checked: boolean) => void;
  onDelete: (entryId: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const { locale, t } = useI18n();

  const url = tryParseUrl(entry.targetUrl);
  const hostname = url?.hostname ?? entry.targetUrl;
  const pathname = url ? url.pathname + (url.search || "") : "";
  const showPathname = !!pathname && pathname !== "/";
  const hasSnapshots = entry.resultSnapshots.length > 0;
  const hasFailedProviders = (entry.failedProviders?.length ?? 0) > 0;
  const hasCheckedAttempts = (entry.checkedAttempts?.length ?? 0) > 0;
  const showExpandedDetails = viewMode === "detailed" || expanded;

  const accentClass = {
    hit: "border-l-emerald-400 dark:border-l-emerald-500",
    miss: "border-l-stone-300 dark:border-l-stone-700",
    unknown: "border-l-amber-400 dark:border-l-amber-500"
  } as Record<HistoryOutcome, string>;

  return (
    <li className={`border-l-[3px] ${accentClass[entry.outcome]}`}>
      <div className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-[var(--wf-surface-raised)] dark:hover:bg-stone-900/40">
        <label className="pt-1">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelectedChange(entry.id, e.target.checked)}
            aria-label={t("historyPage.selection.selectEntry", { url: entry.targetUrl })}
            className="h-4 w-4 rounded border-[var(--wf-border-strong)] text-yellow-500 focus:ring-yellow-400 dark:border-stone-700 dark:bg-stone-950"
          />
        </label>
        <div className="min-w-0 flex-1">
          {/* URL + timestamp */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p
                className="truncate font-medium text-stone-950 dark:text-yellow-50"
                title={entry.targetUrl}
              >
                {hostname}
              </p>
              {showPathname && (
                <p className="truncate text-xs text-stone-500 dark:text-stone-400">{pathname}</p>
              )}
            </div>
            <time
              className="shrink-0 text-xs tabular-nums text-stone-400 dark:text-stone-500"
              title={formatDateTime(entry.startedAt, locale)}
            >
              {formatRelativeTime(entry.startedAt, locale)}
            </time>
          </div>

          {/* Badges + snapshot toggle */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <OutcomeBadge outcome={entry.outcome} />
            <TriggerChip trigger={entry.trigger} />
            {(hasSnapshots || hasFailedProviders || hasCheckedAttempts) && viewMode === "compact" && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-stone-500 transition hover:bg-[var(--wf-surface-muted)] hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-yellow-50"
              >
                {expanded ? (
                  <ChevronUp aria-hidden="true" size={12} />
                ) : (
                  <ChevronDown aria-hidden="true" size={12} />
                )}
                {t("historyPage.card.snapshots", {
                  count: String(entry.resultSnapshots.length)
                })}
              </button>
            )}
          </div>

          {viewMode === "detailed" && hasCheckedAttempts ? (
            <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
              {t("historyPage.card.checkedAttempts", { count: String(entry.checkedAttempts?.length ?? 0) })}
            </p>
          ) : null}

          <AnimatePresence>
            {showExpandedDetails && (hasSnapshots || hasFailedProviders || hasCheckedAttempts) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-3 border-t border-[var(--wf-border)] pt-3 dark:border-stone-900">
                  {hasSnapshots ? (
                    <ul className="space-y-2">
                      {entry.resultSnapshots.map((snapshot, index) => (
                        <li
                          key={`${snapshot.openUrl ?? snapshot.archiveUrl}:${index}`}
                          className="rounded-xl border border-[var(--wf-border)] bg-[var(--wf-surface-muted)] px-3 py-2.5 dark:border-stone-800 dark:bg-stone-900/60"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-stone-900 dark:text-yellow-50">
                              {PROVIDERS[snapshot.providerId].displayName}
                            </span>
                            <span className="text-xs text-stone-400 dark:text-stone-500">
                              {snapshot.timestamp}
                            </span>
                          </div>
                          <a
                            href={snapshot.openUrl ?? snapshot.archiveUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 flex items-start gap-1 break-all text-xs text-stone-500 underline-offset-2 transition hover:text-yellow-600 hover:underline dark:text-stone-400 dark:hover:text-yellow-400"
                          >
                            <ExternalLink aria-hidden="true" size={11} className="mt-px shrink-0" />
                            {snapshot.openUrl ?? snapshot.archiveUrl}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {viewMode === "detailed" && hasFailedProviders ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900/60 dark:bg-amber-900/10">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                        {t("historyPage.card.failedProviders")}
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {entry.failedProviders?.map((provider) => (
                          <li key={provider.providerId} className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                            <AlertTriangle aria-hidden="true" size={12} className="mt-0.5 shrink-0" />
                            <span>
                              {PROVIDERS[provider.providerId].displayName}
                              {provider.reason ? ` · ${provider.reason}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="px-2 text-stone-500 hover:text-stone-950 dark:text-stone-400 dark:hover:text-yellow-50"
            aria-label={t("historyPage.delete.singleAction")}
            onClick={() => void onDelete(entry.id)}
          >
            <Trash2 aria-hidden="true" size={13} />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={() => void handleRerunEntry(entry)}
          >
            <RotateCcw aria-hidden="true" size={13} />
            {t("historyPage.table.rerun")}
          </Button>
        </div>
      </div>
    </li>
  );
}

function OutcomeBadge({ outcome }: { outcome: HistoryOutcome }) {
  const { t } = useI18n();
  const labels: Record<HistoryOutcome, "options.history.outcome.hit" | "options.history.outcome.miss" | "options.history.outcome.unknown"> = {
    hit: "options.history.outcome.hit",
    miss: "options.history.outcome.miss",
    unknown: "options.history.outcome.unknown"
  };
  const classes = {
    hit: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    miss: "bg-[var(--wf-surface-muted)] text-stone-600 dark:bg-stone-800 dark:text-stone-400",
    unknown: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
  } as Record<HistoryOutcome, string>;

  const dotClasses = {
    hit: "bg-emerald-500",
    miss: "bg-stone-400",
    unknown: "bg-amber-400"
  } as Record<HistoryOutcome, string>;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${classes[outcome]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClasses[outcome]}`} />
      {t(labels[outcome])}
    </span>
  );
}

function TriggerChip({ trigger }: { trigger: HistoryTrigger }) {
  const { t } = useI18n();
  const labels: Record<
    HistoryTrigger,
    | "options.history.trigger.broken-page"
    | "options.history.trigger.manual-page"
    | "options.history.trigger.context-menu"
    | "options.history.trigger.provider-direct"
    | "options.history.trigger.all-archives"
  > = {
    "broken-page": "options.history.trigger.broken-page",
    "manual-page": "options.history.trigger.manual-page",
    "context-menu": "options.history.trigger.context-menu",
    "provider-direct": "options.history.trigger.provider-direct",
    "all-archives": "options.history.trigger.all-archives"
  };
  return (
    <span className="inline-flex rounded-full border border-[var(--wf-border)] bg-[var(--wf-surface-muted)] px-2 py-0.5 text-[11px] text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400">
      {t(labels[trigger])}
    </span>
  );
}

async function handleRerunEntry(entry: HistoryEntry) {
  const historyEntry = await createHistoryEntry({
    targetUrl: entry.targetUrl,
    trigger: "manual-page",
    requestTrigger: "manual-page"
  });

  await browser.tabs.create({
    url: resolverUrl(createManualPageLookupRequest(entry.targetUrl), undefined, undefined, historyEntry?.id),
    active: true
  });
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
      <p className="text-sm text-stone-500 dark:text-stone-400">{message}</p>
    </div>
  );
}

function tryParseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function formatDateTime(timestamp: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(timestamp);
}

function formatRelativeTime(timestamp: number, locale: string) {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (diffDay >= 365) return rtf.format(-Math.floor(diffDay / 365), "year");
  if (diffDay >= 30) return rtf.format(-Math.floor(diffDay / 30), "month");
  if (diffDay >= 1) return rtf.format(-diffDay, "day");
  if (diffHour >= 1) return rtf.format(-diffHour, "hour");
  if (diffMin >= 1) return rtf.format(-diffMin, "minute");
  return rtf.format(-diffSec, "second");
}

function downloadHistoryCsv(
  history: HistoryEntry[],
  metadata: {
    mode: "full" | "current-view" | "selected";
    filtersApplied: string;
  }
) {
  const csv = buildHistoryCsv(history, metadata);
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `pastpage-history-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

function buildHistoryCsv(
  history: HistoryEntry[],
  metadata: {
    mode: "full" | "current-view" | "selected";
    filtersApplied: string;
  }
): string {
  const providerColumns = getProviderColumns(history);
  const providerKeys = providerColumns.map((providerId) => [providerId, toCamelCaseHeader(PROVIDERS[providerId].displayName)] as const);
  const snapshotWidths = getSnapshotWidths(history, providerColumns);
  const attemptWidths = getAttemptWidths(history, providerColumns);
  const exportedAt = new Date().toISOString();

  const header = [
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
  ];

  const snapshotHeaders = providerKeys.flatMap(([providerId, providerKey]) =>
    Array.from({ length: snapshotWidths.get(providerId) ?? 0 }, (_, index) => {
      const suffix = index === 0 ? "" : String(index + 1);
      return [`${providerKey}Timestamp${suffix}`, `${providerKey}Url${suffix}`];
    }).flat()
  );

  const failureHeaders = providerKeys.flatMap(([, providerKey]) => [
    `${providerKey}Failed`,
    `${providerKey}FailureReason`,
    `${providerKey}DirectLink`
  ]);

  const attemptHeaders = providerKeys.flatMap(([providerId, providerKey]) =>
    Array.from({ length: attemptWidths.get(providerId) ?? 0 }, (_, index) => [
      `${providerKey}Attempt${index + 1}Strategy`,
      `${providerKey}Attempt${index + 1}Outcome`,
      `${providerKey}Attempt${index + 1}Url`
    ]).flat()
  );

  const rows = history.map((entry) => [
    exportedAt,
    HISTORY_SCHEMA_VERSION,
    metadata.filtersApplied,
    entry.id,
    new Date(entry.startedAt).toISOString(),
    entry.resolvedAt ? new Date(entry.resolvedAt).toISOString() : "",
    entry.targetUrl,
    entry.trigger,
    entry.requestTrigger ?? "",
    entry.scopedProviderId ?? "",
    entry.outcome,
    String(entry.resultSnapshots.length),
    ...providerColumns.flatMap((providerId) => {
      const snapshots = entry.resultSnapshots.filter((candidate) => candidate.providerId === providerId);
      const width = snapshotWidths.get(providerId) ?? 0;
      return Array.from({ length: width }, (_, index) => {
        const snapshot = snapshots[index];
        return snapshot ? [snapshot.timestamp, snapshot.openUrl ?? snapshot.archiveUrl] : ["", ""];
      }).flat();
    }),
    ...providerColumns.flatMap((providerId) => {
      const failedProvider = entry.failedProviders?.find((provider) => provider.providerId === providerId);
      return failedProvider
        ? ["true", failedProvider.reason ?? "", failedProvider.directLink ?? ""]
        : ["false", "", ""];
    }),
    ...providerColumns.flatMap((providerId) => {
      const attempts = entry.checkedAttempts?.filter((attempt) => attempt.providerId === providerId) ?? [];
      const width = attemptWidths.get(providerId) ?? 0;
      return Array.from({ length: width }, (_, index) => {
        const attempt = attempts[index];
        return attempt ? [attempt.strategy, attempt.outcome, attempt.url] : ["", "", ""];
      }).flat();
    })
  ]);

  return [[...header, ...snapshotHeaders, ...failureHeaders, ...attemptHeaders], ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");
}

function escapeCsvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function toCamelCaseHeader(value: string): string {
  const words = value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

function getProviderColumns(history: HistoryEntry[]): ProviderId[] {
  const providerIdsInExport = new Set<ProviderId>();
  for (const entry of history) {
    for (const snapshot of entry.resultSnapshots) providerIdsInExport.add(snapshot.providerId);
    for (const failedProvider of entry.failedProviders ?? []) providerIdsInExport.add(failedProvider.providerId);
    for (const attempt of entry.checkedAttempts ?? []) providerIdsInExport.add(attempt.providerId);
  }

  const orderedProviderColumns = PRODUCT_PROVIDER_ORDER.filter((providerId) => providerIdsInExport.has(providerId));
  const missingProviderColumns = Array.from(providerIdsInExport).filter(
    (providerId) => !orderedProviderColumns.includes(providerId)
  );
  return [...orderedProviderColumns, ...missingProviderColumns];
}

function getSnapshotWidths(history: HistoryEntry[], providerColumns: ProviderId[]): Map<ProviderId, number> {
  const widths = new Map<ProviderId, number>();
  for (const providerId of providerColumns) {
    widths.set(
      providerId,
      history.reduce((max, entry) => {
        const count = entry.resultSnapshots.filter((snapshot) => snapshot.providerId === providerId).length;
        return Math.max(max, count);
      }, 0)
    );
  }
  return widths;
}

function getAttemptWidths(history: HistoryEntry[], providerColumns: ProviderId[]): Map<ProviderId, number> {
  const widths = new Map<ProviderId, number>();
  for (const providerId of providerColumns) {
    widths.set(
      providerId,
      history.reduce((max, entry) => {
        const count = (entry.checkedAttempts ?? []).filter((attempt) => attempt.providerId === providerId).length;
        return Math.max(max, count);
      }, 0)
    );
  }
  return widths;
}

function compareHistoryEntries(left: HistoryEntry, right: HistoryEntry, sortMode: HistorySortMode): number {
  switch (sortMode) {
    case "startedAtAsc":
      return left.startedAt - right.startedAt;
    case "snapshotCount": {
      const diff = right.resultSnapshots.length - left.resultSnapshots.length;
      return diff || right.startedAt - left.startedAt;
    }
    case "provider": {
      const leftProviderIndex = getPrimaryProviderIndex(left);
      const rightProviderIndex = getPrimaryProviderIndex(right);
      return leftProviderIndex - rightProviderIndex || right.startedAt - left.startedAt;
    }
    case "outcome": {
      const outcomeOrder: Record<HistoryOutcome, number> = {
        hit: 0,
        unknown: 1,
        miss: 2
      };
      return outcomeOrder[left.outcome] - outcomeOrder[right.outcome] || right.startedAt - left.startedAt;
    }
    case "startedAtDesc":
    default:
      return right.startedAt - left.startedAt;
  }
}

function getPrimaryProviderIndex(entry: HistoryEntry): number {
  if (entry.scopedProviderId) {
    return PRODUCT_PROVIDER_INDEX.get(entry.scopedProviderId) ?? Number.MAX_SAFE_INTEGER;
  }

  const snapshotProviderIds = Array.from(new Set(entry.resultSnapshots.map((snapshot) => snapshot.providerId)));
  const sortedProviderId = snapshotProviderIds.sort(
    (left, right) =>
      (PRODUCT_PROVIDER_INDEX.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (PRODUCT_PROVIDER_INDEX.get(right) ?? Number.MAX_SAFE_INTEGER)
  )[0];
  return sortedProviderId ? (PRODUCT_PROVIDER_INDEX.get(sortedProviderId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
}
