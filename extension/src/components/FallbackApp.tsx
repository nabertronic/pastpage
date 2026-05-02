import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import { Button, LinkButton } from "./Button";
import { ErrorSummary } from "./ErrorSummary";
import { PageShell } from "./PageShell";
import { ResearcherFooter } from "./AppLinks";
import { explainHttpStatus, explainNavigationError } from "../core/errors";
import { createBrokenPageLookupRequest } from "../core/lookupRequest";
import { DEFAULT_SETTINGS, type Settings } from "../core/settings";
import type { DetectedError } from "../core/tabState";
import { I18nProvider, resolveLocaleFromLanguageMode, useI18n } from "../i18n";
import { getSettings } from "../platform/storage";
import { useAppliedTheme } from "./useAppliedTheme";

function errorFromParams(params: URLSearchParams): DetectedError {
  const originalUrl = params.get("url") ?? "";
  const statusCodeRaw = params.get("statusCode");
  const statusCode = statusCodeRaw ? Number(statusCodeRaw) : undefined;
  const browserError = params.get("browserError") ?? undefined;
  const kind = (params.get("kind") === "http" ? "http" : "navigation") as DetectedError["kind"];

  return {
    kind,
    originalUrl,
    statusCode,
    browserError,
    explanation:
      kind === "http" ? explainHttpStatus(statusCode ?? 0) : explainNavigationError(browserError),
    detectedAt: Date.now()
  };
}

export function FallbackApp() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const error = useMemo(() => errorFromParams(new URLSearchParams(window.location.search)), []);

  useAppliedTheme(settings.themeMode);

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  async function findArchivedVersion() {
    await browser.runtime.sendMessage({
      type: "START_RESOLVER",
      request: createBrokenPageLookupRequest(error),
      historyTrigger: "broken-page"
    });
  }

  return (
    <I18nProvider locale={resolveLocaleFromLanguageMode(settings.language)}>
      <FallbackContent error={error} onFindArchivedVersion={findArchivedVersion} />
    </I18nProvider>
  );
}

function FallbackContent({
  error,
  onFindArchivedVersion
}: {
  error: DetectedError;
  onFindArchivedVersion: () => Promise<void>;
}) {
  const { t } = useI18n();

  return (
    <PageShell title={t("fallback.title")} description={t("fallback.description")}>
      <div className="space-y-4">
        <ErrorSummary error={error} />

        <section className="flex flex-wrap gap-2 rounded-md border border-stone-200 bg-white/95 p-4 shadow-sm backdrop-blur dark:border-stone-800 dark:bg-stone-950/92">
          <Button onClick={() => void onFindArchivedVersion()}>
            <Search aria-hidden="true" size={16} />
            {t("popup.findArchivedVersion")}
          </Button>
          <LinkButton href={error.originalUrl} variant="secondary">
            <RotateCcw aria-hidden="true" size={16} />
            {t("fallback.tryOriginalAgain")}
          </LinkButton>
        </section>

        <ResearcherFooter />
      </div>
    </PageShell>
  );
}
