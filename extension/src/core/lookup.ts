import type { TranslationKey } from "../i18n/messages";
import type { ProviderHostSettings } from "./providerHosts";
import {
  buildAutomaticProviderOrder,
  buildManualSourceProviderOrder,
  getAutomaticProvider,
  getProvider
} from "./providers";
import { ProviderLookupError, type ProviderFailureReason, type ProviderId } from "./providers/types";
import type { UrlMatchingMode } from "./settings";
import type {
  ArchiveCheckStrategy,
  ArchiveSnapshot,
  FailedProvider,
  ManualArchiveSource
} from "./tabState";
import {
  buildSearchCandidates,
  buildUrlVariantCandidates,
  getUrlEligibility,
  type SearchCandidate
} from "./urlPolicy";
import type { PhaseAwareFetch } from "./providers/common";

export type ProviderAttempt = {
  providerId: ProviderId;
  strategy: ArchiveCheckStrategy;
  url: string;
  outcome: "hit" | "miss" | "error";
};

export type LookupProgressStep = {
  providerId: ProviderId;
  phase: "querying" | "verifying";
  strategy: ArchiveCheckStrategy;
  url: string;
};

export type LookupProgressCallback = (
  step: LookupProgressStep,
  visibleSteps: LookupProgressStep[]
) => void;

export type LookupLiveUpdate = {
  checked: ProviderAttempt[];
  failedProviders: FailedProvider[];
  manualSources: ManualArchiveSource[];
};

const DEFAULT_QUERY_TIMEOUT_RATIO = 0.4;
const MIN_QUERY_TIMEOUT_MS = 5_000;

export function resetProviderCooldownsForTests() {
  // Kept for test compatibility; provider short-circuiting is now per lookup only.
}

export type MultiArchiveLookupResult =
  | {
      status: "found";
      snapshot: ArchiveSnapshot;
      additionalSnapshots: ArchiveSnapshot[];
      failedProviders: FailedProvider[];
      manualSources: ManualArchiveSource[];
      providerId: ProviderId;
      checked: ProviderAttempt[];
    }
  | {
      status: "unverified";
      snapshot: ArchiveSnapshot;
      additionalSnapshots: ArchiveSnapshot[];
      failedProviders: FailedProvider[];
      manualSources: ManualArchiveSource[];
      providerId: ProviderId;
      checked: ProviderAttempt[];
    }
  | {
      status: "not-found";
      checked: ProviderAttempt[];
      failedProviders: FailedProvider[];
      manualSources: ManualArchiveSource[];
    }
  | { status: "not-eligible"; reasonKey: TranslationKey };

export function lookupArchives(
  rawUrl: string,
  matchingMode: UrlMatchingMode,
  fetchImpl?: typeof fetch,
  onProgress?: LookupProgressCallback,
  onSnapshotFound?: (snapshot: ArchiveSnapshot) => void,
  onPreferredSnapshotFound?: (snapshot: ArchiveSnapshot) => void,
  providerScope?: ProviderId[],
  hostSettings?: ProviderHostSettings,
  providerTimeoutMs?: number,
  onUnverifiedSnapshotFound?: (snapshot: ArchiveSnapshot) => void,
  onLiveUpdate?: (update: LookupLiveUpdate) => void
): Promise<MultiArchiveLookupResult>;
export async function lookupArchives(
  rawUrl: string,
  matchingMode: UrlMatchingMode,
  fetchImpl?: typeof fetch,
  onProgress?: LookupProgressCallback,
  onSnapshotFound?: ((snapshot: ArchiveSnapshot) => void) | undefined,
  onPreferredSnapshotFound?: (snapshot: ArchiveSnapshot) => void,
  providerScope?: ProviderId[],
  hostSettings?: ProviderHostSettings,
  providerTimeoutMs?: number,
  onUnverifiedSnapshotFound?: (snapshot: ArchiveSnapshot) => void,
  onLiveUpdate?: ((update: LookupLiveUpdate) => void) | undefined
): Promise<MultiArchiveLookupResult> {
  const eligibility = getUrlEligibility(rawUrl);
  if (!eligibility.eligible) {
    return { status: "not-eligible", reasonKey: eligibility.reasonKey };
  }

  const effectiveFetchImpl = fetchImpl ?? fetch;
  const allowedProviderIds = providerScope ? new Set(providerScope) : null;
  const order = buildAutomaticProviderOrder(rawUrl).filter(
    (providerId) => !allowedProviderIds || allowedProviderIds.has(providerId)
  );
  const primaryCandidates = buildSearchCandidates(rawUrl, matchingMode);
  const variantCandidates = buildUrlVariantCandidates(rawUrl, matchingMode);
  const candidates: SearchCandidate[] = [...primaryCandidates, ...variantCandidates];
  const providerOrderIndex = new Map(order.map((providerId, index) => [providerId, index]));
  const candidateOrderIndex = new Map(
    candidates.map((candidate, index) => [`${candidate.strategy}:${candidate.url}`, index] as const)
  );

  const checked: ProviderAttempt[] = [];
  const failedProviderIds = new Set<ProviderId>();
  const failedProviderReasons = new Map<ProviderId, ProviderFailureReason>();
  const failedProviderDetails = new Map<ProviderId, string>();
  const foundSnapshots: ArchiveSnapshot[] = [];
  const foundSnapshotUrls = new Set<string>();
  const unverifiedSnapshots: ArchiveSnapshot[] = [];
  const unverifiedSnapshotUrls = new Set<string>();
  const currentLookupSteps = new Map<string, LookupProgressStep>();
  const completedProviderIds = new Set<ProviderId>();

  let openedSnapshot: ArchiveSnapshot | null = null;

  const tryEmitPreferredSnapshot = (snapshot: ArchiveSnapshot | null) => {
    if (!snapshot || openedSnapshot) return;
    openedSnapshot = snapshot;
    onPreferredSnapshotFound?.(snapshot);
  };

  const recordSnapshot = (snapshot: ArchiveSnapshot) => {
    if (unverifiedSnapshotUrls.delete(snapshot.archiveUrl)) {
      const index = unverifiedSnapshots.findIndex((candidate) => candidate.archiveUrl === snapshot.archiveUrl);
      if (index >= 0) {
        unverifiedSnapshots.splice(index, 1);
      }
    }
    if (foundSnapshotUrls.has(snapshot.archiveUrl)) return;
    foundSnapshotUrls.add(snapshot.archiveUrl);
    foundSnapshots.push(snapshot);
    onSnapshotFound?.(snapshot);
  };

  const recordUnverifiedSnapshot = (snapshot: ArchiveSnapshot) => {
    if (foundSnapshotUrls.has(snapshot.archiveUrl)) return;
    if (unverifiedSnapshotUrls.has(snapshot.archiveUrl)) return;
    unverifiedSnapshotUrls.add(snapshot.archiveUrl);
    unverifiedSnapshots.push(snapshot);
    onUnverifiedSnapshotFound?.(snapshot);
  };

  const getStepKey = (providerId: ProviderId, candidate: SearchCandidate) =>
    `${providerId}:${candidate.strategy}:${candidate.url}`;

  const emitVisibleSteps = (step: LookupProgressStep) => {
    const visibleSteps = Array.from(currentLookupSteps.values()).sort(
      (a, b) =>
        (providerOrderIndex.get(a.providerId) ?? Number.MAX_SAFE_INTEGER) -
          (providerOrderIndex.get(b.providerId) ?? Number.MAX_SAFE_INTEGER) ||
        (candidateOrderIndex.get(`${a.strategy}:${a.url}`) ?? Number.MAX_SAFE_INTEGER) -
          (candidateOrderIndex.get(`${b.strategy}:${b.url}`) ?? Number.MAX_SAFE_INTEGER)
    );
    onProgress?.(step, visibleSteps);
  };

  const buildFailedProviders = (providerIds: Iterable<ProviderId>): FailedProvider[] =>
    Array.from(providerIds).map((providerId) => ({
      providerId,
      directLink: getProvider(providerId).buildDirectLinkUrl(rawUrl, hostSettings) ?? undefined,
      reason: failedProviderReasons.get(providerId),
      technicalDetail: failedProviderDetails.get(providerId)
    }));

  const emitLiveUpdate = () => {
    const foundProviderIds = new Set(
      [...foundSnapshots, ...unverifiedSnapshots].map((snapshot) => snapshot.providerId)
    );
    const failedProviders = buildFailedProviders(failedProviderIds);
    const visibleManualProviderIds = new Set<ProviderId>();

    for (const providerId of completedProviderIds) {
      if (!foundProviderIds.has(providerId)) {
        visibleManualProviderIds.add(providerId);
      }
    }

    for (const providerId of buildManualSourceProviderOrder(rawUrl)) {
      if (allowedProviderIds && !allowedProviderIds.has(providerId)) continue;
      if (getProvider(providerId).kind === "manual") {
        visibleManualProviderIds.add(providerId);
      }
    }

    const manualSources = buildManualSources(rawUrl, foundProviderIds, visibleManualProviderIds, hostSettings);

    onLiveUpdate?.({
      checked: [...checked].sort(
        (a, b) =>
          (providerOrderIndex.get(a.providerId) ?? Number.MAX_SAFE_INTEGER) -
            (providerOrderIndex.get(b.providerId) ?? Number.MAX_SAFE_INTEGER) ||
          (candidateOrderIndex.get(`${a.strategy}:${a.url}`) ?? Number.MAX_SAFE_INTEGER) -
            (candidateOrderIndex.get(`${b.strategy}:${b.url}`) ?? Number.MAX_SAFE_INTEGER)
      ),
      failedProviders,
      manualSources
    });
  };

  await Promise.all(
    order.map(async (providerId) => {
      const provider = getAutomaticProvider(providerId);
      let providerHadError = false;
      let providerHadSuccess = false;
      let variantStageDeadline: number | undefined;

      for (const candidate of candidates) {
        if (candidate.strategy === "variant" && (providerHadSuccess || providerHadError)) {
          break;
        }

        if (
          candidate.strategy === "variant" &&
          variantStageDeadline === undefined &&
          providerTimeoutMs &&
          Number.isFinite(providerTimeoutMs) &&
          providerTimeoutMs > 0
        ) {
          variantStageDeadline = Date.now() + providerTimeoutMs;
        }
        const providerFetchImpl = createAttemptFetch(
          effectiveFetchImpl,
          providerTimeoutMs,
          candidate.strategy === "variant" ? variantStageDeadline : undefined
        );
        const stepKey = getStepKey(providerId, candidate);
        const step = {
          providerId,
          phase: "querying",
          strategy: candidate.strategy,
          url: candidate.url
        } as const;
        currentLookupSteps.set(stepKey, step);
        emitVisibleSteps(step);

        try {
          const providerResult = await provider.lookup(
            candidate,
            providerFetchImpl,
            hostSettings,
            (phase) => {
              const progressStep = {
                providerId,
                phase,
                strategy: candidate.strategy,
                url: candidate.url
              } as const;
              currentLookupSteps.set(stepKey, progressStep);
              emitVisibleSteps(progressStep);
            },
            (snapshot) => {
              const normalizedSnapshot: ArchiveSnapshot = {
                ...snapshot,
                originalUrl: rawUrl,
                matchedUrl: candidate.url,
                strategy: candidate.strategy,
                providerId
              };

              if (snapshot.verification === "unverified") {
                recordUnverifiedSnapshot(normalizedSnapshot);
              }
            }
          );

          if (providerResult.status === "confirmed" || providerResult.status === "unverified") {
            providerHadSuccess = true;
            const normalizedSnapshot: ArchiveSnapshot = {
              ...providerResult.snapshot,
              originalUrl: rawUrl,
              matchedUrl: candidate.url,
              strategy: candidate.strategy,
              providerId
            };
            checked.push({
              providerId,
              strategy: candidate.strategy,
              url: candidate.url,
              outcome: "hit"
            });
            if (providerResult.status === "confirmed") {
              recordSnapshot(normalizedSnapshot);
              tryEmitPreferredSnapshot(normalizedSnapshot);
            } else {
              recordUnverifiedSnapshot(normalizedSnapshot);
            }
            continue;
          }

          checked.push({
            providerId,
            strategy: candidate.strategy,
            url: candidate.url,
            outcome: "miss"
          });
        } catch (error) {
          providerHadError = true;
          if (error instanceof ProviderLookupError && error.reason) {
            failedProviderReasons.set(providerId, error.reason);
            if (error.technicalDetail) {
              failedProviderDetails.set(providerId, error.technicalDetail);
            }
          } else if (error instanceof DOMException && error.name === "AbortError") {
            failedProviderReasons.set(providerId, "timeout");
            failedProviderDetails.set(providerId, "query timeout");
          }
          checked.push({
            providerId,
            strategy: candidate.strategy,
            url: candidate.url,
            outcome: "error"
          });

          if (
            error instanceof ProviderLookupError &&
            (error.reason === "rate-limited" || error.reason === "challenge-required")
          ) {
            break;
          }

        } finally {
          const lastKnownStep = currentLookupSteps.get(stepKey) ?? step;
          currentLookupSteps.delete(stepKey);
          emitVisibleSteps(lastKnownStep);
        }
      }

      if (providerHadError && !providerHadSuccess) {
        failedProviderIds.add(providerId);
      }
      completedProviderIds.add(providerId);
      emitLiveUpdate();
    })
  );

  checked.sort(
    (a, b) =>
      (providerOrderIndex.get(a.providerId) ?? Number.MAX_SAFE_INTEGER) -
        (providerOrderIndex.get(b.providerId) ?? Number.MAX_SAFE_INTEGER) ||
      (candidateOrderIndex.get(`${a.strategy}:${a.url}`) ?? Number.MAX_SAFE_INTEGER) -
        (candidateOrderIndex.get(`${b.strategy}:${b.url}`) ?? Number.MAX_SAFE_INTEGER)
  );

  const failedProviders = buildFailedProviders(failedProviderIds);

  const foundProviderIds = new Set(
    [...foundSnapshots, ...unverifiedSnapshots].map((snapshot) => snapshot.providerId)
  );
  const manualSources = buildManualSources(rawUrl, foundProviderIds, allowedProviderIds, hostSettings);

  if (foundSnapshots.length > 0) {
    const sortedSnapshots = [...foundSnapshots].sort((a, b) =>
      compareSnapshots(a, b, providerOrderIndex)
    );
    const sortedUnverifiedSnapshots = [...unverifiedSnapshots].sort((a, b) =>
      compareSnapshots(a, b, providerOrderIndex)
    );
    const snapshot = openedSnapshot ?? pickPrimarySnapshot(sortedSnapshots);
    const additionalSnapshots = [
      ...sortedSnapshots.filter((candidate) => candidate.archiveUrl !== snapshot.archiveUrl),
      ...sortedUnverifiedSnapshots
    ];

    return {
      status: "found",
      providerId: snapshot.providerId,
      snapshot,
      additionalSnapshots,
      failedProviders,
      manualSources,
      checked
    };
  }

  if (unverifiedSnapshots.length > 0) {
    const sortedSnapshots = [...unverifiedSnapshots].sort((a, b) =>
      compareSnapshots(a, b, providerOrderIndex)
    );
    const snapshot = pickPrimarySnapshot(sortedSnapshots);
    const additionalSnapshots = sortedSnapshots.filter(
      (candidate) => candidate.archiveUrl !== snapshot.archiveUrl
    );

    return {
      status: "unverified",
      providerId: snapshot.providerId,
      snapshot,
      additionalSnapshots,
      failedProviders,
      manualSources,
      checked
    };
  }

  return { status: "not-found", checked, failedProviders, manualSources };
}

function createTimedFetchWithDeadline(fetchImpl: typeof fetch, deadline: number): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new DOMException("The operation was aborted due to timeout", "AbortError");
    }

    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), remainingMs);
    const upstreamSignal = init?.signal;

    const abortFromUpstream = () => controller.abort();
    if (upstreamSignal) {
      if (upstreamSignal.aborted) {
        controller.abort();
      } else {
        upstreamSignal.addEventListener("abort", abortFromUpstream, { once: true });
      }
    }

    try {
      return await fetchImpl(input, {
        ...init,
        signal: controller.signal
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new DOMException("The operation was aborted due to timeout", "AbortError");
      }
      throw error;
    } finally {
      globalThis.clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener("abort", abortFromUpstream);
    }
  }) as typeof fetch;
}

function createAttemptFetch(
  fetchImpl: typeof fetch,
  timeoutMs?: number,
  absoluteDeadline?: number
): typeof fetch {
  if (!timeoutMs || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return fetchImpl;
  }

  const startedAt = Date.now();
  const providerDeadline = absoluteDeadline ?? startedAt + timeoutMs;
  const remainingMs = Math.max(0, providerDeadline - startedAt);
  const queryBudgetMs = Math.max(
    MIN_QUERY_TIMEOUT_MS,
    Math.min(remainingMs, Math.floor(remainingMs * DEFAULT_QUERY_TIMEOUT_RATIO))
  );
  const replayDeadline = providerDeadline;
  const queryDeadline = Math.min(providerDeadline, startedAt + queryBudgetMs);
  const queryFetch = createTimedFetchWithDeadline(fetchImpl, queryDeadline) as PhaseAwareFetch;
  queryFetch.replay = createTimedFetchWithDeadline(fetchImpl, replayDeadline);
  return queryFetch as typeof fetch;
}

function buildManualSources(
  rawUrl: string,
  foundProviderIds: Set<ProviderId>,
  allowedProviderIds: Set<ProviderId> | null,
  hostSettings?: ProviderHostSettings
): ManualArchiveSource[] {
  const seen = new Set<string>();
  const providerIds = buildManualSourceProviderOrder(rawUrl);
  const queryFreeUrl = buildQueryFreeUrl(rawUrl);

  return providerIds
    .filter((providerId) => !allowedProviderIds || allowedProviderIds.has(providerId))
    .filter((providerId) => !foundProviderIds.has(providerId))
    .flatMap((providerId) => {
      const provider = getProvider(providerId);
      const url = provider.buildDirectLinkUrl(rawUrl, hostSettings);
      if (!url) return [];
      const cleanedUrl = queryFreeUrl
        ? provider.buildDirectLinkUrl(queryFreeUrl, hostSettings)
        : null;

      const key = `${providerId}:${url}`;
      if (seen.has(key)) return [];
      seen.add(key);

      return [
        {
          providerId,
          label: provider.displayName,
          url,
          ...(cleanedUrl && cleanedUrl !== url ? { cleanedUrl } : {})
        }
      ];
    });
}

function buildQueryFreeUrl(rawUrl: string): string | null {
  const parsed = new URL(rawUrl);
  if (!parsed.search) return null;

  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function pickPrimarySnapshot(sortedSnapshots: ArchiveSnapshot[]): ArchiveSnapshot {
  const preferredWayback = sortedSnapshots.find((snapshot) => snapshot.providerId === "wayback");
  return preferredWayback ?? sortedSnapshots[0];
}

function compareSnapshots(
  a: ArchiveSnapshot,
  b: ArchiveSnapshot,
  providerOrderIndex: Map<ProviderId, number>
): number {
  const timestampComparison = b.timestamp.localeCompare(a.timestamp);
  if (timestampComparison !== 0) return timestampComparison;

  const providerComparison =
    (providerOrderIndex.get(a.providerId) ?? Number.MAX_SAFE_INTEGER) -
    (providerOrderIndex.get(b.providerId) ?? Number.MAX_SAFE_INTEGER);
  if (providerComparison !== 0) return providerComparison;

  if (a.strategy === b.strategy) return 0;
  return a.strategy === "exact" ? -1 : 1;
}
