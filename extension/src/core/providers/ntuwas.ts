import type { SearchCandidate } from "../urlPolicy";
import type { ArchiveSnapshot, ArchiveSnapshotCandidate } from "../tabState";
import { formatRetryAfterDetail, parseRetryAfterMs } from "./common";
import { selectLatestWorkingSnapshot } from "./snapshotValidation";
import { ProviderLookupError } from "./types";
import type { ArchivePriorityContext, ArchiveProviderLookupResult, AutomaticArchiveProvider } from "./types";

export const NTUWAS_BASE_URL = "https://webarchive.lib.ntu.edu.tw/archive/wayback";

type NtuwasCapture = {
  archiveUrl: string;
  timestamp: string;
};

export function parseNtuwasTimelineCaptures(payload: string): NtuwasCapture[] {
  const pattern = /(?:^|!!!)(https?:\/\/webarchive\.lib\.ntu\.edu\.tw(?::443)?\/archive\/wayback\/(\d{14})\/https?:\/\/[^!]+?)(?=!!!|$)/g;
  let match: RegExpExecArray | null;
  const captures: NtuwasCapture[] = [];

  while ((match = pattern.exec(payload)) !== null) {
    const [, archiveUrl, timestamp] = match;
    captures.push({
      archiveUrl: archiveUrl.replace(":443/", "/"),
      timestamp
    });
  }

  return captures.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function isNtuwasRelevant(context: ArchivePriorityContext): boolean {
  return context.isTaiwanTld;
}

async function lookup(
  candidate: SearchCandidate,
  fetchImpl: typeof fetch,
  _hostSettings?: never,
  onProgress?: (phase: "querying" | "verifying") => void,
  onSnapshot?: (snapshot: ArchiveSnapshot) => void
): Promise<ArchiveProviderLookupResult> {
  onProgress?.("querying");

  const response = await fetchImpl(`${NTUWAS_BASE_URL}/*/${candidate.url}`, {
    method: "GET",
    headers: { Accept: "text/html" }
  });

  if (response.status === 404) return { status: "miss" };
  if (!response.ok) {
    if (response.status === 429) {
      const retryAfterMs = parseRetryAfterMs(response.headers?.get?.("retry-after"));
      throw new ProviderLookupError(
        "NTU Web Archiving System rate-limited this request",
        "rate-limited",
        retryAfterMs,
        formatRetryAfterDetail(retryAfterMs) ?? "429 during query"
      );
    }
    if (response.status >= 500) {
      throw new ProviderLookupError(`NTU Web Archiving System returned ${response.status}`, "server-error");
    }
    throw new ProviderLookupError(`NTU Web Archiving System returned ${response.status}`);
  }

  const snapshots: ArchiveSnapshotCandidate[] = parseNtuwasTimelineCaptures(await response.text()).map(
    (capture) => ({
      originalUrl: candidate.url,
      matchedUrl: candidate.url,
      archiveUrl: capture.archiveUrl,
      timestamp: capture.timestamp,
      statusCode: "200",
      mimeType: "text/html",
      strategy: candidate.strategy,
      providerId: "ntuwas" as const
    })
  );

  return selectLatestWorkingSnapshot(
    snapshots,
    fetchImpl,
    10,
    onProgress ? () => onProgress("verifying") : undefined,
    onSnapshot
  );
}

export const ntuwasProvider: AutomaticArchiveProvider = {
  id: "ntuwas",
  displayName: "NTU Web Archiving System / NTUWAS",
  shortDescription: "Taiwanese websites",
  kind: "automatic",
  purpose: "automatic-snapshot",
  isRelevant: isNtuwasRelevant,
  lookup,
  buildDirectLinkUrl(originalUrl: string): string {
    return `${NTUWAS_BASE_URL}/*/${originalUrl}`;
  }
};
