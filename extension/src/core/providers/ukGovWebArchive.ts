import type { SearchCandidate } from "../urlPolicy";
import type { ArchiveSnapshotCandidate } from "../tabState";
import type { ArchiveProviderLookupResult, AutomaticArchiveProvider } from "./types";
import { absoluteUrl } from "./common";
import { selectLatestWorkingSnapshot } from "./snapshotValidation";

type TimelineCapture = {
  archiveUrl: string;
  timestamp: string;
};

export function parseUkGovTimelineCaptures(html: string): TimelineCapture[] {
  const capturePattern = /href="([^"]*\/ukgwa\/(\d{14})\/https?:\/\/[^"]+)"/g;
  let match: RegExpExecArray | null;
  const captures: TimelineCapture[] = [];

  while ((match = capturePattern.exec(html)) !== null) {
    const [, path, timestamp] = match;
    captures.push({
      archiveUrl: absoluteUrl("https://webarchive.nationalarchives.gov.uk", path),
      timestamp
    });
  }

  return captures.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function parseUkGovTimeline(html: string): TimelineCapture | null {
  return parseUkGovTimelineCaptures(html)[0] ?? null;
}

async function lookup(
  candidate: SearchCandidate,
  fetchImpl: typeof fetch,
  _hostSettings?: never,
  onProgress?: (phase: "querying" | "verifying") => void
): Promise<ArchiveProviderLookupResult> {
  const timelineUrl = `https://webarchive.nationalarchives.gov.uk/ukgwa/*/${candidate.url}`;
  const response = await fetchImpl(timelineUrl, {
    method: "GET",
    headers: { Accept: "text/html" }
  });

  if (response.status === 404) return { status: "miss" };
  if (!response.ok) {
    throw new Error(`UK Government Web Archive returned ${response.status}`);
  }

  const html = await response.text();
  const snapshots: ArchiveSnapshotCandidate[] = parseUkGovTimelineCaptures(html).map((capture) => ({
      originalUrl: candidate.url,
      matchedUrl: candidate.url,
      archiveUrl: capture.archiveUrl,
      timestamp: capture.timestamp,
      statusCode: "200",
      mimeType: "text/html",
      strategy: candidate.strategy,
      providerId: "uk-gov-web-archive" as const
    }));

  return selectLatestWorkingSnapshot(snapshots, fetchImpl, 10, onProgress ? () => onProgress("verifying") : undefined);
}

export const ukGovWebArchiveProvider: AutomaticArchiveProvider = {
  id: "uk-gov-web-archive",
  displayName: "UK Government Web Archive",
  shortDescription: "UK public sector websites",
  kind: "automatic",
  purpose: "automatic-snapshot",
  isRelevant: (context) => context.isUkGov,
  lookup,
  buildDirectLinkUrl(originalUrl: string): string {
    return `https://webarchive.nationalarchives.gov.uk/ukgwa/*/${originalUrl}`;
  }
};
