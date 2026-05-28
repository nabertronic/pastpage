import type { SearchCandidate } from "../urlPolicy";
import type { ArchiveSnapshot, ArchiveSnapshotCandidate } from "../tabState";
import { ProviderLookupError } from "./types";
import type { ArchiveProviderLookupResult, AutomaticArchiveProvider } from "./types";
import {
  absoluteUrl,
  decodeHtmlEntities,
  formatRetryAfterDetail,
  normalizeComparableUrl,
  parseRetryAfterMs,
  timestampFromDate
} from "./common";
import { selectLatestWorkingSnapshot } from "./snapshotValidation";

type GhostarchiveResult = {
  archiveUrl: string;
  originalUrl: string;
  timestamp: string;
};

export function parseGhostarchiveResults(html: string, requestedUrl: string): GhostarchiveResult[] {
  const normalizedRequestedUrl = normalizeComparableUrl(requestedUrl);
  const rowPattern =
    /<tr><td[\s\S]*?<a href="([^"]+)">([^<]+)<\/a><\/td><td>([^<]+)<\/td>[\s\S]*?<td>([^<]+)<\/td><\/tr>/g;

  let match: RegExpExecArray | null;
  const results: GhostarchiveResult[] = [];

  while ((match = rowPattern.exec(html)) !== null) {
    const [, archivePath, rawOriginalUrl, rawDatetime, rawType] = match;
    if (!/archived webpage/i.test(rawType)) continue;

    const originalUrl = decodeHtmlEntities(rawOriginalUrl.trim());
    if (normalizeComparableUrl(originalUrl) !== normalizedRequestedUrl) continue;

    const datetime = new Date(rawDatetime.trim());
    if (Number.isNaN(datetime.getTime())) continue;

    results.push({
      archiveUrl: absoluteUrl("https://ghostarchive.org", archivePath),
      originalUrl,
      timestamp: timestampFromDate(datetime)
    });
  }

  return results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function parseGhostarchiveSearch(html: string, requestedUrl: string): GhostarchiveResult | null {
  return parseGhostarchiveResults(html, requestedUrl)[0] ?? null;
}

async function lookup(
  candidate: SearchCandidate,
  fetchImpl: typeof fetch,
  _hostSettings?: never,
  onProgress?: (phase: "querying" | "verifying") => void,
  onSnapshot?: (snapshot: ArchiveSnapshot) => void
): Promise<ArchiveProviderLookupResult> {
  const params = new URLSearchParams({ term: candidate.url });
  const response = await fetchImpl(`https://ghostarchive.org/search?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "text/html" }
  });

  if (response.status === 404) return { status: "miss" };
  if (!response.ok) {
    if (response.status === 429) {
      const retryAfterMs = parseRetryAfterMs(response.headers?.get?.("retry-after"));
      throw new ProviderLookupError(
        "Ghostarchive rate-limited this request",
        "rate-limited",
        retryAfterMs,
        formatRetryAfterDetail(retryAfterMs) ?? "429 during query"
      );
    }
    if (response.status >= 500) throw new ProviderLookupError(`Ghostarchive returned ${response.status}`, "server-error");
    throw new ProviderLookupError(`Ghostarchive returned ${response.status}`);
  }

  const html = await response.text();
  const snapshots: ArchiveSnapshotCandidate[] = parseGhostarchiveResults(html, candidate.url).map((result) => ({
      originalUrl: candidate.url,
      matchedUrl: result.originalUrl,
      archiveUrl: result.archiveUrl,
      timestamp: result.timestamp,
      statusCode: "200",
      mimeType: "text/html",
      strategy: candidate.strategy,
      providerId: "ghostarchive" as const
    }));

  return selectLatestWorkingSnapshot(
    snapshots,
    fetchImpl,
    10,
    onProgress ? () => onProgress("verifying") : undefined,
    onSnapshot
  );
}

export const ghostarchiveProvider: AutomaticArchiveProvider = {
  id: "ghostarchive",
  displayName: "Ghostarchive",
  shortDescription: "Video & page archiving",
  kind: "automatic",
  purpose: "automatic-snapshot",
  isRelevant: () => true,
  lookup,
  buildDirectLinkUrl(originalUrl: string): string {
    const params = new URLSearchParams({ term: originalUrl });
    return `https://ghostarchive.org/search?${params.toString()}`;
  }
};
