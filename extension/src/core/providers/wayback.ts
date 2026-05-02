import { z } from "../../lib/mini-zod";
import { WAYBACK_CDX_ENDPOINT } from "../constants";
import type { ProviderHostSettings, WaybackHost } from "../providerHosts";
import { buildWaybackBaseUrl } from "../providerHosts";
import type { SearchCandidate } from "../urlPolicy";
import type { ArchiveCheckStrategy, ArchiveSnapshot } from "../tabState";
import type { AutomaticArchiveProvider } from "./types";
import { selectLatestWorkingSnapshot } from "./snapshotValidation";

const CdxRowObjectSchema = z.object({
  urlkey: z.string().optional(),
  timestamp: z.string(),
  original: z.string(),
  mimetype: z.string(),
  statuscode: z.string(),
  digest: z.string().optional(),
  length: z.string().optional()
});

const CdxRowArraySchema = z
  .tuple([
    z.string(),
    z.string(),
    z.string(),
    z.string(),
    z.string().optional(),
    z.string().optional()
  ])
  .transform(([timestamp, original, mimetype, statuscode, digest, length]) => ({
    timestamp,
    original,
    mimetype,
    statuscode,
    digest,
    length
  }));

const CdxRowSchema = z.union([CdxRowObjectSchema, CdxRowArraySchema]);
const CdxResponseSchema = z.array(CdxRowSchema);

function resolveWaybackHost(hostSettings?: ProviderHostSettings): WaybackHost {
  return hostSettings?.waybackHost ?? "web.archive.org";
}

export function buildWaybackViewerUrl(
  timestamp: string,
  originalUrl: string,
  hostSettings?: ProviderHostSettings
): string {
  return `${buildWaybackBaseUrl(resolveWaybackHost(hostSettings))}/web/${timestamp}/${originalUrl}`;
}

export function buildWaybackReplayUrl(
  timestamp: string,
  originalUrl: string,
  hostSettings?: ProviderHostSettings
): string {
  return `${buildWaybackBaseUrl(resolveWaybackHost(hostSettings))}/web/${timestamp}id_/${originalUrl}`;
}

export function buildCdxUrl(targetUrl: string, hostSettings?: ProviderHostSettings): string {
  const params = new URLSearchParams({
    url: targetUrl,
    output: "json",
    fl: "timestamp,original,mimetype,statuscode,digest,length",
    collapse: "digest",
    limit: "-20",
    from: "1996",
    fastLatest: "true"
  });

  params.append("filter", "statuscode:200");
  params.append("filter", "mimetype:text/html.*");

  return `${buildWaybackBaseUrl(resolveWaybackHost(hostSettings))}${WAYBACK_CDX_ENDPOINT.replace("https://web.archive.org", "")}?${params.toString()}`;
}

export function buildCaptureCountCdxUrl(targetUrl: string, hostSettings?: ProviderHostSettings): string {
  const params = new URLSearchParams({
    url: targetUrl,
    output: "json",
    fl: "timestamp",
    collapse: "digest",
    from: "1996"
  });

  params.append("filter", "statuscode:200");
  params.append("filter", "mimetype:text/html.*");

  return `${buildWaybackBaseUrl(resolveWaybackHost(hostSettings))}${WAYBACK_CDX_ENDPOINT.replace("https://web.archive.org", "")}?${params.toString()}`;
}

export function parseCdxResponse(
  value: unknown,
  strategy: ArchiveCheckStrategy,
  hostSettings?: ProviderHostSettings
): ArchiveSnapshot[] {
  const parsed = CdxResponseSchema.parse(value);

  return parsed
    .filter((row) => row.statuscode === "200" && row.mimetype.toLowerCase().includes("html"))
    .map((row) => ({
      originalUrl: row.original,
      matchedUrl: row.original,
      archiveUrl: buildWaybackReplayUrl(row.timestamp, row.original, hostSettings),
      openUrl: buildWaybackViewerUrl(row.timestamp, row.original, hostSettings),
      timestamp: row.timestamp,
      statusCode: row.statuscode,
      mimeType: row.mimetype,
      strategy,
      providerId: "wayback" as const
    }));
}

export function selectLatestSnapshot(snapshots: ArchiveSnapshot[]): ArchiveSnapshot | null {
  if (snapshots.length === 0) return null;
  return [...snapshots].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] ?? null;
}

export function parseCaptureCountResponse(value: unknown): number {
  const rows = z.array(z.array(z.string())).parse(value);
  if (rows.length <= 1) return 0;
  return rows.length - 1;
}

async function lookup(
  candidate: SearchCandidate,
  fetchImpl: typeof fetch,
  hostSettings?: ProviderHostSettings
): Promise<ArchiveSnapshot | null> {
  const response = await fetchImpl(buildCdxUrl(candidate.url, hostSettings), {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Wayback CDX returned ${response.status}`);
  }

  const payload = (await response.json()) as unknown;

  if (!Array.isArray(payload) || payload.length <= 1) {
    return null;
  }

  const [, ...rows] = payload;
  return selectLatestWorkingSnapshot(parseCdxResponse(rows, candidate.strategy, hostSettings), fetchImpl);
}

export async function lookupCaptureCount(
  candidate: SearchCandidate,
  fetchImpl: typeof fetch,
  hostSettings?: ProviderHostSettings
): Promise<number> {
  const response = await fetchImpl(buildCaptureCountCdxUrl(candidate.url, hostSettings), {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Wayback CDX returned ${response.status}`);
  }

  return parseCaptureCountResponse((await response.json()) as unknown);
}

export const waybackProvider: AutomaticArchiveProvider & {
  lookupCaptureCount(candidate: SearchCandidate, fetchImpl: typeof fetch): Promise<number>;
} = {
  id: "wayback",
  displayName: "Wayback Machine",
  shortDescription: "Billions of pages",
  kind: "automatic",
  purpose: "automatic-snapshot",
  isRelevant: () => true,
  lookup,
  lookupCaptureCount,
  buildDirectLinkUrl(originalUrl: string, hostSettings?: ProviderHostSettings): string {
    return `${buildWaybackBaseUrl(resolveWaybackHost(hostSettings))}/web/*/${originalUrl}`;
  }
};
