import type { TranslationKey } from "../i18n/messages";
import type { ProviderHostSettings } from "./providerHosts";
import {
  buildAutomaticProviderOrder,
  buildManualSourceProviderOrder,
  getAutomaticProvider,
  getProvider
} from "./providers";
import type { ProviderId } from "./providers/types";
import type { UrlMatchingMode } from "./settings";
import type { ArchiveSnapshot, FailedProvider, ManualArchiveSource } from "./tabState";
import { buildSearchCandidates, getUrlEligibility, type SearchCandidate } from "./urlPolicy";

export type ProviderAttempt = {
  providerId: ProviderId;
  strategy: "exact" | "cleaned";
  url: string;
  outcome: "hit" | "miss" | "error";
};

export type LookupProgressStep = {
  providerId: ProviderId;
  strategy: "exact" | "cleaned";
  url: string;
};

export type LookupProgressCallback = (
  step: LookupProgressStep,
  visibleSteps: LookupProgressStep[]
) => void;

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
      status: "not-found";
      checked: ProviderAttempt[];
      failedProviders: FailedProvider[];
      manualSources: ManualArchiveSource[];
    }
  | { status: "not-eligible"; reasonKey: TranslationKey };

type WaybackLookupState = "pending" | "hit" | "miss" | "error";

export function lookupArchives(
  rawUrl: string,
  matchingMode: UrlMatchingMode,
  fetchImpl?: typeof fetch,
  onProgress?: LookupProgressCallback,
  onSnapshotFound?: (snapshot: ArchiveSnapshot) => void,
  onPreferredSnapshotFound?: (snapshot: ArchiveSnapshot) => void,
  providerScope?: ProviderId[],
  hostSettings?: ProviderHostSettings
): Promise<MultiArchiveLookupResult>;
export async function lookupArchives(
  rawUrl: string,
  matchingMode: UrlMatchingMode,
  fetchImpl?: typeof fetch,
  onProgress?: LookupProgressCallback,
  onSnapshotFound?: ((snapshot: ArchiveSnapshot) => void) | undefined,
  onPreferredSnapshotFound?: (snapshot: ArchiveSnapshot) => void,
  providerScope?: ProviderId[],
  hostSettings?: ProviderHostSettings
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
  const candidates: SearchCandidate[] = buildSearchCandidates(rawUrl, matchingMode);
  const providerOrderIndex = new Map(order.map((providerId, index) => [providerId, index]));

  const checked: ProviderAttempt[] = [];
  const failedProviderIds = new Set<ProviderId>();
  const foundSnapshots: ArchiveSnapshot[] = [];
  const foundSnapshotUrls = new Set<string>();
  const currentProviderSteps = new Map<ProviderId, LookupProgressStep>();

  let waybackState: WaybackLookupState = "pending";
  let openedSnapshot: ArchiveSnapshot | null = null;
  let bestNonWaybackSnapshot: ArchiveSnapshot | null = null;

  const tryEmitPreferredSnapshot = (snapshot: ArchiveSnapshot | null) => {
    if (!snapshot || openedSnapshot) return;
    openedSnapshot = snapshot;
    onPreferredSnapshotFound?.(snapshot);
  };

  const recordSnapshot = (snapshot: ArchiveSnapshot) => {
    if (foundSnapshotUrls.has(snapshot.archiveUrl)) return;
    foundSnapshotUrls.add(snapshot.archiveUrl);
    foundSnapshots.push(snapshot);
    onSnapshotFound?.(snapshot);
  };

  const maybeEmitFallbackSnapshot = () => {
    if (waybackState === "pending" || waybackState === "hit") return;
    tryEmitPreferredSnapshot(bestNonWaybackSnapshot);
  };

  const emitVisibleSteps = (step: LookupProgressStep) => {
    const visibleSteps = Array.from(currentProviderSteps.values()).sort(
      (a, b) =>
        (providerOrderIndex.get(a.providerId) ?? Number.MAX_SAFE_INTEGER) -
        (providerOrderIndex.get(b.providerId) ?? Number.MAX_SAFE_INTEGER)
    );
    onProgress?.(step, visibleSteps);
  };

  await Promise.all(
    order.map(async (providerId) => {
      const provider = getAutomaticProvider(providerId);
      let providerErrored = false;
      let foundSnapshotForProvider = false;

      for (const candidate of candidates) {
        const step = { providerId, strategy: candidate.strategy, url: candidate.url } as const;
        currentProviderSteps.set(providerId, step);
        emitVisibleSteps(step);

        try {
          const snapshot = await provider.lookup(candidate, effectiveFetchImpl, hostSettings);
          if (snapshot) {
            const normalizedSnapshot: ArchiveSnapshot = {
              ...snapshot,
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
            foundSnapshotForProvider = true;
            recordSnapshot(normalizedSnapshot);

            if (providerId === "wayback") {
              waybackState = "hit";
              tryEmitPreferredSnapshot(normalizedSnapshot);
            } else if (
              !bestNonWaybackSnapshot ||
              compareSnapshots(normalizedSnapshot, bestNonWaybackSnapshot, providerOrderIndex) < 0
            ) {
              bestNonWaybackSnapshot = normalizedSnapshot;
            }

            maybeEmitFallbackSnapshot();
            break;
          }

          checked.push({
            providerId,
            strategy: candidate.strategy,
            url: candidate.url,
            outcome: "miss"
          });
        } catch {
          checked.push({
            providerId,
            strategy: candidate.strategy,
            url: candidate.url,
            outcome: "error"
          });
          providerErrored = true;
          break;
        }
      }

      if (providerErrored) {
        failedProviderIds.add(providerId);
      }

      if (providerId === "wayback" && waybackState === "pending") {
        waybackState = providerErrored ? "error" : foundSnapshotForProvider ? "hit" : "miss";
        maybeEmitFallbackSnapshot();
      }
    })
  );

  const failedProviders: FailedProvider[] = Array.from(failedProviderIds).map((providerId) => ({
    providerId,
    directLink: getProvider(providerId).buildDirectLinkUrl(rawUrl, hostSettings) ?? undefined
  }));

  const foundProviderIds = new Set(foundSnapshots.map((snapshot) => snapshot.providerId));
  const manualSources = buildManualSources(rawUrl, foundProviderIds, allowedProviderIds, hostSettings);

  if (foundSnapshots.length > 0) {
    const sortedSnapshots = [...foundSnapshots].sort((a, b) =>
      compareSnapshots(a, b, providerOrderIndex)
    );
    const snapshot = openedSnapshot ?? pickPrimarySnapshot(sortedSnapshots);
    const additionalSnapshots = sortedSnapshots.filter(
      (candidate) => candidate.archiveUrl !== snapshot.archiveUrl
    );

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

  return { status: "not-found", checked, failedProviders, manualSources };
}

function buildManualSources(
  rawUrl: string,
  foundProviderIds: Set<ProviderId>,
  allowedProviderIds: Set<ProviderId> | null,
  hostSettings?: ProviderHostSettings
): ManualArchiveSource[] {
  const seen = new Set<string>();
  const providerIds = buildManualSourceProviderOrder(rawUrl);

  return providerIds
    .filter((providerId) => !allowedProviderIds || allowedProviderIds.has(providerId))
    .filter((providerId) => !foundProviderIds.has(providerId))
    .flatMap((providerId) => {
      const provider = getProvider(providerId);
      const url = provider.buildDirectLinkUrl(rawUrl, hostSettings);
      if (!url) return [];

      const key = `${providerId}:${url}`;
      if (seen.has(key)) return [];
      seen.add(key);

      return [
        {
          providerId,
          label: provider.displayName,
          url
        }
      ];
    });
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
