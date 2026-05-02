import type { SearchCandidate } from "../urlPolicy";
import type { ArchiveSnapshot } from "../tabState";
import type { AutomaticArchiveProvider } from "./types";
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
  fetchImpl: typeof fetch
): Promise<ArchiveSnapshot | null> {
  const timelineUrl = `https://webarchive.loc.gov/all/*/${candidate.url}`;
  const response = await fetchImpl(timelineUrl, {
    method: "GET",
    headers: { Accept: "text/html" }
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Library of Congress Web Archives returned ${response.status}`);
  }

  const html = await response.text();
  return selectLatestWorkingSnapshot(
    parseLocTimelineCaptures(html).map((capture) => ({
      originalUrl: candidate.url,
      matchedUrl: candidate.url,
      archiveUrl: capture.archiveUrl,
      timestamp: capture.timestamp,
      statusCode: "200",
      mimeType: "text/html",
      strategy: candidate.strategy,
      providerId: "loc-web-archives" as const
    })),
    fetchImpl,
    10
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
