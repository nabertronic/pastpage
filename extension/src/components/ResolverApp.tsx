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
import { lookupArchives, type LookupLiveUpdate, type LookupProgressStep } from "../core/lookup";
import type { LookupRequest } from "../core/lookupRequest";
import { getProvider } from "../core/providers";
import type { ProviderId } from "../core/providers/types";
import { DEFAULT_SETTINGS, type Settings, type UrlMatchingMode } from "../core/settings";
import type {
  ArchiveSnapshot,
  ArchiveCheckStrategy,
  DetectedError,
  FailedProvider,
  ManualArchiveSource
} from "../core/tabState";
import { I18nProvider, resolveLocaleFromLanguageMode, useI18n } from "../i18n";
import type { TranslationKey } from "../i18n";
import { thanksPageUrl } from "../platform/urls";
import { openArchiveUrl } from "../platform/archiveNavigation";
import { cn } from "../lib/cn";
import {
  completeHistoryEntry,
  consumeFirstArchiveReviewPrompt,
  getSettings,
  incrementSearchCountAndCheckReviewPrompt
} from "../platform/storage";
import { useAppliedTheme } from "./useAppliedTheme";

const autoOpenedSnapshots = new Set<string>();

export function resetResolverAutoOpenStateForTests() {
  autoOpenedSnapshots.clear();
}

function snapshotTargetUrl(snapshot: ArchiveSnapshot) {
  return snapshot.openUrl ?? snapshot.archiveUrl;
}

function strategyTranslationKey(strategy: ArchiveCheckStrategy): TranslationKey {
  if (strategy === "exact") return "resolver.strategy.exact";
  if (strategy === "cleaned") return "resolver.strategy.cleaned";
  return "resolver.strategy.variant";
}

function snapshotCardDescription(t: ReturnType<typeof useI18n>["t"], snapshot: ArchiveSnapshot) {
  const parts: string[] = [];

  if (snapshot.strategy === "cleaned") {
    parts.push(t("resolver.found.cleanedHint"));
  } else if (snapshot.strategy === "variant") {
    parts.push(t("resolver.found.variantHint"));
  }

  if (snapshot.verification === "unverified") {
    parts.push([t("resolver.unverified.cardNote"), snapshot.verificationNote].filter(Boolean).join(" "));
  }

  return parts.length > 0 ? parts.join(" ") : undefined;
}

type ManualSourceMeta = {
  badgeLabel: string;
  badgeTone: "danger" | "warning" | "info";
  badgeTitle?: string;
};

function manualSourceMeta(
  t: ReturnType<typeof useI18n>["t"],
  source: ManualArchiveSource,
  failedProviders: FailedProvider[]
): ManualSourceMeta {
  const failedProvider = failedProviders.find((provider) => provider.providerId === source.providerId);
  const withTechnicalDetail = (badgeTitle: string) =>
    [badgeTitle, failedProvider?.technicalDetail].filter(Boolean).join(" ");

  if (source.providerId === "archive-today" && failedProvider?.reason === "challenge-required") {
    return {
      badgeLabel: t("resolver.manual.badge.captcha"),
      badgeTone: "danger",
      badgeTitle: withTechnicalDetail(t("resolver.manual.archiveTodayChallenge"))
    };
  }

  if (source.providerId === "wayback" && failedProvider?.reason === "rate-limited") {
    return {
      badgeLabel: t("resolver.manual.badge.tooManyRequests"),
      badgeTone: "danger",
      badgeTitle: withTechnicalDetail(t("resolver.manual.waybackRateLimited"))
    };
  }

  if (source.providerId === "yandex-cache") {
    return {
      badgeLabel: t("resolver.manual.badge.manual"),
      badgeTone: "warning",
      badgeTitle: withTechnicalDetail(t("resolver.manual.yandexManualHelp"))
    };
  }

  if (failedProvider?.reason === "challenge-required") {
    return {
      badgeLabel: t("resolver.manual.badge.captcha"),
      badgeTone: "danger",
      badgeTitle: withTechnicalDetail(t("resolver.manual.challenge", { provider: source.label }))
    };
  }

  if (failedProvider?.reason === "rate-limited") {
    return {
      badgeLabel: t("resolver.manual.badge.tooManyRequests"),
      badgeTone: "danger",
      badgeTitle: withTechnicalDetail(t("resolver.manual.rateLimited", { provider: source.label }))
    };
  }

  if (failedProvider?.reason === "timeout") {
    return {
      badgeLabel: t("resolver.manual.badge.timeout"),
      badgeTone: "danger",
      badgeTitle: withTechnicalDetail(t("resolver.manual.timeout", { provider: source.label }))
    };
  }

  if (failedProvider?.reason === "server-error") {
    return {
      badgeLabel: t("resolver.manual.badge.serviceError"),
      badgeTone: "danger",
      badgeTitle: withTechnicalDetail(t("resolver.manual.serviceError", { provider: source.label }))
    };
  }

  if (failedProvider) {
    return {
      badgeLabel: t("resolver.manual.badge.serviceError"),
      badgeTone: "danger",
      badgeTitle: withTechnicalDetail(t("resolver.manual.serviceError", { provider: source.label }))
    };
  }

  return {
    badgeLabel: t("resolver.manual.badge.notFound"),
    badgeTone: "info",
    badgeTitle: withTechnicalDetail(t("resolver.manual.notFound", { provider: source.label }))
  };
}

function renderManualSourceCards(
  t: ReturnType<typeof useI18n>["t"],
  sources: ManualArchiveSource[],
  failedProviders: FailedProvider[]
) {
  return sources.map((source) => (
    <ManualArchiveSourceCard
      key={`${source.providerId}:${source.url}`}
      source={source}
      meta={manualSourceMeta(t, source, failedProviders)}
      actionLabel={t("resolver.manual.checkOnProvider", { provider: source.label })}
      variant="action"
    />
  ));
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
  strategy: ArchiveCheckStrategy;
  url: string;
};

type ResolverStatus =
  | {
      kind: "loading";
      pendingSteps: PendingLookupStep[];
      failedProviders: FailedProvider[];
      manualSources: ManualArchiveSource[];
    }
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
      isCheckingMore: boolean;
      pendingSteps: PendingLookupStep[];
    }
  | {
      kind: "not-found";
      checked: ArchiveCheckStrategy[];
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
    case "canada-gov-web-archive":
    case "vefsafn":
    case "ntuwas":
    case "padicat":
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
  const initialSettings = useRef<Settings>(DEFAULT_SETTINGS);
  const [settings, setSettings] = useState<Settings>(initialSettings.current);
  useAppliedTheme(settings.themeMode);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const request = useMemo(() => requestFromParams(params), [params]);
  const scopedProviderId = useMemo(() => parseScopedProviderId(params), [params]);
  const historyId = useMemo(() => params.get("historyId") ?? undefined, [params]);
  const openedArchiveUrl = useRef<string | null>(null);
  const bufferedSnapshots = useRef<ArchiveSnapshot[]>([]);
  const [status, setStatus] = useState<ResolverStatus>({
    kind: "loading",
    pendingSteps: [],
    failedProviders: [],
    manualSources: []
  });
  const [pendingStepIndex, setPendingStepIndex] = useState(0);
  const pendingSteps =
    status.kind === "loading" || status.kind === "found" || status.kind === "unverified"
      ? status.pendingSteps
      : [];
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
    }, 500);

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

    const openPreferredSnapshot = (snapshot: ArchiveSnapshot, currentSettings: Settings, allowAutoOpen: boolean) => {
      const targetUrl = snapshotTargetUrl(snapshot);
      const autoOpenKey = `${request.originalUrl}::${targetUrl}`;
      if (openedArchiveUrl.current !== null || autoOpenedSnapshots.has(autoOpenKey)) return;

      if (!allowAutoOpen) return;

      openedArchiveUrl.current = targetUrl;
      autoOpenedSnapshots.add(autoOpenKey);

      void consumeFirstArchiveReviewPrompt().then((shouldPrompt) => {
        if (shouldPrompt) {
          void browser.tabs.create({ url: thanksPageUrl(), active: false });
        }
      });

      if (currentSettings.resolverSuccessBehavior === "manual-open-only") return;

      if (currentSettings.resolverSuccessBehavior === "replace-resolver") {
        window.location.assign(targetUrl);
        return;
      }

      void openArchiveUrl(targetUrl, currentSettings.openBehavior);
    };

    let latestRunId = 0;
    let authoritativeSettingsReady = false;
    let resolvedSettings = initialSettings.current;

    async function runLookup(currentSettings: Settings, allowAutoOpen: boolean) {
      const runId = ++latestRunId;

      if (!active || runId !== latestRunId) return;
      setSettings(currentSettings);

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
          if (!active || runId !== latestRunId) return;
          setStatus((current) =>
            current.kind === "found" || current.kind === "unverified"
              ? {
                  ...current,
                  pendingSteps: activeSteps
                }
              : current.kind === "loading"
                ? {
                    ...current,
                    pendingSteps: activeSteps
                  }
              : {
                  kind: "loading",
                  pendingSteps: activeSteps,
                  failedProviders: current.kind === "not-found" ? current.failedProviders : [],
                  manualSources: current.kind === "not-found" ? current.manualSources : []
              }
          );
        },
        (snapshot: ArchiveSnapshot) => {
          if (!active || runId !== latestRunId) return;

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
          if (!active || runId !== latestRunId) return;

          setStatus((current) => {
            const targetUrl = snapshotTargetUrl(snapshot);
            const bufferedAdditionalSnapshots = mergeUniqueSnapshots(
              current.kind === "found" || current.kind === "unverified" ? current.additionalSnapshots : [],
              bufferedSnapshots.current,
              targetUrl
            );
            bufferedSnapshots.current = [];

            const additionalSnapshots =
              current.kind === "found" || current.kind === "unverified"
                ? mergeUniqueSnapshots(bufferedAdditionalSnapshots, current.additionalSnapshots, targetUrl)
                : bufferedAdditionalSnapshots;

            return {
              kind: "found",
              snapshot,
              additionalSnapshots,
              failedProviders:
                current.kind === "found" || current.kind === "unverified" || current.kind === "loading"
                  ? current.failedProviders
                  : [],
              manualSources:
                current.kind === "found" || current.kind === "unverified" || current.kind === "loading"
                  ? current.manualSources
                  : [],
              isCheckingMore: true,
              pendingSteps:
                current.kind === "found" || current.kind === "unverified" || current.kind === "loading"
                  ? current.pendingSteps
                  : []
            };
          });

          openPreferredSnapshot(
            snapshot,
            authoritativeSettingsReady ? resolvedSettings : currentSettings,
            allowAutoOpen || authoritativeSettingsReady
          );
        },
        providerScope,
        currentSettings,
        currentSettings.providerTimeoutSeconds * 1000,
        (snapshot: ArchiveSnapshot) => {
          if (!active || runId !== latestRunId) return;

          setStatus((current) => {
            const targetUrl = snapshotTargetUrl(snapshot);

            if (current.kind === "loading") {
              const additionalSnapshots = mergeUniqueSnapshots([], bufferedSnapshots.current, targetUrl);
              return {
                kind: "unverified",
                snapshot,
                additionalSnapshots,
                failedProviders: current.failedProviders,
                manualSources: current.manualSources,
                isCheckingMore: true,
                pendingSteps: current.pendingSteps
              };
            }

            if (current.kind === "unverified") {
              if (snapshotTargetUrl(current.snapshot) === targetUrl) {
                return current;
              }

              return {
                ...current,
                additionalSnapshots: mergeUniqueSnapshots(current.additionalSnapshots, [snapshot])
              };
            }

            if (current.kind === "found") {
              if (snapshotTargetUrl(current.snapshot) === targetUrl) {
                return current;
              }

              return {
                ...current,
                additionalSnapshots: mergeUniqueSnapshots(current.additionalSnapshots, [snapshot])
              };
            }

            return current;
          });
        },
        ({ failedProviders, manualSources }: LookupLiveUpdate) => {
          if (!active || runId !== latestRunId) return;

          setStatus((current) => {
            if (current.kind === "found" || current.kind === "unverified" || current.kind === "loading") {
              return {
                ...current,
                failedProviders,
                manualSources
              };
            }

            return current;
          });
        }
      );

      if (!active || runId !== latestRunId) return;

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
          manualSources: result.manualSources,
          isCheckingMore: false,
          pendingSteps: []
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

    void incrementSearchCountAndCheckReviewPrompt().then((shouldPrompt) => {
      if (shouldPrompt) {
        void browser.tabs.create({ url: thanksPageUrl(), active: false });
      }
    });

    // Load authoritative settings before running the lookup so it fires exactly
    // once with the user's real configuration instead of an optimistic default
    // pass followed by a second pass (which doubled provider requests).
    void getSettings().then((loadedSettings) => {
      if (!active) return;
      authoritativeSettingsReady = true;
      resolvedSettings = loadedSettings;
      setSettings(loadedSettings);
      void runLookup(loadedSettings, true);
    });

    return () => {
      active = false;
    };
  }, [request.originalUrl, historyId, scopedProviderId]);

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
  const scopedProviderName = scopedProviderId ? getProvider(scopedProviderId).displayName : null;
  const pendingSteps =
    status.kind === "loading" || status.kind === "found" || status.kind === "unverified"
      ? status.pendingSteps
      : [];
  const checkedStrategies = status.kind === "not-found" ? status.checked : [];
  const showStrategyDetails =
    urlMatchingMode !== "exact-only" &&
    (pendingSteps.some((step) => step.strategy !== "exact") ||
      checkedStrategies.some((strategy) => strategy !== "exact"));
  const activeStep = pendingSteps.length > 0 ? pendingSteps[pendingStepIndex % pendingSteps.length] : null;
  const activeStepLabel = activeStep
    ? showStrategyDetails
      ? t(activeStep.phase === "verifying" ? "resolver.verifyingProvider" : "resolver.checkingProvider", {
          provider: getProvider(activeStep.providerId).displayName,
          strategy: t(strategyTranslationKey(activeStep.strategy))
        })
      : t(activeStep.phase === "verifying" ? "resolver.verifyingProviderSimple" : "resolver.checkingProviderSimple", {
          provider: getProvider(activeStep.providerId).displayName
        })
    : t("resolver.startingLookup");
  const foundSnapshots =
    status.kind === "found" || status.kind === "unverified"
      ? [status.snapshot, ...status.additionalSnapshots]
      : [];
  const hasMultipleFoundSnapshots = foundSnapshots.length > 1;

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

          <section className="rounded-md border border-[var(--wf-border)] bg-[var(--wf-surface)] p-4 shadow-[0_1px_0_rgba(17,17,17,0.04),0_12px_30px_rgba(17,17,17,0.05)] backdrop-blur dark:border-stone-800 dark:bg-stone-950/92">
          {status.kind === "loading" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm" role="status" aria-live="polite" aria-atomic="true">
                <Search aria-hidden="true" className="text-yellow-700 dark:text-yellow-300" size={18} />
                <Spinner label={activeStepLabel} />
              </div>
              {status.manualSources.length > 0 ? (
                <div className="space-y-2 border-t border-[var(--wf-border)] pt-3 dark:border-stone-800">
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-yellow-50">
                    {t("resolver.found.additionalSources")}
                  </h3>
                  <div className="space-y-2">
                    {renderManualSourceCards(t, status.manualSources, status.failedProviders)}
                  </div>
                </div>
              ) : null}
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
                    {hasMultipleFoundSnapshots
                      ? t("resolver.found.titleMultiple")
                      : t("resolver.found.title", {
                          provider: getProvider(status.snapshot.providerId).displayName
                        })}
                  </h2>
                  {status.isCheckingMore ? (
                    <div
                      className="mt-2 flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400"
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      <Spinner
                        label={activeStep ? activeStepLabel : t("resolver.found.checkingMore")}
                      />
                    </div>
                  ) : null}
                  <div className="space-y-2" aria-live="polite" aria-relevant="additions text">
                    {foundSnapshots.map((snapshot) => (
                      <ArchiveSnapshotCard
                        key={snapshotTargetUrl(snapshot)}
                        snapshot={snapshot}
                        description={snapshotCardDescription(t, snapshot)}
                      />
                    ))}
                  </div>
                </div>
              </div>
              {status.manualSources.length > 0 ? (
                <div className="space-y-2 border-t border-[var(--wf-border)] pt-3 dark:border-stone-800">
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-yellow-50">
                    {t("resolver.found.additionalSources")}
                  </h3>
                  <div className="space-y-2">
                    {renderManualSourceCards(t, status.manualSources, status.failedProviders)}
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
                    {hasMultipleFoundSnapshots
                      ? t("resolver.unverified.titleMultiple")
                      : t("resolver.unverified.title", {
                          provider: getProvider(status.snapshot.providerId).displayName
                        })}
                  </h2>
                  <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
                    {t("resolver.unverified.description")}
                  </p>
                  {status.isCheckingMore ? (
                    <div
                      className="mt-2 flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400"
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      <Spinner
                        label={activeStep ? activeStepLabel : t("resolver.found.checkingMore")}
                      />
                    </div>
                  ) : null}
                  <div className="space-y-2" aria-live="polite" aria-relevant="additions text">
                    {foundSnapshots.map((snapshot) => (
                      <ArchiveSnapshotCard
                        key={snapshotTargetUrl(snapshot)}
                        snapshot={snapshot}
                        description={snapshotCardDescription(t, snapshot)}
                      />
                    ))}
                  </div>
                </div>
              </div>
              {status.manualSources.length > 0 ? (
                <div className="space-y-2 border-t border-[var(--wf-border)] pt-3 dark:border-stone-800">
                  <p className="text-sm text-stone-600 dark:text-stone-300">
                    {t("resolver.unverified.alsoCheckSources")}
                  </p>
                  <div className="space-y-2">
                    {renderManualSourceCards(t, status.manualSources, status.failedProviders)}
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
                              checkedStrategies.map((strategy) =>
                                t(strategyTranslationKey(strategy))
                              )
                            )
                          })
                        : t("resolver.notFound.descriptionScopedSimple", {
                            provider: scopedProviderName
                          })
                      : showStrategyDetails
                        ? t("resolver.notFound.description", {
                            strategies: strategyList.format(
                              checkedStrategies.map((strategy) =>
                                t(strategyTranslationKey(strategy))
                              )
                            )
                          })
                        : t("resolver.notFound.descriptionSimple"))}
                  </p>
                </div>
              </div>
              {status.manualSources.length > 0 ? (
                <div className="space-y-2 border-t border-[var(--wf-border)] pt-3 dark:border-stone-800">
                  <p className="text-sm text-stone-600 dark:text-stone-300">
                    {t("resolver.notFound.alsoCheckSources")}
                  </p>
                  <div className="space-y-2">
                    {renderManualSourceCards(t, status.manualSources, status.failedProviders)}
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
    <div className="mt-3 rounded-md border border-[var(--wf-border)] bg-[var(--wf-surface-raised)] p-3 dark:border-stone-800 dark:bg-stone-900">
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
        <LinkButton href={snapshotTargetUrl(snapshot)} target="_blank" rel="noreferrer" size="sm" variant="action">
          <ExternalLink aria-hidden="true" size={14} />
          {t("resolver.found.openArchivedVersion")}
        </LinkButton>
        <CopyButton
          value={snapshotTargetUrl(snapshot)}
          label={t("resolver.found.copyArchiveLink")}
          copiedLabel={t("resolver.found.archiveLinkCopied")}
        />
      </div>
    </div>
  );
}

function ManualArchiveSourceCard({
  source,
  meta,
  actionLabel,
  variant
}: {
  source: ManualArchiveSource;
  meta: ManualSourceMeta;
  actionLabel: string;
  variant: "action";
}) {
  const { t } = useI18n();
  const [showTooltip, setShowTooltip] = useState(false);
  const isYandexCache = source.providerId === "yandex-cache";

  return (
    <div className="mt-3 rounded-md border border-[var(--wf-border)] bg-[var(--wf-surface-raised)] p-3 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1">
        <p className="text-xs font-semibold text-stone-900 dark:text-yellow-50">{source.label}</p>
        <button
          type="button"
          aria-label={meta.badgeLabel}
          aria-describedby={showTooltip && meta.badgeTitle ? `${source.providerId}-badge-tooltip` : undefined}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
          className={cn(
            "relative inline-flex cursor-default items-center rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-[0.04em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400",
            meta.badgeTone === "danger"
              ? "border-red-500/40 bg-red-500/15 text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200"
                : meta.badgeTone === "warning"
                  ? "border-yellow-500/40 bg-yellow-300/15 text-yellow-800 dark:border-yellow-300/30 dark:bg-yellow-300/10 dark:text-yellow-200"
                  : "border-[var(--wf-border-strong)] bg-[var(--wf-surface-raised)] text-stone-700 dark:border-stone-500/30 dark:bg-stone-600/20 dark:text-stone-400"
          )}
        >
          {meta.badgeLabel}
          {meta.badgeTitle && showTooltip ? (
            <span
              id={`${source.providerId}-badge-tooltip`}
              role="tooltip"
              className="pointer-events-none absolute left-1/2 bottom-[calc(100%+6px)] z-50 w-max max-w-72 -translate-x-1/2 rounded-md border border-[var(--wf-border)] bg-[var(--wf-surface)] px-3 py-2 text-xs leading-5 font-normal tracking-normal text-stone-700 shadow-xl dark:border-stone-700 dark:bg-stone-950 dark:text-yellow-50"
            >
              {meta.badgeTitle}
            </span>
          ) : null}
        </button>
      </div>
      <p className="mt-2 break-all px-1 text-xs text-stone-700 dark:text-stone-300">{source.url}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <ManualArchiveSourceButton source={source} actionLabel={actionLabel} variant={variant} />
        {source.cleanedUrl ? (
          <LinkButton href={source.cleanedUrl} target="_blank" rel="noreferrer" size="sm" variant={variant}>
            <ExternalLink aria-hidden="true" size={14} />
            {t("resolver.manual.checkCleanedUrl")}
          </LinkButton>
        ) : null}
        <CopyButton
          value={source.url}
          label={t(isYandexCache ? "resolver.found.copyCacheLink" : "resolver.found.copyArchiveLink")}
          copiedLabel={t(isYandexCache ? "resolver.found.cacheLinkCopied" : "resolver.found.archiveLinkCopied")}
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
  variant: "action";
}) {
  return (
    <LinkButton href={source.url} target="_blank" rel="noreferrer" size="sm" variant={variant}>
      <ExternalLink aria-hidden="true" size={14} />
      {actionLabel}
    </LinkButton>
  );
}
