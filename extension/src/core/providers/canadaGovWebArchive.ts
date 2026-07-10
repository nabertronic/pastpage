import type { SearchCandidate } from "../urlPolicy";
import type { ArchiveSnapshot, ArchiveSnapshotCandidate } from "../tabState";
import { formatRetryAfterDetail, parseRetryAfterMs } from "./common";
import { detectProviderChallenge } from "./challengeDetection";
import { selectLatestWorkingSnapshot } from "./snapshotValidation";
import { ProviderLookupError } from "./types";
import type { ArchiveProviderLookupResult, AutomaticArchiveProvider } from "./types";

const GCWA_BASE_URL = "https://webarchiveweb.wayback.bac-lac.canada.ca";
const GCWA_COLLECTION = "lac-all";

type TimelineCapture = {
  archiveUrl: string;
  timestamp: string;
};

type GcwaSparklineResponse = {
  first_ts?: string;
  last_ts?: string;
};

export function buildCanadaGovReplayUrl(timestamp: string, originalUrl: string): string {
  return `${GCWA_BASE_URL}/web/${timestamp}/${originalUrl}`;
}

export function parseCanadaGovSparkline(
  payload: string,
  requestedUrl: string
): TimelineCapture | null {
  let parsed: GcwaSparklineResponse;

  try {
    parsed = JSON.parse(payload) as GcwaSparklineResponse;
  } catch {
    return null;
  }

  if (typeof parsed.last_ts !== "string" || !/^\d{14}$/.test(parsed.last_ts)) {
    return null;
  }

  return {
    archiveUrl: buildCanadaGovReplayUrl(parsed.last_ts, requestedUrl),
    timestamp: parsed.last_ts
  };
}

async function lookup(
  candidate: SearchCandidate,
  fetchImpl: typeof fetch,
  _hostSettings?: never,
  onProgress?: (phase: "querying" | "verifying") => void,
  onSnapshot?: (snapshot: ArchiveSnapshot) => void
): Promise<ArchiveProviderLookupResult> {
  onProgress?.("querying");

  const params = new URLSearchParams({
    url: candidate.url,
    output: "json",
    collection: GCWA_COLLECTION
  });
  const response = await fetchImpl(`${GCWA_BASE_URL}/__wb/sparkline?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (response.status === 404) return { status: "miss" };
  if (!response.ok) {
    if (response.status === 429) {
      const retryAfterMs = parseRetryAfterMs(response.headers?.get?.("retry-after"));
      throw new ProviderLookupError(
        "Government of Canada Web Archive rate-limited this request",
        "rate-limited",
        retryAfterMs,
        formatRetryAfterDetail(retryAfterMs) ?? "429 during query"
      );
    }
    if (response.status >= 500) {
      throw new ProviderLookupError(
        `Government of Canada Web Archive returned ${response.status}`,
        "server-error"
      );
    }
    throw new ProviderLookupError(`Government of Canada Web Archive returned ${response.status}`);
  }

  const payload = await response.text();
  if (detectProviderChallenge("canada-gov-web-archive", payload, "query").challenged) {
    throw new ProviderLookupError(
      "Government of Canada Web Archive requires a manual challenge step",
      "challenge-required",
      undefined,
      "challenge page"
    );
  }

  const latestCapture = parseCanadaGovSparkline(payload, candidate.url);
  if (!latestCapture) return { status: "miss" };

  const snapshots: ArchiveSnapshotCandidate[] = [
    {
      originalUrl: candidate.url,
      matchedUrl: candidate.url,
      archiveUrl: latestCapture.archiveUrl,
      timestamp: latestCapture.timestamp,
      statusCode: "200",
      mimeType: "text/html",
      strategy: candidate.strategy,
      providerId: "canada-gov-web-archive" as const
    }
  ];

  return selectLatestWorkingSnapshot(
    snapshots,
    fetchImpl,
    1,
    onProgress ? () => onProgress("verifying") : undefined,
    onSnapshot
  );
}

export const canadaGovWebArchiveProvider: AutomaticArchiveProvider = {
  id: "canada-gov-web-archive",
  displayName: "Government of Canada Web Archive",
  shortDescription: "Canadian federal government websites",
  kind: "automatic",
  purpose: "automatic-snapshot",
  isRelevant: (context) => context.isCanadaGov,
  lookup,
  buildDirectLinkUrl(originalUrl: string): string {
    return `${GCWA_BASE_URL}/*/${originalUrl}`;
  }
};
