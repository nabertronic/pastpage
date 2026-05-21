import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { ArrowDown, ArrowUp, BookOpen, Check, ExternalLink, GripVertical, RefreshCw, RotateCcw, Sparkles, Star, Trash2 } from "lucide-react";
import { Button, LinkButton } from "./Button";
import { PageShell } from "./PageShell";
import { ResearcherFooter } from "./AppLinks";
import { NumberField, SelectField, ToggleRow } from "./FieldControls";
import { LogoMark } from "./LogoMark";
import { ARCHIVE_TODAY_HOST_OPTIONS, WAYBACK_HOST_OPTIONS } from "../core/providerHosts";
import {
  DEFAULT_SETTINGS,
  SettingsSchema,
  isBrokenPageAssistSnoozed,
  type Settings
} from "../core/settings";
import { I18nProvider, resolveLocaleFromLanguageMode, useI18n } from "../i18n";
import { PROVIDERS } from "../core/providers";
import type { ProviderId } from "../core/providers/types";
import { clearHistory, getSettings, saveSettings } from "../platform/storage";
import { getRecoveryBarThemeVars } from "./recoveryBarTheme";
import { useAppliedTheme } from "./useAppliedTheme";
import {
  checkForExtensionUpdates,
  getExtensionBrowser,
  getExtensionStoreUrl,
  getExtensionVersion,
  hasExtensionStoreListing,
  openExtensionShortcutSettings,
  type UpdateCheckResult
} from "../platform/runtimeInfo";
import { historyPageUrl, onboardingPageUrl, whatsNewPageUrl } from "../platform/urls";
import { cn } from "../lib/cn";

export function OptionsApp() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [newDomain, setNewDomain] = useState("");
  const [saved, setSaved] = useState(false);
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const persistedSettingsRef = useRef(JSON.stringify(DEFAULT_SETTINGS));

  useAppliedTheme(settings.themeMode);

  useEffect(() => {
    void getSettings().then((currentSettings) => {
      persistedSettingsRef.current = JSON.stringify(currentSettings);
      setSettings(currentSettings);
      setHasLoadedSettings(true);
    });
  }, []);

  useEffect(() => {
    if (!hasLoadedSettings) return;

    const parsed = SettingsSchema.parse(settings);
    const serializedSettings = JSON.stringify(parsed);
    if (serializedSettings === persistedSettingsRef.current) return;

    let isActive = true;

    void saveSettings(parsed).then(() => {
      if (!isActive) return;
      persistedSettingsRef.current = serializedSettings;
      void browser.runtime.sendMessage({ type: "UPDATE_SETTINGS", settings: parsed }).catch(() => undefined);
      setSaved(true);
      window.setTimeout(() => {
        if (isActive) setSaved(false);
      }, 1600);
    });

    return () => {
      isActive = false;
    };
  }, [hasLoadedSettings, settings]);

  function addDomain() {
    const domain = newDomain.trim().toLowerCase();
    if (!domain || settings.domainExceptions.includes(domain)) return;
    setSettings((current) => ({
      ...current,
      domainExceptions: [...current.domainExceptions, domain]
    }));
    setNewDomain("");
  }

  return (
    <I18nProvider locale={resolveLocaleFromLanguageMode(settings.language)}>
      <OptionsContent
        settings={settings}
        newDomain={newDomain}
        saved={saved}
        setSettings={setSettings}
        setNewDomain={setNewDomain}
        addDomain={addDomain}
      />
    </I18nProvider>
  );
}

function OptionsContent({
  settings,
  newDomain,
  saved,
  setSettings,
  setNewDomain,
  addDomain
}: {
  settings: Settings;
  newDomain: string;
  saved: boolean;
  setSettings: Dispatch<SetStateAction<Settings>>;
  setNewDomain: Dispatch<SetStateAction<string>>;
  addDomain: () => void;
}) {
  const { t, locale } = useI18n();
  const browserName = getExtensionBrowser();
  const currentVersion = getExtensionVersion();
  const enabledProviders = new Set(settings.enabledProviders);
  const customPreviewVars = getRecoveryBarThemeVars({
    ...settings,
    bannerTheme: "custom"
  });
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [draggedProviderId, setDraggedProviderId] = useState<ProviderId | null>(null);
  const [providerTimeoutDraft, setProviderTimeoutDraft] = useState(() => String(settings.providerTimeoutSeconds));
  const storeUrl = getExtensionStoreUrl(browserName);
  const hasStoreListing = hasExtensionStoreListing(browserName);
  const brokenPageAssistPaused = isBrokenPageAssistSnoozed(settings);
  const brokenPageAssistPausedUntil = brokenPageAssistPaused ? settings.brokenPageAssistSnoozedUntil : undefined;

  useEffect(() => {
    setProviderTimeoutDraft(String(settings.providerTimeoutSeconds));
  }, [settings.providerTimeoutSeconds]);

  async function resetToDefaults() {
    if (!window.confirm(t("options.reset.confirm"))) return;
    setSettings({
      ...DEFAULT_SETTINGS,
      domainExceptions: [...DEFAULT_SETTINGS.domainExceptions]
    });
    setNewDomain("");
  }

  async function handleCheckForUpdates() {
    setIsCheckingForUpdates(true);
    try {
      const result = await checkForExtensionUpdates();
      setUpdateResult(result.browser === "firefox" ? null : result);
    } finally {
      setIsCheckingForUpdates(false);
    }
  }

  async function handleOpenShortcutSettings() {
    await openExtensionShortcutSettings(browserName);
  }

  async function handleClearHistory() {
    if (!window.confirm(t("options.history.clearConfirm"))) return;
    await clearHistory();
  }

  function toggleProvider(providerId: ProviderId) {
    const nextEnabledProviders = settings.enabledProviders.includes(providerId)
      ? settings.enabledProviders.filter((id) => id !== providerId)
      : [...settings.enabledProviders, providerId];

    setSettings((current) => ({
      ...current,
      enabledProviders: nextEnabledProviders
    }));
  }

  function moveProvider(providerId: ProviderId, direction: "up" | "down") {
    const currentIndex = settings.archiveDisplayOrder.indexOf(providerId);
    if (currentIndex < 0) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= settings.archiveDisplayOrder.length) return;

    setSettings((current) => {
      const nextOrder = [...current.archiveDisplayOrder];
      const [moved] = nextOrder.splice(currentIndex, 1);
      nextOrder.splice(targetIndex, 0, moved);
      return { ...current, archiveDisplayOrder: nextOrder };
    });
  }

  function moveProviderToIndex(providerId: ProviderId, targetIndex: number) {
    const currentIndex = settings.archiveDisplayOrder.indexOf(providerId);
    if (currentIndex < 0 || currentIndex === targetIndex) return;

    setSettings((current) => {
      const nextOrder = [...current.archiveDisplayOrder];
      const [moved] = nextOrder.splice(currentIndex, 1);
      nextOrder.splice(targetIndex, 0, moved);
      return { ...current, archiveDisplayOrder: nextOrder };
    });
  }

  function updateBrokenPageAssist(enabled: boolean) {
    setSettings((current) => ({
      ...current,
      brokenPageAssistEnabled: enabled,
      brokenPageAssistSnoozedUntil: undefined
    }));
  }

  function snoozeBrokenPageAssist(durationMs: number) {
    setSettings((current) => ({
      ...current,
      brokenPageAssistEnabled: true,
      brokenPageAssistSnoozedUntil: Date.now() + durationMs
    }));
  }

  function resumeBrokenPageAssist() {
    setSettings((current) => ({
      ...current,
      brokenPageAssistEnabled: true,
      brokenPageAssistSnoozedUntil: undefined
    }));
  }

  function formatBrokenPageAssistUntil(timestamp: number) {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(timestamp);
  }

  return (
    <PageShell title={t("options.title")} description={t("options.description")}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <section className="rounded-md border border-[var(--wf-border)] bg-[var(--wf-surface)] p-4 shadow-[0_1px_0_rgba(17,17,17,0.04),0_12px_30px_rgba(17,17,17,0.05)] backdrop-blur dark:border-stone-800 dark:bg-stone-950/92">
            <h2 className="text-base font-semibold">{t("options.recoveryBehavior")}</h2>
            <div className="mt-4 grid gap-4">
              <SelectField
                label={t("options.openArchivedPages.label")}
                description={t("options.openArchivedPages.description")}
                value={settings.openBehavior}
                onChange={(openBehavior) => setSettings((current) => ({ ...current, openBehavior }))}
                options={[
                  { value: "current-tab", label: t("options.providerContextMenu.currentTab") },
                  {
                    value: "new-tab-foreground",
                    label: t("options.providerContextMenu.newTabForeground")
                  },
                  {
                    value: "new-tab-background",
                    label: t("options.providerContextMenu.newTabBackground")
                  },
                  { value: "new-window", label: t("options.providerContextMenu.newWindow") }
                ]}
              />

              <SelectField
                label={t("options.providerContextMenu.label")}
                description={t("options.providerContextMenu.description")}
                value={settings.providerMenuOpenBehavior}
                onChange={(providerMenuOpenBehavior) =>
                  setSettings((current) => ({ ...current, providerMenuOpenBehavior }))
                }
                options={[
                  { value: "current-tab", label: t("options.providerContextMenu.currentTab") },
                  {
                    value: "new-tab-foreground",
                    label: t("options.providerContextMenu.newTabForeground")
                  },
                  {
                    value: "new-tab-background",
                    label: t("options.providerContextMenu.newTabBackground")
                  },
                  { value: "new-window", label: t("options.providerContextMenu.newWindow") }
                ]}
              />

              <SelectField
                label={t("options.afterSnapshot.label")}
                description={t("options.afterSnapshot.description")}
                value={settings.resolverSuccessBehavior}
                onChange={(resolverSuccessBehavior) =>
                  setSettings((current) => ({ ...current, resolverSuccessBehavior }))
                }
                options={[
                  { value: "keep-resolver", label: t("options.afterSnapshot.keepResolver") },
                  { value: "replace-resolver", label: t("options.afterSnapshot.replaceResolver") },
                  { value: "manual-open-only", label: t("options.afterSnapshot.manualOpenOnly") }
                ]}
              />

              <SelectField
                label={t("options.urlMatching.label")}
                description={t("options.urlMatching.description")}
                value={settings.urlMatchingMode}
                onChange={(urlMatchingMode) => setSettings((current) => ({ ...current, urlMatchingMode }))}
                options={[
                  { value: "exact-then-cleaned", label: t("options.urlMatching.exactThenCleaned") },
                  { value: "exact-only", label: t("options.urlMatching.exactOnly") }
                ]}
              />

              <NumberField
                label={t("options.providerTimeout.label")}
                description={t("options.providerTimeout.description")}
                value={providerTimeoutDraft}
                min={1}
                step={1}
                onChange={(value) => {
                  setProviderTimeoutDraft(value);
                  const parsed = Number.parseInt(value, 10);
                  if (!Number.isInteger(parsed) || parsed < 1) return;
                  setSettings((current) => ({ ...current, providerTimeoutSeconds: parsed }));
                }}
              />

              <SelectField
                label={t("options.waybackHost.label")}
                description={t("options.waybackHost.description")}
                value={settings.waybackHost}
                onChange={(waybackHost) => setSettings((current) => ({ ...current, waybackHost }))}
                options={WAYBACK_HOST_OPTIONS.map((host) => ({
                  value: host,
                  label: t(`options.waybackHost.${host}` as const)
                }))}
              />

              <SelectField
                label={t("options.archiveTodayHost.label")}
                description={t("options.archiveTodayHost.description")}
                value={settings.archiveTodayHost}
                onChange={(archiveTodayHost) =>
                  setSettings((current) => ({ ...current, archiveTodayHost }))
                }
                options={ARCHIVE_TODAY_HOST_OPTIONS.map((host) => ({
                  value: host,
                  label: t(`options.archiveTodayHost.${host}` as const)
                }))}
              />

              <section className="rounded-md border border-[var(--wf-border)] bg-[var(--wf-surface)] p-4 shadow-[0_1px_0_rgba(17,17,17,0.04),0_12px_30px_rgba(17,17,17,0.05)] dark:border-stone-800 dark:bg-stone-950/92">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-6">{t("options.brokenPageAssist.label")}</p>
                    <p className="text-sm leading-6 text-stone-600 dark:text-stone-300">
                      {t("options.brokenPageAssist.description")}
                    </p>
                    {brokenPageAssistPausedUntil ? (
                      <p className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">
                        {t("options.brokenPageAssist.statusPaused", {
                          value: formatBrokenPageAssistUntil(brokenPageAssistPausedUntil)
                        })}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label={t("options.brokenPageAssist.toggleLabel")}
                    aria-pressed={settings.brokenPageAssistEnabled}
                    className="shrink-0 rounded-md focus-visible:outline-yellow-400"
                    onClick={() => updateBrokenPageAssist(!settings.brokenPageAssistEnabled)}
                  >
                    <span
                      className={cn(
                        "relative mt-0.5 block overflow-hidden rounded-full border transition-colors",
                        settings.brokenPageAssistEnabled
                          ? "border-yellow-400 bg-yellow-400"
                          : "border-stone-300 bg-stone-200 dark:border-stone-700 dark:bg-stone-800"
                      )}
                      style={{ width: 44, height: 24 }}
                    >
                      <span
                        className="absolute rounded-full bg-white shadow transition-transform"
                        style={{
                          width: 18,
                          height: 18,
                          top: 2,
                          left: 2,
                          transform: settings.brokenPageAssistEnabled ? "translateX(20px)" : "translateX(0)"
                        }}
                      />
                    </span>
                  </button>
                </div>

                {settings.brokenPageAssistEnabled ? (
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    {brokenPageAssistPaused ? (
                      <Button type="button" variant="secondary" size="sm" onClick={resumeBrokenPageAssist}>
                        {t("options.brokenPageAssist.resume")}
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => snoozeBrokenPageAssist(60 * 60 * 1000)}
                        >
                          {t("options.brokenPageAssist.pauseOneHour")}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => snoozeBrokenPageAssist(24 * 60 * 60 * 1000)}
                        >
                          {t("options.brokenPageAssist.pauseOneDay")}
                        </Button>
                      </>
                    )}
                  </div>
                ) : null}
              </section>

              <div>
                <p className="text-sm font-medium leading-6">{t("options.sitesToIgnore.title")}</p>
                <p className="text-sm leading-6 text-stone-600 dark:text-stone-300">
                  {t("options.sitesToIgnore.description")}
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-md border border-[var(--wf-border-strong)] bg-[var(--wf-surface)] px-3 py-2 text-sm transition hover:border-yellow-400 focus-visible:outline-yellow-400 dark:border-stone-700 dark:bg-stone-950"
                    placeholder="example.com"
                    value={newDomain}
                    onChange={(event) => setNewDomain(event.target.value)}
                  />
                  <Button type="button" variant="secondary" onClick={addDomain}>
                    {t("common.add")}
                  </Button>
                </div>
                {settings.domainExceptions.length ? (
                  <ul className="mt-3 divide-y divide-[var(--wf-border)] rounded-md border border-[var(--wf-border)] text-sm dark:divide-stone-800 dark:border-stone-800">
                    {settings.domainExceptions.map((domain) => (
                      <li key={domain} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span>{domain}</span>
                        <button
                          type="button"
                          className="rounded-md p-1 text-stone-500 transition hover:bg-yellow-100 hover:text-stone-950 focus-visible:outline-yellow-400 dark:hover:bg-yellow-300/10 dark:hover:text-yellow-50"
                          aria-label={t("common.removeDomain", { domain })}
                          onClick={() =>
                            setSettings((current) => ({
                              ...current,
                              domainExceptions: current.domainExceptions.filter((item) => item !== domain)
                            }))
                          }
                        >
                          <Trash2 aria-hidden="true" size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-md border border-[var(--wf-border)] bg-[var(--wf-surface)] p-4 shadow-[0_1px_0_rgba(17,17,17,0.04),0_12px_30px_rgba(17,17,17,0.05)] backdrop-blur dark:border-stone-800 dark:bg-stone-950/92">
            <h2 className="text-base font-semibold">{t("options.archives.label")}</h2>
            <p className="mt-1 text-sm leading-6 text-stone-600 dark:text-stone-300">
              {t("options.archives.description")}
            </p>
            <p className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">
              {t("options.archives.urlSpecificHint")}
            </p>
            <div className="mt-4 grid gap-4">
              <p className="text-xs leading-5 text-stone-600 dark:text-stone-300">
                {t("options.archives.orderDescription")}
              </p>
              <ul className="grid gap-2">
                {settings.archiveDisplayOrder.map((providerId, index) => (
                  <li
                    key={providerId}
                    draggable
                    onDragStart={() => setDraggedProviderId(providerId)}
                    onDragEnd={() => setDraggedProviderId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (!draggedProviderId) return;
                      moveProviderToIndex(draggedProviderId, index);
                      setDraggedProviderId(null);
                    }}
                    className="group"
                  >
                    <div className="flex items-stretch gap-2">
                      <button
                        type="button"
                        draggable={false}
                        aria-label={t("options.archives.dragHandle", { provider: PROVIDERS[providerId].displayName })}
                        className="flex shrink-0 cursor-grab items-center rounded-md border border-[var(--wf-border)] bg-[var(--wf-surface-muted)] px-2 text-stone-500 transition hover:border-yellow-400 hover:bg-yellow-50 hover:text-stone-950 active:cursor-grabbing dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300 dark:hover:border-yellow-300 dark:hover:bg-yellow-300/10 dark:hover:text-yellow-50"
                      >
                        <GripVertical aria-hidden="true" size={16} />
                      </button>
                      <ToggleRow
                        label={PROVIDERS[providerId].displayName}
                        description={PROVIDERS[providerId].shortDescription}
                        checked={enabledProviders.has(providerId)}
                        onChange={() => toggleProvider(providerId)}
                        warning={
                          enabledProviders.has(providerId)
                            ? undefined
                            : t("options.archives.disabledHint")
                        }
                      />
                      <div className="flex shrink-0 flex-col gap-2">
                        <Button
                          type="button"
                          variant="quiet"
                          size="sm"
                          className="px-2"
                          aria-label={t("options.archives.moveUp", { provider: PROVIDERS[providerId].displayName })}
                          onClick={(event) => {
                            event.stopPropagation();
                            moveProvider(providerId, "up");
                          }}
                          disabled={index === 0}
                        >
                          <ArrowUp aria-hidden="true" size={14} />
                        </Button>
                        <Button
                          type="button"
                          variant="quiet"
                          size="sm"
                          className="px-2"
                          aria-label={t("options.archives.moveDown", { provider: PROVIDERS[providerId].displayName })}
                          onClick={(event) => {
                            event.stopPropagation();
                            moveProvider(providerId, "down");
                          }}
                          disabled={index === settings.archiveDisplayOrder.length - 1}
                        >
                          <ArrowDown aria-hidden="true" size={14} />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="rounded-md border border-[var(--wf-border)] bg-[var(--wf-surface)] p-4 shadow-[0_1px_0_rgba(17,17,17,0.04),0_12px_30px_rgba(17,17,17,0.05)] backdrop-blur dark:border-stone-800 dark:bg-stone-950/92">
            <h2 className="text-base font-semibold">{t("options.appearance")}</h2>
            <div className="mt-4 grid gap-4">
              <ToggleRow
                label={t("options.popupArchiveList.label")}
                description={t("options.popupArchiveList.description")}
                checked={settings.popupArchiveListEnabled}
                onChange={(popupArchiveListEnabled) =>
                  setSettings((current) => ({ ...current, popupArchiveListEnabled }))
                }
              />

              <ToggleRow
                label={t("options.showSearchEngineIcons.label")}
                description={t("options.showSearchEngineIcons.description")}
                checked={settings.showSearchEngineIcons}
                onChange={(showSearchEngineIcons) =>
                  setSettings((current) => ({ ...current, showSearchEngineIcons }))
                }
              />

              {browserName === "firefox" && (
                <ToggleRow
                  label={t("options.showContextMenuIcons.label")}
                  description={t("options.showContextMenuIcons.description")}
                  checked={settings.showContextMenuIcons}
                  onChange={(showContextMenuIcons) =>
                    setSettings((current) => ({ ...current, showContextMenuIcons }))
                  }
                />
              )}

              <ToggleRow
                label={t("options.badge.label")}
                description={t("options.badge.description")}
                checked={settings.badgeEnabled}
                onChange={(badgeEnabled) => setSettings((current) => ({ ...current, badgeEnabled }))}
              />

              <SelectField
                label={t("options.theme.label")}
                description={t("options.theme.description")}
                value={settings.themeMode}
                onChange={(themeMode) => setSettings((current) => ({ ...current, themeMode }))}
                options={[
                  { value: "browser", label: t("common.browserDefault") },
                  { value: "light", label: t("options.theme.light") },
                  { value: "dark", label: t("options.theme.dark") }
                ]}
              />

              <SelectField
                label={t("options.language.label")}
                description={t("options.language.description")}
                value={settings.language}
                onChange={(language) => setSettings((current) => ({ ...current, language }))}
                options={[
                  { value: "browser", label: t("common.browserDefault") },
                  { value: "en", label: t("common.english") },
                  { value: "de", label: t("common.german") },
                  { value: "es", label: t("common.spanish") },
                  { value: "fr", label: t("common.french") },
                  { value: "pt", label: t("common.portuguese") },
                  { value: "it", label: t("common.italian") },
                  { value: "pl", label: t("common.polish") },
                  { value: "uk", label: t("common.ukrainian") }
                ]}
              />

              <SelectField
                label={t("options.recoveryBar.contrastLabel")}
                description={t("options.recoveryBar.contrastDescription")}
                value={settings.bannerTheme}
                onChange={(bannerTheme) => setSettings((current) => ({ ...current, bannerTheme }))}
                options={[
                  { value: "auto-contrast", label: t("options.recoveryBar.autoContrast") },
                  { value: "dark", label: t("options.recoveryBar.dark") },
                  { value: "light", label: t("options.recoveryBar.light") },
                  { value: "custom", label: t("options.recoveryBar.custom") }
                ]}
              />

              <label className="grid gap-2 text-sm">
                <span className="font-semibold text-stone-950 dark:text-yellow-50">
                  {t("options.recoveryBar.customColorLabel")}
                </span>
                <span className="text-stone-600 dark:text-stone-300">
                  {t("options.recoveryBar.customColorDescription")}
                </span>
                <span className="flex items-center gap-3">
                  <input
                    className="h-11 w-16 cursor-pointer rounded-md border border-[var(--wf-border-strong)] bg-[var(--wf-surface)] p-1 transition hover:border-yellow-400 focus-visible:outline-yellow-400 dark:border-stone-700 dark:bg-stone-950"
                    type="color"
                    value={settings.bannerColor}
                    onChange={(event) => setSettings((current) => ({ ...current, bannerColor: event.target.value }))}
                  />
                  <span className="rounded-md border border-[var(--wf-border)] bg-[var(--wf-surface-muted)] px-3 py-2 font-mono text-xs text-stone-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
                    {settings.bannerColor}
                  </span>
                </span>
              </label>

              <label className="grid gap-2 text-sm">
                <span className="font-semibold text-stone-950 dark:text-yellow-50">
                  {t("options.recoveryBar.customActionColorLabel")}
                </span>
                <span className="text-stone-600 dark:text-stone-300">
                  {t("options.recoveryBar.customActionColorDescription")}
                </span>
                <span className="flex items-center gap-3">
                  <input
                    className="h-11 w-16 cursor-pointer rounded-md border border-[var(--wf-border-strong)] bg-[var(--wf-surface)] p-1 transition hover:border-yellow-400 focus-visible:outline-yellow-400 dark:border-stone-700 dark:bg-stone-950"
                    type="color"
                    value={settings.actionColor}
                    onChange={(event) => setSettings((current) => ({ ...current, actionColor: event.target.value }))}
                  />
                  <span className="rounded-md border border-[var(--wf-border)] bg-[var(--wf-surface-muted)] px-3 py-2 font-mono text-xs text-stone-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
                    {settings.actionColor}
                  </span>
                </span>
              </label>

              <div className="grid gap-2 text-sm">
                <span className="font-semibold text-stone-950 dark:text-yellow-50">
                  {t("options.recoveryBar.previewLabel")}
                </span>
                <span className="text-stone-600 dark:text-stone-300">
                  {t("options.recoveryBar.previewDescription")}
                </span>
                <div
                  className="overflow-hidden rounded-md border shadow-sm"
                  style={customPreviewVars as CSSProperties}
                >
                  <div
                    style={{
                      background: "var(--wf-banner-bg)",
                      color: "var(--wf-banner-text)",
                      borderBottom: "2px solid var(--wf-banner-border)",
                      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.16)"
                    }}
                  >
                    <div
                      className="flex items-center gap-3 px-3 py-3"
                      style={{ fontSize: 14, lineHeight: 1.45, letterSpacing: 0 }}
                    >
                      <span
                        style={{
                          display: "grid",
                          placeItems: "center",
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: "var(--wf-accent)",
                          color: "var(--wf-accent-ink)",
                          flex: "0 0 auto"
                        }}
                      >
                        <LogoMark size={16} color="var(--wf-accent-ink)" />
                      </span>
                      <span className="min-w-0 flex-1 font-semibold">
                        {t("topbar.default", { title: t("error.http.404.title") })}
                      </span>
                      <button
                        type="button"
                        className="rounded-md px-3 py-2 text-sm font-extrabold"
                        style={{
                          border: "1px solid rgba(23, 19, 10, 0.22)",
                          background: "var(--wf-accent)",
                          color: "var(--wf-accent-ink)"
                        }}
                      >
                        {t("topbar.cta")}
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setSettings((current) => ({
                        ...current,
                        bannerColor: DEFAULT_SETTINGS.bannerColor,
                        actionColor: DEFAULT_SETTINGS.actionColor
                      }))
                    }
                  >
                    {t("options.recoveryBar.resetColors")}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-md border border-[var(--wf-border)] bg-[var(--wf-surface)] p-4 shadow-[0_1px_0_rgba(17,17,17,0.04),0_12px_30px_rgba(17,17,17,0.05)] backdrop-blur dark:border-stone-800 dark:bg-stone-950/92">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{t("options.history.title")}</h2>
                <p className="mt-1 text-sm leading-6 text-stone-600 dark:text-stone-300">
                  {t("options.history.settingsDescription")}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4">
              <ToggleRow
                label={t("options.history.enabled.label")}
                description={t("options.history.enabled.description")}
                checked={settings.historyEnabled}
                onChange={(historyEnabled) =>
                  setSettings((current) => ({ ...current, historyEnabled }))
                }
              />

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" size="sm" onClick={() => void handleClearHistory()}>
                  <Trash2 aria-hidden="true" size={14} />
                  {t("options.history.clear")}
                </Button>
                <LinkButton href={historyPageUrl()} target="_blank" rel="noreferrer" variant="quiet" size="sm">
                  <ExternalLink aria-hidden="true" size={14} />
                  {t("options.history.openPage")}
                </LinkButton>
              </div>
            </div>
          </section>

          <section className="rounded-md border border-[var(--wf-border)] bg-[var(--wf-surface)] p-4 shadow-[0_1px_0_rgba(17,17,17,0.04),0_12px_30px_rgba(17,17,17,0.05)] backdrop-blur dark:border-stone-800 dark:bg-stone-950/92">
            <h2 className="text-base font-semibold">{t("options.shortcuts.title")}</h2>
            <p className="mt-1 text-sm leading-6 text-stone-600 dark:text-stone-300">
              {t("options.shortcuts.description")}
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-sm">
              {isMacOS() ? (
                <>
                  <ShortcutKey>⌘</ShortcutKey>
                  <span className="text-stone-400">+</span>
                  <ShortcutKey>SHIFT</ShortcutKey>
                  <span className="text-stone-400">+</span>
                  <ShortcutKey>U</ShortcutKey>
                </>
              ) : (
                <>
                  <ShortcutKey>Ctrl</ShortcutKey>
                  <span className="text-stone-400">+</span>
                  <ShortcutKey>SHIFT</ShortcutKey>
                  <span className="text-stone-400">+</span>
                  <ShortcutKey>U</ShortcutKey>
                </>
              )}
              <span className="ml-1 text-stone-500 dark:text-stone-400">— {t("options.shortcuts.default")}</span>
              <Button className="ml-auto hover:translate-y-0" type="button" variant="secondary" onClick={() => void handleOpenShortcutSettings()}>
                {t("options.shortcuts.manage")}
              </Button>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="sticky top-4 max-h-[calc(100vh-2rem)] space-y-4 overflow-y-auto">
            <div className="grid gap-2">
              <Button
                className="w-full hover:translate-y-0"
                onClick={() => void resetToDefaults()}
                variant="secondary"
                size="lg"
              >
                <RotateCcw aria-hidden="true" size={16} />
                {t("options.reset.button")}
              </Button>
            </div>
            <section className="rounded-md border border-[var(--wf-border)] bg-[var(--wf-surface)] p-4 shadow-[0_1px_0_rgba(17,17,17,0.04),0_12px_30px_rgba(17,17,17,0.05)] dark:border-stone-800 dark:bg-stone-950/92">
              <h2 className="text-sm font-semibold">{t("options.review.title")}</h2>
              <p className="mt-1 text-sm leading-6 text-stone-600 dark:text-stone-300">
                {t("options.review.description")}
              </p>
              {hasStoreListing && storeUrl ? (
                <div className="mt-3 grid gap-2">
                  <LinkButton href={storeUrl} target="_blank" rel="noreferrer" variant="quiet" size="sm">
                    <Star aria-hidden="true" size={14} />
                    {browserName === "firefox" ? t("common.firefoxAddons") : t("common.chromeWebStore")}
                  </LinkButton>
                </div>
              ) : null}
            </section>
            <section className="rounded-md border border-[var(--wf-border)] bg-[var(--wf-surface)] p-4 shadow-[0_1px_0_rgba(17,17,17,0.04),0_12px_30px_rgba(17,17,17,0.05)] dark:border-stone-800 dark:bg-stone-950/92">
              <h2 className="text-sm font-semibold">{t("options.version.title")}</h2>
              <p className="mt-1 text-sm leading-6 text-stone-600 dark:text-stone-300">
                {t("options.version.current", { version: currentVersion })}
              </p>
              <LinkButton
                className="mt-2 w-full"
                href={whatsNewPageUrl()}
                target="_blank"
                rel="noreferrer"
                variant="quiet"
                size="sm"
              >
                <Sparkles aria-hidden="true" size={14} />
                {t("options.whatsNew.open")}
              </LinkButton>
              {browserName === "chrome" ? (
                <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-300">
                  {t("options.updates.chrome.description")}
                </p>
              ) : null}
              <div className="mt-3 grid gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleCheckForUpdates()}
                  disabled={isCheckingForUpdates}
                >
                  <RefreshCw aria-hidden="true" size={14} className={isCheckingForUpdates ? "animate-spin" : ""} />
                  {isCheckingForUpdates ? t("options.updates.checking") : t("options.updates.check")}
                </Button>
                {browserName === "chrome" && hasStoreListing && storeUrl ? (
                  <LinkButton href={storeUrl} target="_blank" rel="noreferrer" variant="quiet" size="sm">
                    <ExternalLink aria-hidden="true" size={14} />
                    {t("options.updates.chrome.openListing")}
                  </LinkButton>
                ) : null}
              </div>
              {updateResult ? (
                <p className="mt-3 rounded-md border border-[var(--wf-border)] bg-[var(--wf-surface-muted)] px-3 py-2 text-sm leading-6 text-stone-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200">
                  {formatUpdateMessage(t, updateResult)}
                </p>
              ) : null}
            </section>
            <section className="rounded-md border border-[var(--wf-border)] bg-[var(--wf-surface)] p-4 shadow-[0_1px_0_rgba(17,17,17,0.04),0_12px_30px_rgba(17,17,17,0.05)] dark:border-stone-800 dark:bg-stone-950/92">
              <h2 className="text-sm font-semibold">{t("options.onboarding.title")}</h2>
              <p className="mt-1 text-sm leading-6 text-stone-600 dark:text-stone-300">
                {t("options.onboarding.description")}
              </p>
              <LinkButton
                className="mt-3 w-full"
                href={onboardingPageUrl()}
                target="_blank"
                rel="noreferrer"
                variant="quiet"
                size="sm"
              >
                <BookOpen aria-hidden="true" size={14} />
                {t("options.onboarding.openGuide")}
              </LinkButton>
            </section>
          </div>
        </aside>

        <div className="lg:col-span-2">
          <ResearcherFooter />
        </div>
      </div>
      <div
        aria-live="polite"
        className={`pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 transition-all duration-300 ${saved ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
      >
        <span className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 shadow-md dark:border-emerald-900/70 dark:bg-emerald-950/80 dark:text-emerald-300">
          <Check aria-hidden="true" size={13} />
          {t("common.saved")}
        </span>
      </div>
    </PageShell>
  );
}

function isMacOS() {
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

function ShortcutKey({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-[var(--wf-border-strong)] bg-[var(--wf-surface-muted)] px-1.5 py-0.5 font-mono text-xs font-semibold text-stone-700 shadow-[0_1px_0_rgba(0,0,0,0.15)] dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:shadow-[0_1px_0_rgba(0,0,0,0.4)]">
      {children}
    </kbd>
  );
}

function formatUpdateMessage(
  t: ReturnType<typeof useI18n>["t"],
  result: UpdateCheckResult
) {
  switch (result.status) {
    case "available":
      return t("options.updates.chrome.available", {
        version: result.availableVersion ?? t("options.updates.unknownVersion")
      });
    case "up-to-date":
      return t("options.updates.chrome.upToDate", { version: result.currentVersion });
    case "throttled":
      return t("options.updates.chrome.throttled");
    case "manual":
      return t("options.updates.chrome.manual");
  }
}
