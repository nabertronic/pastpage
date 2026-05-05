import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ExternalLink, History, ScanSearch, Settings } from "lucide-react";
import { Button, LinkButton } from "./Button";
import { explainDetectedError } from "../core/errors";
import { createBrokenPageLookupRequest, createManualPageLookupRequest } from "../core/lookupRequest";
import { getCustomLookupTargetState, getLookupTargetState, type LookupTargetState } from "../core/lookupTarget";
import { DEFAULT_SETTINGS, type Settings as UserSettings } from "../core/settings";
import { buildProviderActions, type ProviderId } from "../core/providers";
import type { TabState } from "../core/tabState";
import { I18nProvider, resolveLocaleFromLanguageMode, useI18n } from "../i18n";
import { cn } from "../lib/cn";
import { openArchiveUrl } from "../platform/archiveNavigation";
import { createHistoryEntry, getSettings } from "../platform/storage";
import { historyPageUrl, optionsPageUrl, resolverUrl } from "../platform/urls";
import { LogoMark } from "./LogoMark";
import { useAppliedTheme } from "./useAppliedTheme";

type LookupSourceMode = "current" | "custom";

function getPopupProviderLabel(providerId: ProviderId, label: string): string {
  return providerId === "web-gyotaku" ? "Megalodon" : label;
}

export function PopupApp({ initialSettings = DEFAULT_SETTINGS }: { initialSettings?: UserSettings }) {
  const [tabId, setTabId] = useState<number | undefined>();
  const [state, setState] = useState<TabState>({ status: "idle" });
  const [settings, setSettings] = useState<UserSettings>(initialSettings);
  const [target, setTarget] = useState<LookupTargetState>({
    kind: "ineligible",
    reasonKey: "lookupTarget.checkingTab"
  });
  const [sourceMode, setSourceMode] = useState<LookupSourceMode>("current");
  const [customUrl, setCustomUrl] = useState("");

  useAppliedTheme(settings.themeMode);

  useEffect(() => {
    async function load() {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      setTabId(tab?.id);
      setTarget(getLookupTargetState(tab?.url));
      const response = await browser.runtime.sendMessage({ type: "GET_TAB_STATE", tabId: tab?.id });
      setState(response?.state ?? { status: "idle" });
      setSettings(await getSettings());
    }

    void load();
  }, []);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  async function findArchivedVersion(url: string, useBrokenPageFlow: boolean) {
    const request =
      useBrokenPageFlow && state.status === "broken"
        ? createBrokenPageLookupRequest(state.error)
        : createManualPageLookupRequest(url);

    if (!request) return;

    await browser.runtime.sendMessage({
      type: "START_RESOLVER",
      tabId,
      request,
      historyTrigger: useBrokenPageFlow ? "broken-page" : "manual-page"
    });
    window.close();
  }

  async function openOptions() {
    await browser.tabs.create({ url: optionsPageUrl(), active: true });
    window.close();
  }

  async function openHistory() {
    await browser.tabs.create({ url: historyPageUrl(), active: true });
    window.close();
  }

  async function openManualArchive(providerId: ProviderId, targetUrl: string, destinationUrl: string) {
    await createHistoryEntry({
      targetUrl,
      trigger: "provider-direct",
      requestTrigger: "manual-page",
      scopedProviderId: providerId
    });
    await openArchiveUrl(destinationUrl, settings.providerMenuOpenBehavior, tabId);
    window.close();
  }

  async function openProviderResolver(providerId: ProviderId, targetUrl: string) {
    const entry = await createHistoryEntry({
      targetUrl,
      trigger: "manual-page",
      requestTrigger: "manual-page",
      scopedProviderId: providerId
    });
    await openArchiveUrl(
      resolverUrl(createManualPageLookupRequest(targetUrl), tabId, providerId, entry?.id),
      settings.providerMenuOpenBehavior,
      tabId
    );
    window.close();
  }

  async function openAllArchivesInTabs(url: string) {
    const archives = buildProviderActions(url, settings.enabledProviders, settings.archiveDisplayOrder, settings);
    const orderedArchives = [
      ...archives.filter((archive) => archive.action.kind === "resolver"),
      ...archives.filter((archive) => archive.action.kind !== "resolver")
    ];

    for (const [index, archive] of orderedArchives.entries()) {
      const historyEntry = await createHistoryEntry({
        targetUrl: url,
        trigger: "all-archives",
        requestTrigger: "manual-page",
        scopedProviderId: archive.providerId
      });
      await browser.tabs.create({
        url:
          archive.action.kind === "direct"
            ? archive.action.url
            : resolverUrl(
                createManualPageLookupRequest(archive.action.url),
                tabId,
                archive.providerId,
                historyEntry?.id
              ),
        active: index === 0,
        openerTabId: tabId
      });
    }

    window.close();
  }

  return (
    <I18nProvider locale={resolveLocaleFromLanguageMode(settings.language)}>
      <PopupContent
        state={state}
        settings={settings}
        target={target}
        sourceMode={sourceMode}
        customUrl={customUrl}
        onSourceModeChange={setSourceMode}
        onCustomUrlChange={setCustomUrl}
        onFindArchivedVersion={findArchivedVersion}
        onOpenAllArchivesInTabs={openAllArchivesInTabs}
        onOpenManualArchive={openManualArchive}
        onOpenProviderResolver={openProviderResolver}
        onOpenHistory={openHistory}
        onOpenOptions={openOptions}
      />
    </I18nProvider>
  );
}

function PopupContent({
  state,
  settings,
  target,
  sourceMode,
  customUrl,
  onSourceModeChange,
  onCustomUrlChange,
  onFindArchivedVersion,
  onOpenAllArchivesInTabs,
  onOpenManualArchive,
  onOpenProviderResolver,
  onOpenHistory,
  onOpenOptions
}: {
  state: TabState;
  settings: UserSettings;
  target: LookupTargetState;
  sourceMode: LookupSourceMode;
  customUrl: string;
  onSourceModeChange: (mode: LookupSourceMode) => void;
  onCustomUrlChange: (value: string) => void;
  onFindArchivedVersion: (url: string, useBrokenPageFlow: boolean) => Promise<void>;
  onOpenAllArchivesInTabs: (url: string) => Promise<void>;
  onOpenManualArchive: (providerId: ProviderId, targetUrl: string, destinationUrl: string) => Promise<void>;
  onOpenProviderResolver: (providerId: ProviderId, targetUrl: string) => Promise<void>;
  onOpenHistory: () => Promise<void>;
  onOpenOptions: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [sourceModeOpen, setSourceModeOpen] = useState(false);
  const sourceModeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (sourceModeRef.current && !sourceModeRef.current.contains(e.target as Node)) {
        setSourceModeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const explanation = state.status === "broken" ? explainDetectedError(state.error, t) : null;
  const currentTarget =
    state.status === "broken"
      ? getLookupTargetState(state.error.originalUrl)
      : target;
  const customTarget = getCustomLookupTargetState(customUrl);
  const activeTarget = sourceMode === "custom" ? customTarget : currentTarget;
  const activeLookupUrl = activeTarget.kind === "eligible" ? activeTarget.url : null;
  const usesBrokenPageFlow = sourceMode === "current" && state.status === "broken";
  const archiveListUrl = sourceMode === "custom" ? activeLookupUrl ?? "https://example.com/" : activeLookupUrl;
  const manualArchives = useMemo(() => {
    if (!settings.popupArchiveListEnabled) return [];
    if (!archiveListUrl) return [];
    return buildProviderActions(archiveListUrl, settings.enabledProviders, settings.archiveDisplayOrder, settings);
  }, [
    archiveListUrl,
    settings.archiveDisplayOrder,
    settings.archiveTodayHost,
    settings.enabledProviders,
    settings.popupArchiveListEnabled,
    settings.waybackHost
  ]);

  return (
    <main className="w-[360px] overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(245,200,0,0.07),transparent_42%),#f8f8f8] p-3 text-stone-950 dark:bg-[radial-gradient(circle_at_top_left,rgba(255,212,0,0.16),transparent_40%),#11100c] dark:text-yellow-50">
      <header className="mb-3 flex items-center gap-2">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-yellow-400 text-stone-950 shadow-[0_10px_24px_rgba(255,212,0,0.24)]">
          <LogoMark size={19} variant="white" />
        </div>
        <div>
          <h1 className="text-sm font-semibold">PastPage</h1>
          <p className="text-xs text-stone-600 dark:text-stone-300">{t("popup.subtitle")}</p>
        </div>
        <div className="relative ml-auto" ref={sourceModeRef}>
          <button
            type="button"
            className="flex items-center gap-1 rounded border border-stone-200 px-2 py-1 text-[13px] text-stone-500 transition hover:border-stone-300 hover:bg-stone-100 focus-visible:outline-yellow-400 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:bg-stone-800"
            onClick={() => setSourceModeOpen((o) => !o)}
          >
            <span>{sourceMode === "current" ? "Tab" : "URL"}</span>
            <ChevronDown size={12} />
          </button>
          {sourceModeOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 min-w-[72px] overflow-hidden rounded-md border border-stone-200 bg-white shadow-md dark:border-stone-700 dark:bg-stone-900">
              <button
                type="button"
                className={cn(
                  "w-full px-3 py-2 text-left text-xs transition hover:bg-stone-50 dark:hover:bg-stone-800",
                  sourceMode === "current" ? "font-semibold text-stone-950 dark:text-yellow-50" : "text-stone-600 dark:text-stone-400"
                )}
                onClick={() => { onSourceModeChange("current"); setSourceModeOpen(false); }}
              >
                Tab
              </button>
              <button
                type="button"
                className={cn(
                  "w-full px-3 py-2 text-left text-xs transition hover:bg-stone-50 dark:hover:bg-stone-800",
                  sourceMode === "custom" ? "font-semibold text-stone-950 dark:text-yellow-50" : "text-stone-600 dark:text-stone-400"
                )}
                onClick={() => { onSourceModeChange("custom"); setSourceModeOpen(false); }}
              >
                URL
              </button>
            </div>
          )}
        </div>
      </header>

      {sourceMode === "custom" ? (
        <section className="mb-3">
          <input
            type="url"
            value={customUrl}
            placeholder={t("popup.customUrlPlaceholder")}
            className="h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 shadow-sm transition hover:border-yellow-400 focus-visible:outline-yellow-400 dark:border-stone-700 dark:bg-stone-950 dark:text-yellow-50"
            onChange={(event) => onCustomUrlChange(event.target.value)}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
        </section>
      ) : null}

      <section className="mb-3 p-1">
        {sourceMode === "current" && state.status === "broken" ? (
          <div>
            <p className="text-sm font-medium">{explanation?.title}</p>
            <p className="mt-1 text-xs leading-5 text-stone-600 dark:text-stone-300">
              {explanation?.short}
            </p>
            <p className="mt-2 max-h-16 overflow-auto break-all rounded bg-stone-100 p-2 text-[11px] text-stone-700 dark:bg-yellow-300/10 dark:text-yellow-50">
              {state.error.originalUrl}
            </p>
          </div>
        ) : sourceMode === "current" && activeTarget.kind !== "eligible" ? (
          <div>
            <p className="text-sm font-medium">
              {t("popup.lookupUnavailableTitle")}
            </p>
            <p className="mt-1 text-xs leading-5 text-stone-600 dark:text-stone-300">
              {t(activeTarget.reasonKey)}
            </p>
          </div>
        ) : null}
      </section>

      {sourceMode === "custom" || activeLookupUrl ? (
        <section className="mb-3 space-y-2">
          <Button
            className="w-full"
            disabled={!activeLookupUrl}
            onClick={() => {
              if (!activeLookupUrl) return;
              void onFindArchivedVersion(activeLookupUrl, usesBrokenPageFlow);
            }}
          >
            <ScanSearch aria-hidden="true" size={15} />
            {usesBrokenPageFlow ? t("popup.findArchivedVersion") : t("popup.checkArchivedVersionsCta")}
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            disabled={!activeLookupUrl}
            onClick={() => {
              if (!activeLookupUrl) return;
              void onOpenAllArchivesInTabs(activeLookupUrl);
            }}
          >
            <ExternalLink aria-hidden="true" size={15} />
            {t("popup.checkAllArchivesCta")}
          </Button>
        </section>
      ) : null}

      {settings.popupArchiveListEnabled && (sourceMode === "custom" || manualArchives.length > 0) ? (
        <section className="rounded-md border border-stone-200 bg-white/95 p-2 shadow-sm dark:border-stone-800 dark:bg-stone-950/92">
          <ul className="grid grid-cols-2 gap-1">
            {manualArchives.map((archive) => (
              <li key={`${archive.providerId}:${archive.action.kind}:${archive.action.url}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left transition hover:bg-stone-100 focus-visible:outline-yellow-400 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-yellow-300/10"
                  disabled={!activeLookupUrl}
                  onClick={() =>
                    void (activeLookupUrl
                      ? archive.action.kind === "direct"
                        ? onOpenManualArchive(archive.providerId, activeLookupUrl, archive.action.url)
                        : onOpenProviderResolver(archive.providerId, archive.action.url)
                      : Promise.resolve())
                  }
                >
                  <ProviderIcon providerId={archive.providerId} showIcon={settings.showSearchEngineIcons} />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-stone-900 dark:text-yellow-50">
                    {getPopupProviderLabel(archive.providerId, archive.label)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <LinkButton
            href={historyPageUrl()}
            target="_blank"
            rel="noreferrer"
            variant="quiet"
            size="sm"
            onClick={(event) => {
              event.preventDefault();
              void onOpenHistory();
            }}
          >
            <History aria-hidden="true" size={14} />
            {t("common.history")}
          </LinkButton>
          <Button variant="quiet" size="sm" onClick={() => void onOpenOptions()}>
            <Settings aria-hidden="true" size={14} />
            {t("common.settings")}
          </Button>
        </div>
      </footer>
    </main>
  );
}


function ProviderIcon({ providerId, showIcon }: { providerId: ProviderId; showIcon: boolean }) {
  if (!showIcon) return null;

  const src =
    providerId === "arquivo-pt"
      ? "/menu-icons/provider-icons/arquivo-pt-32.png"
      : `/provider-icons/${providerId}.${providerId === "ghostarchive" ? "png" : "svg"}`;

  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-stone-100 dark:bg-stone-900">
      <img src={src} alt="" className="h-4 w-4 object-contain" />
    </span>
  );
}
