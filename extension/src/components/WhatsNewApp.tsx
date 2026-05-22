import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Sparkles, Star } from "lucide-react";
import { WHATS_NEW_ENTRIES } from "../generated/changelog";
import type { WhatsNewEntry } from "../core/whatsNew";
import { DEFAULT_SETTINGS, type Settings } from "../core/settings";
import { I18nProvider, resolveLocaleFromLanguageMode, useI18n } from "../i18n";
import type { SupportedLocale } from "../i18n/messages";
import { getSettings, markWhatsNewVersionSeen } from "../platform/storage";
import { getExtensionBrowser, getExtensionStoreUrl, getExtensionVersion, hasExtensionStoreListing } from "../platform/runtimeInfo";
import { LinkButton } from "./Button";
import { PageShell } from "./PageShell";
import { ResearcherFooter } from "./AppLinks";
import { useAppliedTheme } from "./useAppliedTheme";
import { cn } from "../lib/cn";

export function WhatsNewApp() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useAppliedTheme(settings.themeMode);

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    void markWhatsNewVersionSeen(getExtensionVersion());
  }, []);

  return (
    <I18nProvider locale={resolveLocaleFromLanguageMode(settings.language)}>
      <WhatsNewContent entries={WHATS_NEW_ENTRIES} />
    </I18nProvider>
  );
}

function WhatsNewContent({ entries }: { entries: WhatsNewEntry[] }) {
  const { locale, t } = useI18n();
  const browserName = getExtensionBrowser();
  const currentVersion = getExtensionVersion();
  const storeUrl = getExtensionStoreUrl(browserName);
  const currentVersionTag = `v${currentVersion}`;
  const defaultOpenVersion =
    entries.find((entry) => entry.version === currentVersionTag)?.version ?? entries[0]?.version ?? null;
  const [openVersions, setOpenVersions] = useState<string[]>(() => (defaultOpenVersion ? [defaultOpenVersion] : []));

  function toggleVersion(version: string) {
    setOpenVersions((current) =>
      current.includes(version) ? current.filter((item) => item !== version) : [...current, version]
    );
  }

  return (
    <PageShell title={t("whatsNew.title")} description={t("whatsNew.description")}>
      <div className="space-y-4">
        <section className="rounded-md border border-[var(--wf-border)] bg-[var(--wf-surface)] p-4 shadow-[0_1px_0_rgba(17,17,17,0.04),0_12px_30px_rgba(17,17,17,0.05)] backdrop-blur dark:border-stone-800 dark:bg-stone-950/92">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-yellow-300/70 bg-yellow-100/80 px-3 py-1 text-xs font-semibold text-stone-900 dark:border-yellow-300/30 dark:bg-yellow-300/10 dark:text-yellow-100">
              <Sparkles aria-hidden="true" size={14} />
              {t("whatsNew.releaseNotes")}
            </span>
            <p className="text-sm leading-6 text-stone-600 dark:text-stone-300">
              {t("whatsNew.currentVersion", { version: currentVersion })}
            </p>
          </div>
        </section>

        {hasExtensionStoreListing(browserName) && storeUrl ? (
          <section className="rounded-md border border-yellow-300/60 bg-yellow-100/75 px-4 py-2.5 shadow-[0_1px_0_rgba(17,17,17,0.04),0_8px_24px_rgba(255,212,0,0.12)] backdrop-blur dark:border-yellow-300/30 dark:bg-yellow-300/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm leading-6 text-stone-800 dark:text-yellow-50">
                {browserName === "firefox" ? t("whatsNew.promoteFirefox") : t("whatsNew.promoteChrome")}
              </p>
              <LinkButton href={storeUrl} target="_blank" rel="noreferrer" size="sm" className="shrink-0">
                <Star aria-hidden="true" size={14} />
                {browserName === "firefox" ? t("whatsNew.promoteCtaFirefox") : t("whatsNew.promoteCtaChrome")}
              </LinkButton>
            </div>
          </section>
        ) : null}

        {entries.length ? (
          <div className="space-y-3">
            {entries.map((entry, index) => {
              const isOpen = openVersions.includes(entry.version);
              return (
                <section
                  key={entry.version}
                  className={cn(
                    "overflow-hidden rounded-md border bg-[var(--wf-surface)] shadow-[0_1px_0_rgba(17,17,17,0.04),0_12px_30px_rgba(17,17,17,0.05)] backdrop-blur dark:bg-stone-950/92",
                    isOpen
                      ? "border-yellow-300 dark:border-yellow-300/40"
                      : "border-[var(--wf-border)] dark:border-stone-800"
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-yellow-50/70 focus-visible:outline-yellow-400 dark:hover:bg-yellow-300/10"
                    aria-expanded={isOpen}
                    aria-label={isOpen ? t("whatsNew.collapse", { version: entry.version }) : t("whatsNew.expand", { version: entry.version })}
                    onClick={() => toggleVersion(entry.version)}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-stone-950 dark:text-yellow-50">{entry.version}</h2>
                        {index === 0 ? (
                          <span className="rounded-full bg-stone-900 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-yellow-300 dark:bg-yellow-300 dark:text-stone-950">
                            {t("whatsNew.latestBadge")}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-stone-600 dark:text-stone-300">
                        {t("whatsNew.versionSummary", { count: entry.changes.length })}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md border border-[var(--wf-border)] bg-[var(--wf-surface-muted)] p-2 text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
                      {isOpen ? <ChevronUp aria-hidden="true" size={16} /> : <ChevronDown aria-hidden="true" size={16} />}
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="border-t border-[var(--wf-border)] px-4 py-4 dark:border-stone-800">
                      <ul className="space-y-3 text-sm leading-6 text-stone-700 dark:text-stone-200">
                        {entry.changes.map((change) => (
                          <li key={change} className="flex gap-3">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500 dark:bg-yellow-300" />
                            <span>{renderChangeText(change, locale)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        ) : (
          <section className="rounded-md border border-dashed border-[var(--wf-border-strong)] bg-[var(--wf-surface)] p-6 text-sm text-[var(--wf-muted)] shadow-[0_1px_0_rgba(17,17,17,0.04),0_12px_30px_rgba(17,17,17,0.05)] dark:border-stone-700 dark:bg-stone-950/70 dark:text-stone-300">
            {t("whatsNew.empty")}
          </section>
        )}

        <ResearcherFooter />
      </div>
    </PageShell>
  );
}

function renderChangeText(change: string, locale: SupportedLocale) {
  const segments = change.split("`");

  if (segments.length < 3) {
    return change;
  }

  const quotes = getInlineQuoteMarks(locale);

  return segments.map((segment, index) =>
    index % 2 === 1 ? (
      <Fragment key={`${change}-${index}`}>
        {quotes.open}
        {segment}
        {quotes.close}
      </Fragment>
    ) : (
      <Fragment key={`${change}-${index}`}>{segment}</Fragment>
    )
  );
}

function getInlineQuoteMarks(locale: SupportedLocale) {
  switch (locale) {
    case "de":
    case "pl":
      return { open: "„", close: "“" };
    case "fr":
      return { open: "«\u00a0", close: "\u00a0»" };
    case "es":
    case "it":
    case "pt":
      return { open: "«", close: "»" };
    case "uk":
      return { open: "«", close: "»" };
    case "en":
    default:
      return { open: "“", close: "”" };
  }
}
