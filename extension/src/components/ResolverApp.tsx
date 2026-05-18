import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, Search, XCircle } from "lucide-react";
import { Button, LinkButton } from "./Button";
import { CopyButton } from "./CopyButton";
import { ErrorSummary } from "./ErrorSummary";
import { PageShell } from "./PageShell";
import { Spinner } from "./Spinner";
import { SourceSummary } from "./SourceSummary";
import { ResearcherFooter } from "./AppLinks";
import { explainHttpStatus, explainNavigationError } from "../core/errors";
import { lookupArchives, type LookupProgressStep } from "../core/lookup";
import type { LookupRequest } from "../core/lookupRequest";
import { getProvider } from "../core/providers";
import type { ProviderId } from "../core/providers/types";
import { DEFAULT_SETTINGS, type Settings, type UrlMatchingMode } from "../core/settings";
import type {
  ArchiveSnapshot,
  DetectedError,
  FailedProvider,
  ManualArchiveSource
} from "../core/tabState";
import { I18nProvider, resolveLocaleFromLanguageMode, useI18n } from "../i18n";
import type { TranslationKey } from "../i18n";
import { thanksPageUrl } from "../platform/urls";
import { openArchiveUrl } from "../platform/archiveNavigation";
import {
  completeHistoryEntry,
  consumeFirstArchiveReviewPrompt,
  getSettings,
  incrementSearchCountAndCheckReviewPrompt
} from "../platform/storage";
import { useAppliedTheme } from "./useAppliedTheme";

const autoOpenedSnapshots = new Set<string>();

function snapshotTargetUrl(snapshot: ArchiveSnapshot) {
  return snapshot.openUrl ?? snapshot.archiveUrl;
}

function snapshotCardDescription(t: ReturnType<typeof useI18n>["t"], snapshot: ArchiveSnapshot) {
  return snapshot.verification === "unverified" ? t("resolver.unverified.cardNote") : undefined;
}

function mergeUniqueSnapshots(
  snapshots: ArchiveSnapshot[],
  additions: ArchiveSnapshot[],
  excludedTargetUrl?: string
) {
  const seen = new Set(
    snapshots
      .map((snapshot) => snapshotTargetUrl(snapshot))
      .filter((targetUrl) => targetUrl !== excludedTargetUrl)
  );

  const merged = snapshots.filter(
    (snapshot) => snapshotTargetUrl(snapshot) !== excludedTargetUrl
  );

  for (const snapshot of additions) {
    const targetUrl = snapshotTargetUrl(snapshot);
    if (targetUrl === excludedTargetUrl || seen.has(targetUrl)) continue;
    seen.add(targetUrl);
    merged.push(snapshot);
  }

  return merged;
}

type PendingLookupStep = {
  providerId: ProviderId;
  phase: "querying" | "verifying";
  strategy: "exact" | "cleaned";
  url: string;
};

type ResolverStatus =
  | { kind: "loading"; pendingSteps: PendingLookupStep[] }
  | {
      kind: "found";
      snapshot: ArchiveSnapshot;
      additionalSnapshots: ArchiveSnapshot[];
      failedProviders: FailedProvider[];
      manualSources: ManualArchiveSource[];
      isCheckingMore: boolean;
      pendingSteps: PendingLookupStep[];
    }
  | {
      kind: "unverified";
      snapshot: ArchiveSnapshot;
      additionalSnapshots: ArchiveSnapshot[];
      failedProviders: FailedProvider[];
      manualSources: ManualArchiveSource[];
    }
  | {
      kind: "not-found";
      checked: Array<"exact" | "cleaned">;
      failedProviders: FailedProvider[];
      manualSources: ManualArchiveSource[];
    }
  | { kind: "error"; messageKey: TranslationKey };

function parseScopedProviderId(params: URLSearchParams): ProviderId | undefined {
  const rawProviderId = params.get("providerId");
  if (!rawProviderId) return undefined;

  switch (rawProviderId) {
    case "wayback":
    case "archive-today":
    case "ghostarchive":
    case "uk-gov-web-archive":
    case "loc-web-archives":
    case "perma-cc":
    case "arquivo-pt":
    case "web-gyotaku":
    case "yandex-cache":
    case "webcite":
    case "software-heritage":
      return rawProviderId;
    default:
      return undefined;
  }
}

function requestFromParams(params: URLSearchParams): LookupRequest {
  const originalUrl = params.get("url") ?? "";
  const trigger = params.get("trigger") === "broken-page" ? "broken-page" : "manual-page";

  if (trigger === "manual-page") {
    return { trigger, originalUrl };
  }

  const statusCodeRaw = params.get("statusCode");
  const statusCode = statusCodeRaw ? Number(statusCodeRaw) : undefined;
  const browserError = params.get("browserError") ?? undefined;
  const kind = (params.get("kind") === "navigation" ? "navigation" : "http") as DetectedError["kind"];

  return {
    trigger,
    originalUrl,
    kind,
    statusCode,
    browserError
  };
}

export function ResolverApp() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  useAppliedTheme(settings.themeMode);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const request = useMemo(() => requestFromParams(params), [params]);
  const scopedProviderId = useMemo(() => parseScopedProviderId(params), [params]);
  const historyId = useMemo(() => params.get("historyId") ?? undefined, [params]);
  const openedArchiveUrl = useRef<string | null>(null);
  const bufferedSnapshots = useRef<ArchiveSnapshot[]>([]);
  const [status, setStatus] = useState<ResolverStatus>({
    kind: "loading",
    pendingSteps: []
  });
  const [pendingStepIndex, setPendingStepIndex] = useState(0);
  const pendingSteps = status.kind === "loading" || status.kind === "found" ? status.pendingSteps : [];
  const pendingStepKey = pendingSteps
    .map((step) => `${step.providerId}:${step.strategy}:${step.url}`)
    .join("|");

  useEffect(() => {
    if (pendingSteps.length <= 1) {
      setPendingStepIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setPendingStepIndex((current) => (current + 1) % pendingSteps.length);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [pendingSteps.length]);

  useEffect(() => {
    setPendingStepIndex((current) => {
      if (pendingSteps.length === 0) return 0;
      return current % pendingSteps.length;
    });
  }, [pendingStepKey, pendingSteps.length]);

  useEffect(() => {
    let active = true;

    async function lookup() {
      const currentSettings = await getSettings();
      if (!active) return;
      setSettings(currentSettings);

      void incrementSearchCountAndCheckReviewPrompt().then((shouldPrompt) => {
        if (shouldPrompt) {
          void browser.tabs.create({ url: thanksPageUrl(), active: false });
        }
      });

      const providerScope = scopedProviderId
        ? currentSettings.enabledProviders.includes(scopedProviderId)
          ? [scopedProviderId]
          : []
        : currentSettings.enabledProviders;

      const result = await lookupArchives(
        request.originalUrl,
        currentSettings.urlMatchingMode,
        fetch,
        (step: LookupProgressStep, activeSteps) => {
          if (!active) return;
          setStatus((current) =>
            current.kind === "found"
              ? {
                  ...current,
                  pendingSteps: activeSteps
                }
              : {
                  kind: "loading",
                  pendingSteps: activeSteps
                }
          );
        },
        (snapshot: ArchiveSnapshot) => {
          if (!active) return;

          setStatus((current) => {
            if (current.kind !== "found") {
              bufferedSnapshots.current = mergeUniqueSnapshots(bufferedSnapshots.current, [snapshot]);
              return current;
            }

            if (snapshotTargetUrl(current.snapshot) === snapshotTargetUrl(snapshot)) {
              return current;
            }

            return {
              ...current,
              additionalSnapshots: mergeUniqueSnapshots(current.additionalSnapshots, [snapshot])
            };
          });
        },
        (snapshot: ArchiveSnapshot) => {
          if (!active) return;

          setStatus((current) => {
            const targetUrl = snapshotTargetUrl(snapshot);
            const bufferedAdditionalSnapshots = mergeUniqueSnapshots(
              current.kind === "found" ? current.additionalSnapshots : [],
              bufferedSnapshots.current,
              targetUrl
            );
            bufferedSnapshots.current = [];

            const additionalSnapshots =
              current.kind === "found"
                ? mergeUniqueSnapshots(bufferedAdditionalSnapshots, current.additionalSnapshots, targetUrl)
                : bufferedAdditionalSnapshots;

            return {
              kind: "found",
              snapshot,
              additionalSnapshots,
              failedProviders: current.kind === "found" ? current.failedProviders : [],
              manualSources: current.kind === "found" ? current.manualSources : [],
              isCheckingMore: true,
              pendingSteps: current.kind === "found" ? current.pendingSteps : []
            };
          });

          const targetUrl = snapshotTargetUrl(snapshot);
          const autoOpenKey = `${request.originalUrl}::${targetUrl}`;
          if (openedArchiveUrl.current !== null || autoOpenedSnapshots.has(autoOpenKey)) return;

          openedArchiveUrl.current = targetUrl;
          autoOpenedSnapshots.add(autoOpenKey);

          void consumeFirstArchiveReviewPrompt().then((shouldPrompt) => {
            if (shouldPrompt) {
              void browser.tabs.create({ url: thanksPageUrl(), active: false });
            }
          });

          if (currentSettings.resolverSuccessBehavior === "manual-open-only") return;

          window.setTimeout(() => {
            if (currentSettings.resolverSuccessBehavior === "replace-resolver") {
              window.location.assign(targetUrl);
              return;
            }

            void openArchiveUrl(targetUrl, currentSettings.openBehavior);
          }, 900);
        },
        providerScope,
        currentSettings,
        currentSettings.providerTimeoutSeconds * 1000
      );

      if (!active) return;

      if (result.status === "found") {
        const resultSnapshots = [result.snapshot, ...result.additionalSnapshots];
        void completeHistoryEntry(historyId ?? "", {
          outcome: "hit",
          resultSnapshots,
          failedProviders: result.failedProviders,
          checkedAttempts: result.checked
        });
        setStatus({
          kind: "found",
          snapshot: result.snapshot,
          additionalSnapshots: result.additionalSnapshots,
          failedProviders: result.failedProviders,
          manualSources: result.manualSources,
          isCheckingMore: false,
          pendingSteps: []
        });
        return;
      }

      if (result.status === "unverified") {
        const resultSnapshots = [result.snapshot, ...result.additionalSnapshots];
        void completeHistoryEntry(historyId ?? "", {
          outcome: "hit",
          resultSnapshots,
          failedProviders: result.failedProviders,
          checkedAttempts: result.checked
        });
        setStatus({
          kind: "unverified",
          snapshot: result.snapshot,
          additionalSnapshots: result.additionalSnapshots,
          failedProviders: result.failedProviders,
          manualSources: result.manualSources
        });
        return;
      }

      if (result.status === "not-found") {
        void completeHistoryEntry(historyId ?? "", {
          outcome: "miss",
          failedProviders: result.failedProviders,
          checkedAttempts: result.checked
        });
        setStatus({
          kind: "not-found",
          checked: Array.from(new Set(result.checked.map((attempt) => attempt.strategy))),
          failedProviders: result.failedProviders,
          manualSources: result.manualSources
        });
        return;
      }

      if (result.status === "not-eligible") {
        void completeHistoryEntry(historyId ?? "", {
          outcome: "unknown"
        });
        setStatus({ kind: "error", messageKey: result.reasonKey });
      }
    }

    void lookup();

    return () => {
      active = false;
    };
  }, [request.originalUrl]);

  const error =
    request.trigger === "broken-page"
      ? {
          kind: request.kind,
          originalUrl: request.originalUrl,
          statusCode: request.statusCode,
          browserError: request.browserError,
          explanation:
            request.kind === "navigation"
              ? explainNavigationError(request.browserError)
              : explainHttpStatus(request.statusCode ?? 0),
          detectedAt: Date.now()
        }
      : null;

  return (
    <I18nProvider locale={resolveLocaleFromLanguageMode(settings.language)}>
      <ResolverContent
        error={error}
        pendingStepIndex={pendingStepIndex}
        request={request}
        resolverSuccessBehavior={settings.resolverSuccessBehavior}
        scopedProviderId={scopedProviderId}
        status={status}
        urlMatchingMode={settings.urlMatchingMode}
      />
    </I18nProvider>
  );
}

function ResolverContent({
  error,
  pendingStepIndex,
  request,
  resolverSuccessBehavior,
  scopedProviderId,
  status,
  urlMatchingMode
}: {
  error: DetectedError | null;
  pendingStepIndex: number;
  request: LookupRequest;
  resolverSuccessBehavior: Settings["resolverSuccessBehavior"];
  scopedProviderId?: ProviderId;
  status: ResolverStatus;
  urlMatchingMode: UrlMatchingMode;
}) {
  const { locale, t } = useI18n();
  const strategyList = new Intl.ListFormat(locale, { style: "long", type: "conjunction" });
  const showStrategyDetails = urlMatchingMode !== "exact-only";
  const scopedProviderName = scopedProviderId ? getProvider(scopedProviderId).displayName : null;
  const pendingSteps = status.kind === "loading" || status.kind === "found" ? status.pendingSteps : [];
  const activeStep = pendingSteps.length > 0 ? pendingSteps[pendingStepIndex % pendingSteps.length] : null;
  const activeStepLabel = activeStep
    ? showStrategyDetails
      ? t(activeStep.phase === "verifying" ? "resolver.verifyingProvider" : "resolver.checkingProvider", {
          provider: getProvider(activeStep.providerId).displayName,
          strategy: t(
            activeStep.strategy === "exact" ? "resolver.strategy.exact" : "resolver.strategy.cleaned"
          )
        })
      : t(activeStep.phase === "verifying" ? "resolver.verifyingProviderSimple" : "resolver.checkingProviderSimple", {
          provider: getProvider(activeStep.providerId).displayName
        })
    : t("resolver.startingLookup");

  return (
    <PageShell
      title={t("resolver.title")}
      description={
        scopedProviderName
          ? t("resolver.descriptionScoped", { provider: scopedProviderName })
          : t("resolver.description")
      }
    >
      <div className="space-y-4">
        {error ? (
          <ErrorSummary error={error} />
        ) : (
          <SourceSummary url={request.originalUrl} scopedProviderId={scopedProviderId} />
        )}

        <section className="rounded-md border border-stone-200 bg-white/95 p-4 shadow-sm backdrop-blur dark:border-stone-800 dark:bg-stone-950/92">
          {status.kind === "loading" ? (
            <div className="flex items-center gap-3 text-sm">
              <Search aria-hidden="true" className="text-yellow-700 dark:text-yellow-300" size={18} />
              <Spinner label={activeStepLabel} />
            </div>
          ) : null}

          {status.kind === "found" ? (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-yellow-400 text-stone-950">
                  <CheckCircle2 aria-hidden="true" size={19} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">
                    {t("resolver.found.title", {
                      provider: getProvider(status.snapshot.providerId).displayName
                    })}
                  </h2>
                  {status.snapshot.strategy === "cleaned" ? (
                    <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
                      {t("resolver.found.cleanedHint")}
                    </p>
                  ) : null}
                  {status.isCheckingMore ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                      <Spinner
                        label={
                          activeStep
                            ? `${t("resolver.found.checkingMore")} ${activeStepLabel}`
                            : t("resolver.found.checkingMore")
                        }
                      />
                    </div>
                  ) : null}
                  <ArchiveSnapshotCard snapshot={status.snapshot} />
                </div>
              </div>
              {status.additionalSnapshots.length > 0 ? (
                <div className="space-y-2 border-t border-stone-200 pt-3 dark:border-stone-800">
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-yellow-50">
                    {t("resolver.found.additionalMatches")}
                  </h3>
                  <div className="space-y-2">
                    {status.additionalSnapshots.map((snapshot) => (
                      <ArchiveSnapshotCard
                        key={snapshotTargetUrl(snapshot)}
                        snapshot={snapshot}
                        description={snapshotCardDescription(t, snapshot)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {status.manualSources.length > 0 ? (
                <div className="space-y-2 border-t border-stone-200 pt-3 dark:border-stone-800">
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-yellow-50">
                    {t("resolver.found.additionalSources")}
                  </h3>
                  <div className="space-y-2">
                    {status.manualSources.map((source) => (
                      <ManualArchiveSourceCard
                        key={`${source.providerId}:${source.url}`}
                        source={source}
                        actionLabel={t("resolver.manual.checkOnProvider", { provider: source.label })}
                        variant="secondary"
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {status.kind === "unverified" ? (
            <div className="space-y-3">
              <div className="flex gap-3">
                <XCircle aria-hidden="true" className="mt-0.5 text-yellow-700 dark:text-yellow-300" size={20} />
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">
                    {t("resolver.unverified.title", {
                      provider: getProvider(status.snapshot.providerId).displayName
                    })}
                  </h2>
                  <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
                    {t("resolver.unverified.description")}
                  </p>
                  {status.snapshot.strategy === "cleaned" ? (
                    <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
                      {t("resolver.found.cleanedHint")}
                    </p>
                  ) : null}
                  <ArchiveSnapshotCard
                    snapshot={status.snapshot}
                    description={t("resolver.unverified.cardNote")}
                  />
                </div>
              </div>
              {status.additionalSnapshots.length > 0 ? (
                <div className="space-y-2 border-t border-stone-200 pt-3 dark:border-stone-800">
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-yellow-50">
                    {t("resolver.unverified.additionalMatches")}
                  </h3>
                  <div className="space-y-2">
                    {status.additionalSnapshots.map((snapshot) => (
                      <ArchiveSnapshotCard
                        key={snapshotTargetUrl(snapshot)}
                        snapshot={snapshot}
                        description={t("resolver.unverified.cardNote")}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {status.manualSources.length > 0 ? (
                <div className="space-y-2 border-t border-stone-200 pt-3 dark:border-stone-800">
                  <p className="text-sm text-stone-600 dark:text-stone-300">
                    {t("resolver.unverified.alsoCheckSources")}
                  </p>
                  <div className="space-y-2">
                    {status.manualSources.map((source) => (
                      <ManualArchiveSourceCard
                        key={`${source.providerId}:${source.url}`}
                        source={source}
                        actionLabel={t("resolver.manual.checkOnProvider", { provider: source.label })}
                        variant="secondary"
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {status.kind === "not-found" ? (
            <div className="space-y-3">
              <div className="flex gap-3">
                <XCircle aria-hidden="true" className="mt-0.5 text-stone-500" size={20} />
                <div>
                  <h2 className="text-base font-semibold">{t("resolver.notFound.title")}</h2>
                  <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
                    {(scopedProviderName
                      ? showStrategyDetails
                        ? t("resolver.notFound.descriptionScoped", {
                            provider: scopedProviderName,
                            strategies: strategyList.format(
                              status.checked.map((strategy) =>
                                t(strategy === "exact" ? "resolver.strategy.exact" : "resolver.strategy.cleaned")
                              )
                            )
                          })
                        : t("resolver.notFound.descriptionScopedSimple", {
                            provider: scopedProviderName
                          })
                      : showStrategyDetails
                        ? t("resolver.notFound.description", {
                            strategies: strategyList.format(
                              status.checked.map((strategy) =>
                                t(strategy === "exact" ? "resolver.strategy.exact" : "resolver.strategy.cleaned")
                              )
                            )
                          })
                        : t("resolver.notFound.descriptionSimple"))}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <LinkButton href={request.originalUrl} variant="secondary" size="sm">
                  <ExternalLink aria-hidden="true" size={14} />
                  {t("common.openCurrentPage")}
                </LinkButton>
                <CopyButton
                  value={request.originalUrl}
                  label={t("resolver.notFound.copyOriginalUrl")}
                  copiedLabel={t("resolver.notFound.originalUrlCopied")}
                />
              </div>
              {status.manualSources.length > 0 ? (
                <div className="space-y-2 border-t border-stone-200 pt-3 dark:border-stone-800">
                  <p className="text-sm text-stone-600 dark:text-stone-300">
                    {t("resolver.notFound.alsoCheckSources")}
                  </p>
                  <div className="space-y-2">
                    {status.manualSources.map((source) => (
                      <ManualArchiveSourceCard
                        key={`${source.providerId}:${source.url}`}
                        source={source}
                        actionLabel={t("resolver.manual.checkOnProvider", { provider: source.label })}
                        variant="secondary"
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {status.kind === "error" ? (
            <div className="space-y-3">
              <div className="flex gap-3">
                <XCircle aria-hidden="true" className="mt-0.5 text-red-700 dark:text-red-300" size={20} />
                <div>
                  <h2 className="text-base font-semibold">{t("resolver.error.title")}</h2>
                  <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{t(status.messageKey)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  {t("common.tryAgain")}
                </Button>
                <CopyButton
                  value={request.originalUrl}
                  label={t("resolver.notFound.copyOriginalUrl")}
                  copiedLabel={t("resolver.notFound.originalUrlCopied")}
                />
              </div>
            </div>
          ) : null}
        </section>

        <ResearcherFooter />
      </div>
    </PageShell>
  );
}

function ArchiveSnapshotCard({
  snapshot,
  description
}: {
  snapshot: ArchiveSnapshot;
  description?: string;
}) {
  const { t } = useI18n();

  return (
    <div className="mt-3 rounded-md bg-stone-100 p-2 dark:bg-stone-900">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1">
        <p className="text-xs font-semibold text-stone-900 dark:text-yellow-50">
          {getProvider(snapshot.providerId).displayName}
        </p>
        <p className="text-[11px] uppercase tracking-[0.12em] text-stone-500 dark:text-stone-400">
          {snapshot.timestamp}
        </p>
      </div>
      <p className="mt-2 break-all px-1 text-xs text-stone-700 dark:text-stone-300">
        {snapshotTargetUrl(snapshot)}
      </p>
      {description ? (
        <p className="mt-2 px-1 text-xs text-stone-600 dark:text-stone-400">{description}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <LinkButton href={snapshotTargetUrl(snapshot)} target="_blank" rel="noreferrer" size="sm">
          <ExternalLink aria-hidden="true" size={14} />
          {t("resolver.found.openArchivedVersion")}
        </LinkButton>
        <CopyButton
          value={snapshotTargetUrl(snapshot)}
          label={t("resolver.found.copyArchiveLink")}
          copiedLabel={t("resolver.found.archiveLinkCopied")}
          variant="ghost"
        />
      </div>
    </div>
  );
}

function ManualArchiveSourceCard({
  source,
  actionLabel,
  variant
}: {
  source: ManualArchiveSource;
  actionLabel: string;
  variant: "secondary";
}) {
  const { t } = useI18n();

  return (
    <div className="mt-3 rounded-md bg-stone-100 p-2 dark:bg-stone-900">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1">
        <p className="text-xs font-semibold text-stone-900 dark:text-yellow-50">{source.label}</p>
      </div>
      <p className="mt-2 break-all px-1 text-xs text-stone-700 dark:text-stone-300">{source.url}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <ManualArchiveSourceButton source={source} actionLabel={actionLabel} variant={variant} />
        <CopyButton
          value={source.url}
          label={t("resolver.found.copyArchiveLink")}
          copiedLabel={t("resolver.found.archiveLinkCopied")}
          variant="ghost"
        />
      </div>
    </div>
  );
}

function ManualArchiveSourceButton({
  source,
  actionLabel,
  variant
}: {
  source: ManualArchiveSource;
  actionLabel: string;
  variant: "secondary";
}) {
  return (
    <LinkButton href={source.url} target="_blank" rel="noreferrer" size="sm" variant={variant}>
      <ExternalLink aria-hidden="true" size={14} />
      {actionLabel}
    </LinkButton>
  );
}
