import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
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
import { DEFAULT_SETTINGS, type Settings } from "../core/settings";
import { clearHistory, getHistory, getSettings } from "../platform/storage";
import { resolverUrl } from "../platform/urls";
import { useAppliedTheme } from "./useAppliedTheme";

const PAGE_SIZE = 25;

export function HistoryApp() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useAppliedTheme(settings.themeMode);

  useEffect(() => {
    void Promise.all([getSettings(), getHistory()]).then(([nextSettings, nextHistory]) => {
      setSettings(nextSettings);
      setHistory(nextHistory);
    });
  }, []);

  return (
    <I18nProvider locale={resolveLocaleFromLanguageMode(settings.language)}>
      <HistoryContent history={history} settings={settings} setHistory={setHistory} />
    </I18nProvider>
  );
}

function HistoryContent({
  history,
  settings,
  setHistory
}: {
  history: HistoryEntry[];
  settings: Settings;
  setHistory: (history: HistoryEntry[]) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<HistoryOutcome | "all">("all");
  const [triggerFilter, setTriggerFilter] = useState<HistoryTrigger | "all">("all");
  const [providerFilter, setProviderFilter] = useState<ProviderId | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  useEffect(() => {
    setPage(1);
  }, [query, outcomeFilter, triggerFilter, providerFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleHistory = filteredHistory.slice(pageStart, pageStart + PAGE_SIZE);

  function clearFilters() {
    setQuery("");
    setOutcomeFilter("all");
    setTriggerFilter("all");
    setProviderFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  async function handleClearHistory() {
    if (!window.confirm(t("options.history.clearConfirm"))) return;
    await clearHistory();
    setHistory([]);
  }

  const hasActiveFilters = activeFilterCount > 0 || !!query;

  return (
    <PageShell title={t("historyPage.title")} description={t("historyPage.description")}>
      <div className="space-y-4">
        {/* Stats + status bar */}
        <section className="rounded-2xl border border-stone-200 bg-white/90 shadow-sm backdrop-blur dark:border-stone-800 dark:bg-stone-950/88">
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
        <section className="rounded-2xl border border-stone-200 bg-white/92 shadow-sm backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
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
                  className="h-10 w-full rounded-xl border border-stone-300 bg-white pl-9 pr-3 text-sm text-stone-950 transition hover:border-yellow-400 focus-visible:outline-yellow-400 dark:border-stone-700 dark:bg-stone-950 dark:text-yellow-50"
                />
              </label>
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition ${
                  filtersOpen || activeFilterCount > 0
                    ? "border-yellow-400 bg-yellow-50 text-stone-950 dark:border-yellow-300 dark:bg-yellow-300/15 dark:text-yellow-50"
                    : "border-stone-300 bg-white text-stone-600 hover:border-yellow-400 hover:bg-yellow-50 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300 dark:hover:border-yellow-300 dark:hover:bg-yellow-300/10"
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
                  className="inline-flex h-10 items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-500 transition hover:border-stone-300 hover:text-stone-950 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-400 dark:hover:border-stone-700 dark:hover:text-yellow-50"
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
                  <div className="mt-4 grid gap-3 border-t border-stone-100 pt-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-stone-900">
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
                        className="h-10 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 transition hover:border-yellow-400 focus-visible:outline-yellow-400 dark:border-stone-700 dark:bg-stone-950 dark:text-yellow-50"
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
                        className="h-10 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 transition hover:border-yellow-400 focus-visible:outline-yellow-400 dark:border-stone-700 dark:bg-stone-950 dark:text-yellow-50"
                      />
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* History list */}
        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white/94 shadow-sm dark:border-stone-800 dark:bg-stone-950/92">
          {history.length === 0 ? (
            <EmptyState message={t("options.history.empty")} />
          ) : filteredHistory.length === 0 ? (
            <EmptyState message={t("options.history.noMatches")} />
          ) : (
            <>
              <ul role="list" className="divide-y divide-stone-100 dark:divide-stone-900">
                {visibleHistory.map((entry) => (
                  <HistoryCard key={entry.id} entry={entry} />
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-5 py-3 dark:border-stone-900">
                <p className="text-xs text-stone-400 dark:text-stone-500">
                  {t("historyPage.pagination.status", {
                    start: String(filteredHistory.length === 0 ? 0 : pageStart + 1),
                    end: String(Math.min(pageStart + PAGE_SIZE, filteredHistory.length)),
                    total: String(filteredHistory.length)
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

        <ResearcherFooter />
      </div>
    </PageShell>
  );
}

function HistoryCard({ entry }: { entry: HistoryEntry }) {
  const [expanded, setExpanded] = useState(false);
  const { locale, t } = useI18n();

  const url = tryParseUrl(entry.targetUrl);
  const hostname = url?.hostname ?? entry.targetUrl;
  const pathname = url ? url.pathname + (url.search || "") : "";
  const showPathname = !!pathname && pathname !== "/";
  const hasSnapshots = entry.resultSnapshots.length > 0;

  const accentClass = {
    hit: "border-l-emerald-400 dark:border-l-emerald-500",
    miss: "border-l-stone-300 dark:border-l-stone-700",
    unknown: "border-l-amber-400 dark:border-l-amber-500"
  } as Record<HistoryOutcome, string>;

  return (
    <li className={`border-l-[3px] ${accentClass[entry.outcome]}`}>
      <div className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-stone-50/80 dark:hover:bg-stone-900/40">
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
            {hasSnapshots && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-yellow-50"
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

          {/* Expandable snapshots */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <ul className="mt-3 space-y-2 border-t border-stone-100 pt-3 dark:border-stone-900">
                  {entry.resultSnapshots.map((snapshot, index) => (
                    <li
                      key={`${snapshot.openUrl ?? snapshot.archiveUrl}:${index}`}
                      className="rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2.5 dark:border-stone-800 dark:bg-stone-900/60"
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
                        <ExternalLink
                          aria-hidden="true"
                          size={11}
                          className="mt-px shrink-0"
                        />
                        {snapshot.openUrl ?? snapshot.archiveUrl}
                      </a>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Rerun */}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={() =>
            void browser.tabs.create({
              url: resolverUrl(createManualPageLookupRequest(entry.targetUrl)),
              active: true
            })
          }
        >
          <RotateCcw aria-hidden="true" size={13} />
          {t("historyPage.table.rerun")}
        </Button>
      </div>
    </li>
  );
}

function OutcomeBadge({ outcome }: { outcome: HistoryOutcome }) {
  const { t } = useI18n();
  const classes = {
    hit: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    miss: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400",
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
      {t(`options.history.outcome.${outcome}` as const)}
    </span>
  );
}

function TriggerChip({ trigger }: { trigger: HistoryTrigger }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600 dark:bg-stone-800 dark:text-stone-400">
      {t(`options.history.trigger.${trigger}` as const)}
    </span>
  );
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
