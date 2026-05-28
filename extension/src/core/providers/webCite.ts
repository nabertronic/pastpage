import type { SearchCandidate } from "../urlPolicy";
import type { ArchiveSnapshotCandidate } from "../tabState";
import { ProviderLookupError } from "./types";
import type { ArchiveProviderLookupResult, AutomaticArchiveProvider } from "./types";
import { formatRetryAfterDetail, hasHumanChallenge, parseRetryAfterMs, replayFetch } from "./common";
import { isLikelyWorkingSnapshotHtml } from "./snapshotValidation";

type WebCiteCapture = {
  captureId: string;
  timestamp: string;
  failed: boolean;
};

type WebCiteTopFrame = {
  permalinkId: string | null;
  captures: WebCiteCapture[];
};

const WEBCITE_BASE_URL = "https://www.webcitation.org";

export function buildWebCiteQueryUrl(targetUrl: string): string {
  const params = new URLSearchParams({ url: targetUrl });
  return `${WEBCITE_BASE_URL}/query?${params.toString()}`;
}

export function buildWebCiteCaptureUrl(captureId: string): string {
  const params = new URLSearchParams({ id: captureId });
  return `${WEBCITE_BASE_URL}/query?${params.toString()}`;
}

export function buildWebCitePermalinkUrl(permalinkId: string): string {
  return `${WEBCITE_BASE_URL}/${permalinkId}`;
}

export function parseWebCiteTimestamp(value: string): string {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\s+\(failed\))?$/
  );
  if (!match) return "";

  return match.slice(1, 7).join("");
}

export function parseWebCiteTopFrame(html: string): WebCiteTopFrame {
  const permalinkMatch = html.match(/href="([^"]+)"\s+target="_top">Permalink/i);
  const permalinkId = permalinkMatch?.[1]?.trim() || null;
  const captures: WebCiteCapture[] = [];
  const optionPattern = /<option value="([^"]+)">([^<]+)<\/option>/gi;
  let match: RegExpExecArray | null;

  while ((match = optionPattern.exec(html)) !== null) {
    const [, captureId, label] = match;
    const trimmedLabel = label.trim();
    const timestamp = parseWebCiteTimestamp(trimmedLabel);
    if (!timestamp) continue;

    captures.push({
      captureId,
      timestamp,
      failed: /\(failed\)/i.test(trimmedLabel)
    });
  }

  return { permalinkId, captures };
}

function isWebCiteFramesetResponse(html: string): boolean {
  return /<frameset\b/i.test(html) && /topframe\.php/i.test(html) && /mainframe\.php/i.test(html);
}

function isWebCiteNoSnapshotResponse(html: string): boolean {
  return /we do not have any snapshots of the given url/i.test(html);
}

async function fetchWebCiteDocument(
  url: string,
  fetchImpl: typeof fetch,
  accept = "text/html,application/xhtml+xml",
  phase: "query" | "replay" = "query"
) {
  const effectiveFetch = phase === "replay" ? replayFetch(fetchImpl) : fetchImpl;
  return effectiveFetch(url, {
    method: "GET",
    credentials: "include",
    headers: { Accept: accept },
    redirect: "follow"
  });
}

async function verifyWebCiteCapture(
  captureId: string,
  fetchImpl: typeof fetch
): Promise<{ permalinkId: string | null; html: string | null }> {
  const queryResponse = await fetchWebCiteDocument(buildWebCiteCaptureUrl(captureId), fetchImpl);
  if (!queryResponse.ok) {
    throw new ProviderLookupError(`WebCite returned ${queryResponse.status} for capture ${captureId}`, queryResponse.status >= 500 ? "server-error" : undefined);
  }

  const topframeResponse = await fetchWebCiteDocument(`${WEBCITE_BASE_URL}/topframe.php`, fetchImpl);
  if (!topframeResponse.ok) {
    throw new ProviderLookupError(`WebCite topframe returned ${topframeResponse.status}`, topframeResponse.status >= 500 ? "server-error" : undefined);
  }

  const topframe = parseWebCiteTopFrame(await topframeResponse.text());
  if (topframe.captures.length === 0) {
    return { permalinkId: null, html: null };
  }

  const mainframeResponse = await fetchWebCiteDocument(
    `${WEBCITE_BASE_URL}/mainframe.php`,
    fetchImpl,
    "text/html,application/xhtml+xml",
    "replay"
  );
  if (!mainframeResponse.ok) {
    return { permalinkId: topframe.permalinkId, html: null };
  }

  const contentType = mainframeResponse.headers?.get?.("content-type")?.toLowerCase() ?? "";
  if (contentType && !contentType.includes("html")) {
    return { permalinkId: topframe.permalinkId, html: null };
  }

  const html = await mainframeResponse.text();
  return { permalinkId: topframe.permalinkId, html };
}

async function lookup(
  candidate: SearchCandidate,
  fetchImpl: typeof fetch,
  _hostSettings?: never,
  onProgress?: (phase: "querying" | "verifying") => void
): Promise<ArchiveProviderLookupResult> {
  const queryResponse = await fetchWebCiteDocument(buildWebCiteQueryUrl(candidate.url), fetchImpl);
  if (!queryResponse.ok) {
    const retryAfterMs = parseRetryAfterMs(queryResponse.headers?.get?.("retry-after"));
    throw new ProviderLookupError(
      `WebCite returned ${queryResponse.status}`,
      queryResponse.status >= 500 ? "server-error" : queryResponse.status === 429 ? "rate-limited" : undefined,
      retryAfterMs,
      queryResponse.status === 429
        ? formatRetryAfterDetail(retryAfterMs) ?? "429 during query"
        : `${queryResponse.status} during query`
    );
  }

  const queryHtml = await queryResponse.text();
  if (hasHumanChallenge(queryHtml)) {
    throw new ProviderLookupError(
      "WebCite requires a manual challenge step",
      "challenge-required",
      undefined,
      "challenge page"
    );
  }
  if (isWebCiteNoSnapshotResponse(queryHtml)) {
    return { status: "miss" };
  }
  if (!isWebCiteFramesetResponse(queryHtml)) {
    return { status: "miss" };
  }

  const topframeResponse = await fetchWebCiteDocument(`${WEBCITE_BASE_URL}/topframe.php`, fetchImpl);
  if (!topframeResponse.ok) {
    throw new ProviderLookupError(`WebCite topframe returned ${topframeResponse.status}`, topframeResponse.status >= 500 ? "server-error" : undefined);
  }

  const topframeHtml = await topframeResponse.text();
  if (hasHumanChallenge(topframeHtml)) {
    throw new ProviderLookupError(
      "WebCite requires a manual challenge step",
      "challenge-required",
      undefined,
      "challenge page"
    );
  }

  const topframe = parseWebCiteTopFrame(topframeHtml);
  const captures = topframe.captures
    .filter((capture) => !capture.failed)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (captures.length === 0) {
    return { status: "miss" };
  }

  let fallbackSnapshot: ArchiveSnapshotCandidate | null = null;

  for (const capture of captures.slice(0, 10)) {
    onProgress?.("verifying");
    const { permalinkId, html } = await verifyWebCiteCapture(capture.captureId, fetchImpl);
    const archiveUrl = buildWebCiteCaptureUrl(capture.captureId);
    const openUrl = permalinkId ? buildWebCitePermalinkUrl(permalinkId) : archiveUrl;
    const snapshot: ArchiveSnapshotCandidate = {
      originalUrl: candidate.url,
      matchedUrl: candidate.url,
      archiveUrl,
      openUrl,
      timestamp: capture.timestamp,
      statusCode: "200",
      mimeType: "text/html",
      strategy: candidate.strategy,
      providerId: "webcite" as const
    };

    fallbackSnapshot ??= snapshot;

    if (html && isLikelyWorkingSnapshotHtml(html)) {
      return {
        status: "confirmed",
        snapshot: {
          ...snapshot,
          verification: "confirmed"
        }
      };
    }
  }

  if (!fallbackSnapshot) {
    return { status: "miss" };
  }

  return {
    status: "unverified",
    snapshot: {
      ...fallbackSnapshot,
      verification: "unverified"
    }
  };
}

export const webCiteProvider: AutomaticArchiveProvider = {
  id: "webcite",
  displayName: "WebCite",
  shortDescription: "Academic citation archive",
  kind: "automatic",
  purpose: "automatic-snapshot",
  isRelevant: () => true,
  lookup,
  buildDirectLinkUrl(originalUrl: string): string {
    return buildWebCiteQueryUrl(originalUrl);
  }
};
