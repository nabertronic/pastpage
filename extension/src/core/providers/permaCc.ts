import { z } from "zod";
import type { SearchCandidate } from "../urlPolicy";
import type { ArchiveSnapshot } from "../tabState";
import type { AutomaticArchiveProvider } from "./types";
import { normalizeComparableUrl, timestampFromIso } from "./common";
import { selectLatestWorkingSnapshot } from "./snapshotValidation";

export const PERMA_CC_API = "https://api.perma.cc/v1/public/archives";

const PermaArchiveSchema = z.object({
  guid: z.string(),
  creation_timestamp: z.string().optional(),
  url: z.string().optional()
});

const PermaResponseSchema = z.object({
  objects: z.array(PermaArchiveSchema)
});

export function buildPermaCcUrl(targetUrl: string): string {
  const params = new URLSearchParams({ url: targetUrl, limit: "10" });
  return `${PERMA_CC_API}/?${params.toString()}`;
}

async function lookup(
  candidate: SearchCandidate,
  fetchImpl: typeof fetch
): Promise<ArchiveSnapshot | null> {
  const response = await fetchImpl(buildPermaCcUrl(candidate.url), {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Perma.cc returned ${response.status}`);
  }

  const json = await response.json();
  const parsed = PermaResponseSchema.safeParse(json);
  if (!parsed.success || parsed.data.objects.length === 0) return null;

  const requestedNorm = normalizeComparableUrl(candidate.url);
  const matching = parsed.data.objects.filter(
    (obj) => obj.url && normalizeComparableUrl(obj.url) === requestedNorm
  );
  if (matching.length === 0) return null;

  return selectLatestWorkingSnapshot(
    matching.map((entry) => ({
      originalUrl: candidate.url,
      matchedUrl: entry.url ?? candidate.url,
      archiveUrl: `https://perma.cc/${entry.guid}`,
      timestamp: timestampFromIso(entry.creation_timestamp),
      statusCode: "200",
      mimeType: "text/html",
      strategy: candidate.strategy,
      providerId: "perma-cc" as const
    })),
    fetchImpl,
    10
  );
}

export const permaCcProvider: AutomaticArchiveProvider = {
  id: "perma-cc",
  displayName: "Perma.cc",
  shortDescription: "Legal citation snapshots",
  kind: "automatic",
  purpose: "automatic-snapshot",
  isRelevant: () => true,
  lookup,
  buildDirectLinkUrl(): string | null {
    return null;
  }
};
