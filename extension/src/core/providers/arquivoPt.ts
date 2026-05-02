import { z } from "zod";
import type { SearchCandidate } from "../urlPolicy";
import type { ArchiveSnapshot } from "../tabState";
import type { AutomaticArchiveProvider } from "./types";
import { selectLatestWorkingSnapshot } from "./snapshotValidation";

const ArquivoPtItemSchema = z.object({
  tstamp: z.string().optional(),
  linkToArchive: z.string().optional(),
  linkToNoFrame: z.string().optional(),
  originalURL: z.string().optional(),
  url: z.string().optional()
});

const ArquivoPtResponseSchema = z.object({
  items: z.array(ArquivoPtItemSchema).optional()
});

type ArquivoPtResult = {
  archiveUrl: string;
  originalUrl: string;
  timestamp: string;
};

export function buildArquivoPtUrlSearchUrl(targetUrl: string): string {
  const params = new URLSearchParams({
    query: `closestdate:19960101000000+exacturlexpand:${targetUrl}`,
    hitsPerSite: "10000",
    waybackQuery: "true",
    start: "0",
    hitsPerPage: "10"
  });

  return `https://arquivo.pt/opensearch?${params.toString()}`;
}

export function pickArquivoPtLatest(value: unknown): ArquivoPtResult | null {
  const parsed = ArquivoPtResponseSchema.safeParse(value);
  if (!parsed.success || !parsed.data.items?.length) return null;

  const candidates: ArquivoPtResult[] = [];

  for (const item of parsed.data.items) {
    const archiveUrl = item.linkToNoFrame ?? item.linkToArchive;
    const originalUrl = item.originalURL ?? item.url;
    const timestamp = item.tstamp;
    if (!archiveUrl || !originalUrl || !timestamp) continue;

    candidates.push({ archiveUrl, originalUrl, timestamp });
  }

  return candidates.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] ?? null;
}

async function lookup(
  candidate: SearchCandidate,
  fetchImpl: typeof fetch
): Promise<ArchiveSnapshot | null> {
  const response = await fetchImpl(buildArquivoPtUrlSearchUrl(candidate.url), {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Arquivo.pt returned ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = ArquivoPtResponseSchema.safeParse(json);
  if (!parsed.success || !parsed.data.items?.length) return null;

  const snapshots: ArchiveSnapshot[] = [];
  for (const item of parsed.data.items) {
    const archiveUrl = item.linkToNoFrame ?? item.linkToArchive;
    const originalUrl = item.originalURL ?? item.url;
    const timestamp = item.tstamp;
    if (!archiveUrl || !originalUrl || !timestamp) continue;

    snapshots.push({
      originalUrl: candidate.url,
      matchedUrl: originalUrl,
      archiveUrl,
      timestamp,
      statusCode: "200",
      mimeType: "text/html",
      strategy: candidate.strategy,
      providerId: "arquivo-pt"
    });
  }

  return selectLatestWorkingSnapshot(snapshots, fetchImpl, 10);
}

export const arquivoPtProvider: AutomaticArchiveProvider = {
  id: "arquivo-pt",
  displayName: "Arquivo.pt",
  shortDescription: "Portuguese web archive",
  kind: "automatic",
  purpose: "automatic-snapshot",
  isRelevant: () => true,
  lookup,
  buildDirectLinkUrl(originalUrl: string): string {
    const params = new URLSearchParams({ q: originalUrl, l: "en" });
    return `https://arquivo.pt/page/search?${params.toString()}`;
  }
};
