import type { SearchCandidate } from "../urlPolicy";
import type { ArchiveSnapshot, ArchiveSnapshotCandidate } from "../tabState";
import { ProviderLookupError } from "./types";
import type { ArchiveProviderLookupResult, AutomaticArchiveProvider } from "./types";
import { absoluteUrl } from "./common";
import { selectLatestWorkingSnapshot } from "./snapshotValidation";

type LocCapture = {
  archiveUrl: string;
  timestamp: string;
};

export function parseLocTimelineCaptures(html: string): LocCapture[] {
  const capturePattern = /href="([^"]*\/all\/(\d{14})\/https?:\/\/[^"]+)"/g;
  let match: RegExpExecArray | null;
  const captures: LocCapture[] = [];

  while ((match = capturePattern.exec(html)) !== null) {
    const [, path, timestamp] = match;
    captures.push({
      archiveUrl: absoluteUrl("https://webarchive.loc.gov", path),
      timestamp
    });
  }

  return captures.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function parseLocTimeline(html: string): LocCapture | null {
  return parseLocTimelineCaptures(html)[0] ?? null;
}

async function lookup(
  candidate: SearchCandidate,
  fetchImpl: typeof fetch,
  _hostSettings?: never,
  onProgress?: (phase: "querying" | "verifying") => void,
  onSnapshot?: (snapshot: ArchiveSnapshot) => void
): Promise<ArchiveProviderLookupResult> {
  const timelineUrl = `https://webarchive.loc.gov/all/*/${candidate.url}`;
  const response = await fetchImpl(timelineUrl, {
    method: "GET",
    headers: { Accept: "text/html" }
  });

  if (response.status === 404) return { status: "miss" };
  if (!response.ok) {
    if (response.status === 429) throw new ProviderLookupError("Library of Congress Web Archives rate-limited this request", "rate-limited");
    if (response.status >= 500) throw new ProviderLookupError(`Library of Congress Web Archives returned ${response.status}`, "server-error");
    throw new ProviderLookupError(`Library of Congress Web Archives returned ${response.status}`);
  }

  const html = await response.text();
  const snapshots: ArchiveSnapshotCandidate[] = parseLocTimelineCaptures(html).map((capture) => ({
      originalUrl: candidate.url,
      matchedUrl: candidate.url,
      archiveUrl: capture.archiveUrl,
      timestamp: capture.timestamp,
      statusCode: "200",
      mimeType: "text/html",
      strategy: candidate.strategy,
      providerId: "loc-web-archives" as const
    }));

  return selectLatestWorkingSnapshot(
    snapshots,
    fetchImpl,
    10,
    onProgress ? () => onProgress("verifying") : undefined,
    onSnapshot
  );
}

export const locWebArchivesProvider: AutomaticArchiveProvider = {
  id: "loc-web-archives",
  displayName: "Library of Congress Web Archives",
  shortDescription: "US federal government pages",
  kind: "automatic",
  purpose: "automatic-snapshot",
  isRelevant: (context) => context.isUsGov,
  lookup,
  buildDirectLinkUrl(originalUrl: string): string {
    return `https://webarchive.loc.gov/all/*/${originalUrl}`;
  }
};
