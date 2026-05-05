import { useEffect, useMemo, useState } from "react";
import { Sparkles, Star } from "lucide-react";
import { LinkButton } from "./Button";
import { PageShell } from "./PageShell";
import { I18nProvider, resolveLocaleFromLanguageMode, useI18n } from "../i18n";
import { DEFAULT_SETTINGS, type Settings } from "../core/settings";
import { getLocalMeta, getSettings } from "../platform/storage";
import { getExtensionStoreUrl, hasExtensionStoreListing } from "../platform/runtimeInfo";
import { useAppliedTheme } from "./useAppliedTheme";

export function ThanksApp() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [searchCount, setSearchCount] = useState(1);

  useAppliedTheme(settings.themeMode);

  useEffect(() => {
    let active = true;
    void getSettings().then((current) => {
      if (active) setSettings(current);
    });
    void getLocalMeta().then((meta) => {
      if (active) setSearchCount(Math.max(meta.searchCount ?? 1, 1));
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <I18nProvider locale={resolveLocaleFromLanguageMode(settings.language)}>
      <ThanksContent searchCount={searchCount} />
    </I18nProvider>
  );
}

function ThanksContent({ searchCount }: { searchCount: number }) {
  const { t } = useI18n();
  const browserName = useMemo(() => (browser.runtime.getURL("").startsWith("moz-extension://") ? "firefox" : "chrome"), []);
  const storeUrl = getExtensionStoreUrl(browserName);
  const ctaLabel = browserName === "firefox" ? t("thanks.ctaFirefox") : t("thanks.ctaChrome");
  const isFirstThanks = searchCount === 1;
  const titleKey = isFirstThanks ? "thanks.firstTitle" : "thanks.title";
  const subtitleKey = isFirstThanks ? "thanks.firstSubtitle" : "thanks.subtitle";
  const headingKey = isFirstThanks ? "thanks.firstHeading" : "thanks.heading";
  const bodyKey = isFirstThanks ? "thanks.firstBody" : "thanks.body";

  return (
    <PageShell
      title={t(titleKey, { count: searchCount })}
      description={t(subtitleKey, { count: searchCount })}
      narrow
    >
      <section className="rounded-md border border-yellow-300 bg-yellow-100 p-5 text-stone-950 shadow-sm dark:border-yellow-500/60 dark:bg-yellow-300/12 dark:text-yellow-50">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-yellow-400 text-stone-950">
            <Sparkles aria-hidden="true" size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{t(headingKey, { count: searchCount })}</h2>
            <p className="mt-2 text-sm leading-6 text-stone-700 dark:text-yellow-100/85">
              {t(bodyKey, { count: searchCount })}
            </p>
            {hasExtensionStoreListing(browserName) && storeUrl ? (
              <div className="mt-4">
                <LinkButton href={storeUrl} target="_blank" rel="noreferrer">
                  <Star aria-hidden="true" size={14} />
                  {ctaLabel}
                </LinkButton>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
