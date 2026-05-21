import type { ArchiveSnapshot, ArchiveSnapshotCandidate } from "../tabState";
import type { ArchiveProviderLookupResult } from "./types";

const INVALID_TITLE_PATTERNS = [/^one more step$/i, /^404 not found$/i, /^page not found$/i];

const INVALID_BODY_PATTERNS = [
  /wayback machine doesn't have that page archived/i,
  /got an http \d{3} response at crawl time/i,
  /please complete the security check to access/i,
  /this page requires a captcha/i,
  /<h2>\s*no archives\s*<\/h2>/i
];

export function isLikelyWorkingSnapshotHtml(html: string): boolean {
  if (/<meta[^>]+http-equiv=["']refresh["'][^>]+url=/i.test(html)) {
    return false;
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  if (INVALID_TITLE_PATTERNS.some((pattern) => pattern.test(title))) {
    return false;
  }

  return !INVALID_BODY_PATTERNS.some((pattern) => pattern.test(html));
}

function normalizeArchiveUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    return url.toString();
  } catch {
    return rawUrl;
  }
}

async function isWorkingSnapshot(
  snapshot: ArchiveSnapshotCandidate,
  fetchImpl: typeof fetch
): Promise<boolean> {
  try {
    const response = await fetchImpl(snapshot.archiveUrl, {
      method: "GET",
      headers: { Accept: "text/html,application/xhtml+xml" },
      redirect: "follow"
    });

    if (!response.ok) return false;

    if (response.redirected) {
      const finalUrl = typeof response.url === "string" ? response.url : "";
      if (finalUrl && normalizeArchiveUrl(finalUrl) !== normalizeArchiveUrl(snapshot.archiveUrl)) {
        return false;
      }
    }

    const contentType = response.headers?.get?.("content-type")?.toLowerCase() ?? "";
    if (contentType && !contentType.includes("html")) {
      return false;
    }

    const html = await response.text();
    return isLikelyWorkingSnapshotHtml(html);
  } catch {
    return false;
  }
}

export async function selectLatestWorkingSnapshot(
  snapshots: ArchiveSnapshotCandidate[],
  fetchImpl: typeof fetch,
  maxCandidates = snapshots.length,
  onProgress?: (phase: "verifying") => void,
  onSnapshot?: (snapshot: ArchiveSnapshot) => void
): Promise<ArchiveProviderLookupResult> {
  const ordered = [...snapshots]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, Math.max(0, maxCandidates));

  if (ordered.length === 0) {
    return { status: "miss" };
  }

  onSnapshot?.({
    ...ordered[0],
    verification: "unverified"
  });

  for (const snapshot of ordered) {
    onProgress?.("verifying");
    if (await isWorkingSnapshot(snapshot, fetchImpl)) {
      return {
        status: "confirmed",
        snapshot: {
          ...snapshot,
          verification: "confirmed"
        }
      };
    }
  }

  return {
    status: "unverified",
    snapshot: {
      ...ordered[0],
      verification: "unverified"
    }
  };
}
