import type { SearchCandidate } from "../urlPolicy";
import type { ArchiveSnapshot, ArchiveSnapshotCandidate } from "../tabState";
import { formatRetryAfterDetail, parseRetryAfterMs } from "./common";
import { selectLatestWorkingSnapshot } from "./snapshotValidation";
import { ProviderLookupError } from "./types";
import type { ArchiveProviderLookupResult, ProviderId } from "./types";

export type PywbCdxCapture = {
  timestamp: string;
  originalUrl: string;
  statusCode?: string;
  mimeType?: string;
};

type PywbCdxProviderConfig = {
  providerId: ProviderId;
  providerName: string;
  cdxBaseUrl: string;
  replayBaseUrl: string;
  filterCapture?: (capture: PywbCdxCapture) => boolean;
};

type RawPywbCdxCapture = {
  timestamp?: unknown;
  url?: unknown;
  status?: unknown;
  mime?: unknown;
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function buildPywbCdxQueryUrl(baseUrl: string, targetUrl: string): string {
  const params = new URLSearchParams({
    url: targetUrl,
    output: "json"
  });

  return `${trimTrailingSlash(baseUrl)}/cdx?${params.toString()}`;
}

export function buildPywbReplayUrl(baseUrl: string, timestamp: string, originalUrl: string): string {
  return `${trimTrailingSlash(baseUrl)}/${timestamp}/${originalUrl}`;
}

function parseRawPywbCdxCapture(value: unknown): PywbCdxCapture | null {
  if (!value || typeof value !== "object") return null;

  const {
    timestamp,
    url,
    status,
    mime
  } = value as RawPywbCdxCapture;

  if (typeof timestamp !== "string" || !/^\d{14}$/.test(timestamp)) return null;
  if (typeof url !== "string" || url.length === 0) return null;

  return {
    timestamp,
    originalUrl: url,
    statusCode: typeof status === "string" ? status : undefined,
    mimeType: typeof mime === "string" ? mime : undefined
  };
}

export function parsePywbCdxResponse(payload: string): PywbCdxCapture[] {
  const trimmed = payload.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.flatMap((item) => {
        const capture = parseRawPywbCdxCapture(item);
        return capture ? [capture] : [];
      });
    } catch {
      return [];
    }
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const capture = parseRawPywbCdxCapture(JSON.parse(line) as unknown);
        return capture ? [capture] : [];
      } catch {
        return [];
      }
    });
}

export async function lookupLatestPywbCdxCapture(
  config: PywbCdxProviderConfig,
  candidate: SearchCandidate,
  fetchImpl: typeof fetch,
  onProgress?: (phase: "querying" | "verifying") => void,
  onSnapshot?: (snapshot: ArchiveSnapshot) => void
): Promise<ArchiveProviderLookupResult> {
  onProgress?.("querying");

  const response = await fetchImpl(buildPywbCdxQueryUrl(config.cdxBaseUrl, candidate.url), {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (response.status === 404) return { status: "miss" };
  if (!response.ok) {
    if (response.status === 429) {
      const retryAfterMs = parseRetryAfterMs(response.headers?.get?.("retry-after"));
      throw new ProviderLookupError(
        `${config.providerName} rate-limited this request`,
        "rate-limited",
        retryAfterMs,
        formatRetryAfterDetail(retryAfterMs) ?? "429 during query"
      );
    }
    if (response.status >= 500) {
      throw new ProviderLookupError(`${config.providerName} returned ${response.status}`, "server-error");
    }
    throw new ProviderLookupError(`${config.providerName} returned ${response.status}`);
  }

  const captures = parsePywbCdxResponse(await response.text()).filter((capture) =>
    config.filterCapture ? config.filterCapture(capture) : true
  );
  if (!captures.length) return { status: "miss" };

  const snapshots: ArchiveSnapshotCandidate[] = captures.map((capture) => ({
    originalUrl: candidate.url,
    matchedUrl: capture.originalUrl,
    archiveUrl: buildPywbReplayUrl(config.replayBaseUrl, capture.timestamp, capture.originalUrl),
    timestamp: capture.timestamp,
    statusCode: capture.statusCode ?? "200",
    mimeType: capture.mimeType ?? "text/html",
    strategy: candidate.strategy,
    providerId: config.providerId
  }));

  return selectLatestWorkingSnapshot(
    snapshots,
    fetchImpl,
    10,
    onProgress ? () => onProgress("verifying") : undefined,
    onSnapshot
  );
}
