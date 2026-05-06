import type { SearchCandidate } from "../urlPolicy";
import type { ArchiveSnapshotCandidate } from "../tabState";
import type { ArchiveProviderLookupResult, AutomaticArchiveProvider } from "./types";
import { absoluteUrl } from "./common";
import { selectLatestWorkingSnapshot } from "./snapshotValidation";

type WebGyotakuResult = {
  archiveUrl: string;
  timestamp: string;
};

export function parseWebGyotakuCaptureList(html: string): WebGyotakuResult[] {
  const capturePattern =
    /href="((?:https:\/\/megalodon\.jp)?\/(\d{4}-\d{4}-\d{4}-\d{2})\/https?:\/\/[^"]+)"/g;
  let match: RegExpExecArray | null;
  const captures: WebGyotakuResult[] = [];

  while ((match = capturePattern.exec(html)) !== null) {
    const [, path, timestampWithDashes] = match;
    const timestamp = timestampWithDashes.replaceAll("-", "");
    captures.push({
      archiveUrl: absoluteUrl("https://megalodon.jp", path),
      timestamp
    });
  }

  return captures.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function parseWebGyotakuResults(html: string): WebGyotakuResult | null {
  return parseWebGyotakuCaptureList(html)[0] ?? null;
}

async function lookup(
  candidate: SearchCandidate,
  fetchImpl: typeof fetch,
  _hostSettings?: never,
  onProgress?: (phase: "querying" | "verifying") => void
): Promise<ArchiveProviderLookupResult> {
  const params = new URLSearchParams({ url: candidate.url });
  const response = await fetchImpl(`https://megalodon.jp/?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "text/html" }
  });

  if (response.status === 404) return { status: "miss" };
  if (!response.ok) {
    throw new Error(`Megalodon/Web Gyotaku returned ${response.status}`);
  }

  const html = await response.text();
  const snapshots: ArchiveSnapshotCandidate[] = parseWebGyotakuCaptureList(html).map((capture) => ({
      originalUrl: candidate.url,
      matchedUrl: candidate.url,
      archiveUrl: capture.archiveUrl,
      timestamp: capture.timestamp,
      statusCode: "200",
      mimeType: "text/html",
      strategy: candidate.strategy,
      providerId: "web-gyotaku" as const
    }));

  return selectLatestWorkingSnapshot(snapshots, fetchImpl, 10, onProgress ? () => onProgress("verifying") : undefined);
}

export const webGyotakuProvider: AutomaticArchiveProvider = {
  id: "web-gyotaku",
  displayName: "Megalodon/Web Gyotaku",
  shortDescription: "Japanese web snapshots",
  kind: "automatic",
  purpose: "automatic-snapshot",
  isRelevant: () => true,
  lookup,
  buildDirectLinkUrl(originalUrl: string): string {
    const params = new URLSearchParams({ url: originalUrl });
    return `https://megalodon.jp/?${params.toString()}`;
  }
};
