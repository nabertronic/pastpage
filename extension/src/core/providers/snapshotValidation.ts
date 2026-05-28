import type { ArchiveSnapshot, ArchiveSnapshotCandidate } from "../tabState";
import type { ArchiveProviderLookupResult } from "./types";
import { replayFetch } from "./common";
import type { ProviderId } from "./types";

const INVALID_TITLE_PATTERNS = [
  /^one more step$/i,
  /^404 not found$/i,
  /^page not found$/i,
  /^archive\.(?:ph|md|is|today|vn|fo|li)$/i
];

const INVALID_BODY_PATTERNS = [
  /wayback machine doesn't have that page archived/i,
  /got an http \d{3} response at crawl time/i,
  /please complete the security check to access/i,
  /this page requires a captcha/i,
  /<h2>\s*no archives\s*<\/h2>/i,
  /verify you are human/i,
  /please wait while we verify that you are not a robot/i,
  /challenge-platform/i,
  /why do i have to complete a captcha/i,
  /too many requests/i,
  /rate limited/i
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

type ReplayIssue = {
  verificationNote: string;
  technicalDetail?: string;
};

type ReplayValidationResult =
  | { status: "confirmed" }
  | { status: "failed"; issue: ReplayIssue };

type ReplayValidationMode = "head" | "html";

type ReplayValidationStrategy = {
  mode: ReplayValidationMode;
  maxCandidates?: number;
};

const PROVIDER_REPLAY_STRATEGIES: Record<ProviderId, ReplayValidationStrategy> = {
  wayback: { mode: "html", maxCandidates: 5 },
  "archive-today": { mode: "html", maxCandidates: 3 },
  ghostarchive: { mode: "html", maxCandidates: 3 },
  "yandex-cache": { mode: "html", maxCandidates: 1 },
  "uk-gov-web-archive": { mode: "head", maxCandidates: 2 },
  "loc-web-archives": { mode: "head", maxCandidates: 2 },
  "perma-cc": { mode: "head", maxCandidates: 2 },
  "arquivo-pt": { mode: "head", maxCandidates: 2 },
  "web-gyotaku": { mode: "head", maxCandidates: 2 },
  webcite: { mode: "html", maxCandidates: 1 },
  "software-heritage": { mode: "head", maxCandidates: 1 }
};

function normalizeArchiveUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function isEquivalentArchiveReplayRedirect(expectedUrl: string, actualUrl: string): boolean {
  try {
    const expected = new URL(expectedUrl);
    const actual = new URL(actualUrl);

    if (expected.hostname.toLowerCase() !== actual.hostname.toLowerCase()) {
      return false;
    }

    if (expected.pathname !== actual.pathname) {
      return false;
    }

    if (expected.search !== actual.search) {
      return false;
    }

    if (
      expected.protocol !== actual.protocol &&
      !(expected.protocol === "http:" && actual.protocol === "https:")
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function isWorkingSnapshot(
  snapshot: ArchiveSnapshotCandidate,
  fetchImpl: typeof fetch
): Promise<ReplayValidationResult> {
  const strategy = PROVIDER_REPLAY_STRATEGIES[snapshot.providerId] ?? { mode: "html" };

  try {
    const response = await replayFetch(fetchImpl)(snapshot.archiveUrl, {
      method: strategy.mode === "head" ? "HEAD" : "GET",
      headers: { Accept: "text/html,application/xhtml+xml" },
      redirect: "follow"
    });

    if (!response.ok) {
      return {
        status: "failed",
        issue: replayIssueFromStatus(response.status, strategy.mode)
      };
    }

    if (response.redirected) {
      const finalUrl = typeof response.url === "string" ? response.url : "";
      if (
        finalUrl &&
        normalizeArchiveUrl(finalUrl) !== normalizeArchiveUrl(snapshot.archiveUrl) &&
        !isEquivalentArchiveReplayRedirect(snapshot.archiveUrl, finalUrl)
      ) {
        return {
          status: "failed",
          issue: {
            verificationNote: "Replay redirected to a different archive resource.",
            technicalDetail: "redirect mismatch"
          }
        };
      }
    }

    const contentType = response.headers?.get?.("content-type")?.toLowerCase() ?? "";
    if (contentType && !contentType.includes("html")) {
      return {
        status: "failed",
        issue: {
          verificationNote: "Replay returned a non-HTML response.",
          technicalDetail: `content-type ${contentType}`
        }
      };
    }

    if (strategy.mode === "head") {
      return { status: "confirmed" };
    }

    const html = await response.text();
    if (isLikelyWorkingSnapshotHtml(html)) {
      return { status: "confirmed" };
    }

    return {
      status: "failed",
      issue: replayIssueFromHtml(html)
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        status: "failed",
        issue: {
          verificationNote: "Replay validation timed out before the archived page could be confirmed.",
          technicalDetail: "replay timeout"
        }
      };
    }

    return {
      status: "failed",
      issue: {
        verificationNote: "Replay validation could not complete because the archived page request failed.",
        technicalDetail: "replay request failed"
      }
    };
  }
}

function replayIssueFromStatus(status: number, mode: ReplayValidationMode): ReplayIssue {
  if (status === 429) {
    return {
      verificationNote: `Replay validation hit a rate limit while checking the archived ${mode === "head" ? "resource" : "page"}.`,
      technicalDetail: "429 during replay"
    };
  }

  if (status >= 500) {
    return {
      verificationNote: "Replay validation hit a server error while checking the archived page.",
      technicalDetail: `${status} during replay`
    };
  }

  return {
    verificationNote: "Replay validation could not confirm that the archived page opens correctly.",
    technicalDetail: `${status} during replay`
  };
}

function replayIssueFromHtml(html: string): ReplayIssue {
  if (/too many requests|rate limited/i.test(html)) {
    return {
      verificationNote: "Replay validation reached a rate-limit page instead of the archived content.",
      technicalDetail: "429 during replay"
    };
  }

  if (/captcha|recaptcha|verify you are human|security check|challenge-platform/i.test(html)) {
    return {
      verificationNote: "Replay validation reached a challenge page instead of the archived content.",
      technicalDetail: "challenge page during replay"
    };
  }

  return {
    verificationNote: "Replay validation reached an HTML page, but it did not look like a working archived snapshot.",
    technicalDetail: "invalid archived HTML"
  };
}

export async function selectLatestWorkingSnapshot(
  snapshots: ArchiveSnapshotCandidate[],
  fetchImpl: typeof fetch,
  maxCandidates = snapshots.length,
  onProgress?: (phase: "verifying") => void,
  onSnapshot?: (snapshot: ArchiveSnapshot) => void
): Promise<ArchiveProviderLookupResult> {
  const strategy = PROVIDER_REPLAY_STRATEGIES[snapshots[0]?.providerId ?? "archive-today"] ?? {
    mode: "html"
  };
  const ordered = [...snapshots]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, Math.max(0, Math.min(maxCandidates, strategy.maxCandidates ?? maxCandidates)));

  if (ordered.length === 0) {
    return { status: "miss" };
  }

  onSnapshot?.({
    ...ordered[0],
    verification: "unverified"
  });

  let primaryIssue: ReplayIssue | undefined;

  for (const snapshot of ordered) {
    onProgress?.("verifying");
    const validation = await isWorkingSnapshot(snapshot, fetchImpl);
    if (validation.status === "confirmed") {
      return {
        status: "confirmed",
        snapshot: {
          ...snapshot,
          verification: "confirmed"
        }
      };
    }

    if (!primaryIssue && snapshot.archiveUrl === ordered[0].archiveUrl) {
      primaryIssue = validation.issue;
    }
  }

  return {
    status: "unverified",
    snapshot: {
      ...ordered[0],
      verification: "unverified",
      verificationNote: primaryIssue?.verificationNote
    }
  };
}
