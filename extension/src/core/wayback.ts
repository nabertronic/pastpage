import type { TranslationKey } from "../i18n/messages";
import type { UrlMatchingMode } from "./settings";
import type { ArchiveSnapshot } from "./tabState";
import { waybackProvider } from "./providers/wayback";
import { buildSearchCandidates, getUrlEligibility, type SearchCandidate } from "./urlPolicy";

export {
  buildCdxUrl,
  buildCaptureCountCdxUrl,
  buildWaybackViewerUrl,
  lookupCaptureCount,
  parseCaptureCountResponse,
  parseCdxResponse,
  selectLatestSnapshot
} from "./providers/wayback";

export type ArchiveLookupResult =
  | { status: "found"; snapshot: ArchiveSnapshot; checked: SearchCandidate[] }
  | { status: "not-found"; checked: SearchCandidate[] }
  | { status: "not-eligible"; reasonKey: TranslationKey }
  | { status: "provider-error"; message: string; checked: SearchCandidate[] };

export type LookupProgressStep = {
  strategy: "exact" | "cleaned";
  url: string;
};

export type WaybackCaptureCountResult =
  | { status: "counted"; count: number; strategy: "exact" | "cleaned"; checked: SearchCandidate[] }
  | { status: "not-eligible"; reasonKey: TranslationKey }
  | { status: "provider-error"; message: string; checked: SearchCandidate[] };

export async function lookupWayback(
  rawUrl: string,
  mode: UrlMatchingMode,
  fetchImpl: typeof fetch = fetch,
  onProgress?: (step: LookupProgressStep) => void
): Promise<ArchiveLookupResult> {
  const eligibility = getUrlEligibility(rawUrl);
  if (!eligibility.eligible) {
    return { status: "not-eligible", reasonKey: eligibility.reasonKey };
  }

  const checked: SearchCandidate[] = [];
  const candidates = buildSearchCandidates(rawUrl, mode);

  try {
    for (const candidate of candidates) {
      checked.push(candidate);
      onProgress?.(candidate);
      const snapshot = await waybackProvider.lookup(candidate, fetchImpl);

      if (snapshot) {
        return {
          status: "found",
          snapshot: {
            ...snapshot,
            originalUrl: rawUrl,
            matchedUrl: candidate.url,
            strategy: candidate.strategy
          },
          checked
        };
      }
    }
  } catch (error) {
    return {
      status: "provider-error",
      message: error instanceof Error ? error.message : "Wayback lookup failed",
      checked
    };
  }

  return { status: "not-found", checked };
}

export async function lookupWaybackCaptureCount(
  rawUrl: string,
  mode: UrlMatchingMode,
  fetchImpl: typeof fetch = fetch,
  onProgress?: (step: LookupProgressStep) => void
): Promise<WaybackCaptureCountResult> {
  const eligibility = getUrlEligibility(rawUrl);
  if (!eligibility.eligible) {
    return { status: "not-eligible", reasonKey: eligibility.reasonKey };
  }

  const checked: SearchCandidate[] = [];
  const candidates = buildSearchCandidates(rawUrl, mode);

  try {
    for (const [index, candidate] of candidates.entries()) {
      checked.push(candidate);
      onProgress?.(candidate);
      const count = await waybackProvider.lookupCaptureCount(candidate, fetchImpl);

      if (count > 0 || index === candidates.length - 1) {
        return {
          status: "counted",
          count,
          strategy: candidate.strategy,
          checked
        };
      }
    }
  } catch (error) {
    return {
      status: "provider-error",
      message: error instanceof Error ? error.message : "Wayback capture count lookup failed",
      checked
    };
  }

  return { status: "counted", count: 0, strategy: "exact", checked };
}
