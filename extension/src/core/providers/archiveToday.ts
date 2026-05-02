import type { ArchiveTodayHost, ProviderHostSettings } from "../providerHosts";
import { buildArchiveTodayBaseUrl } from "../providerHosts";
import type { SearchCandidate } from "../urlPolicy";
import type { ArchiveSnapshot } from "../tabState";
import type { AutomaticArchiveProvider } from "./types";
import { selectLatestWorkingSnapshot } from "./snapshotValidation";
import { timestampFromDate } from "./common";

function resolveArchiveTodayHost(hostSettings?: ProviderHostSettings): ArchiveTodayHost {
  return hostSettings?.archiveTodayHost ?? "archive.ph";
}

type ParsedMemento = {
  url: string;
  datetime: Date;
};

export function parseArchiveTodayTimemap(linkFormat: string): ParsedMemento[] {
  const entries = linkFormat.split(/,\s*(?=<)/g);
  const mementos: ParsedMemento[] = [];

  for (const entry of entries) {
    const urlMatch = entry.match(/<([^>]+)>/);
    if (!urlMatch) continue;
    const relMatch = entry.match(/rel="([^"]+)"/);
    if (!relMatch || !/\bmemento\b/.test(relMatch[1])) continue;
    const dtMatch = entry.match(/datetime="([^"]+)"/);
    if (!dtMatch) continue;
    const date = new Date(dtMatch[1]);
    if (Number.isNaN(date.getTime())) continue;

    mementos.push({ url: urlMatch[1], datetime: date });
  }

  return mementos.sort((a, b) => b.datetime.getTime() - a.datetime.getTime());
}

async function lookup(
  candidate: SearchCandidate,
  fetchImpl: typeof fetch,
  hostSettings?: ProviderHostSettings
): Promise<ArchiveSnapshot | null> {
  const url = `${buildArchiveTodayBaseUrl(resolveArchiveTodayHost(hostSettings))}/timemap/${candidate.url}`;
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { Accept: "application/link-format" }
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Archive.today timemap returned ${response.status}`);
  }

  const body = await response.text();
  const mementos = parseArchiveTodayTimemap(body);
  return selectLatestWorkingSnapshot(
    mementos.map((memento) => ({
      originalUrl: candidate.url,
      matchedUrl: candidate.url,
      archiveUrl: memento.url,
      timestamp: timestampFromDate(memento.datetime),
      statusCode: "200",
      mimeType: "text/html",
      strategy: candidate.strategy,
      providerId: "archive-today" as const
    })),
    fetchImpl,
    10
  );
}

export const archiveTodayProvider: AutomaticArchiveProvider = {
  id: "archive-today",
  displayName: "Archive.today",
  shortDescription: "Page snapshots since 2012",
  kind: "automatic",
  purpose: "automatic-snapshot",
  isRelevant: () => true,
  lookup,
  buildDirectLinkUrl(originalUrl: string, hostSettings?: ProviderHostSettings): string {
    return `${buildArchiveTodayBaseUrl(resolveArchiveTodayHost(hostSettings))}/newest/${originalUrl}`;
  }
};
