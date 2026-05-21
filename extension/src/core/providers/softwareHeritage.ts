import type { SearchCandidate } from "../urlPolicy";
import type { ArchiveSnapshot } from "../tabState";
import { ProviderLookupError } from "./types";
import type { ArchivePriorityContext, ArchiveProviderLookupResult, AutomaticArchiveProvider } from "./types";
import { timestampFromIso } from "./common";

type SoftwareHeritageTarget = {
  originUrl: string;
  browseUrl: string;
};

function buildOriginDirectoryUrl(originUrl: string, path?: string): string {
  const params = new URLSearchParams({ origin_url: originUrl });
  if (path) {
    params.set("path", path);
  }
  return `https://archive.softwareheritage.org/browse/origin/directory/?${params.toString()}`;
}

function buildContentUrl(originUrl: string, path: string): string {
  const params = new URLSearchParams({ origin_url: originUrl, path });
  return `https://archive.softwareheritage.org/browse/content/?${params.toString()}`;
}

function parseGithubLikeTarget(url: URL): SoftwareHeritageTarget | null {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  const [owner, repo, kind, _ref, ...rest] = parts;
  const originUrl = `${url.protocol}//${url.hostname}/${owner}/${repo}`;

  if (!kind) {
    return { originUrl, browseUrl: buildOriginDirectoryUrl(originUrl) };
  }

  if (kind === "blob" || kind === "raw") {
    const path = rest.join("/");
    return path ? { originUrl, browseUrl: buildContentUrl(originUrl, path) } : null;
  }

  if (kind === "tree") {
    const path = rest.join("/");
    return { originUrl, browseUrl: buildOriginDirectoryUrl(originUrl, path || undefined) };
  }

  return null;
}

function parseGitlabTarget(url: URL): SoftwareHeritageTarget | null {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  const dashIndex = parts.indexOf("-");
  if (dashIndex === -1) {
    const originUrl = `${url.protocol}//${url.hostname}/${parts[0]}/${parts[1]}`;
    return { originUrl, browseUrl: buildOriginDirectoryUrl(originUrl) };
  }

  if (dashIndex < 2 || parts.length <= dashIndex + 1) return null;

  const originParts = parts.slice(0, dashIndex);
  const originUrl = `${url.protocol}//${url.hostname}/${originParts.join("/")}`;
  const kind = parts[dashIndex + 1];
  const path = parts.slice(dashIndex + 3).join("/");

  if (kind === "blob" || kind === "raw") {
    return path ? { originUrl, browseUrl: buildContentUrl(originUrl, path) } : null;
  }

  if (kind === "tree") {
    return { originUrl, browseUrl: buildOriginDirectoryUrl(originUrl, path || undefined) };
  }

  return null;
}

function parseBitbucketTarget(url: URL): SoftwareHeritageTarget | null {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  const [owner, repo, kind, _ref, ...rest] = parts;
  const originUrl = `${url.protocol}//${url.hostname}/${owner}/${repo}`;

  if (!kind) {
    return { originUrl, browseUrl: buildOriginDirectoryUrl(originUrl) };
  }

  if (kind === "src") {
    const path = rest.join("/");
    return path
      ? { originUrl, browseUrl: buildContentUrl(originUrl, path) }
      : { originUrl, browseUrl: buildOriginDirectoryUrl(originUrl) };
  }

  return null;
}

function parseSourcehutTarget(url: URL): SoftwareHeritageTarget | null {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  if (!parts[0].startsWith("~")) return null;

  const originUrl = `${url.protocol}//${url.hostname}/${parts[0]}/${parts[1]}`;
  return { originUrl, browseUrl: buildOriginDirectoryUrl(originUrl) };
}

export function deriveSoftwareHeritageTarget(rawUrl: string): SoftwareHeritageTarget | null {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();

    if (host === "github.com" || host === "codeberg.org") {
      return parseGithubLikeTarget(url);
    }

    if (host === "gitlab.com") {
      return parseGitlabTarget(url);
    }

    if (host === "bitbucket.org") {
      return parseBitbucketTarget(url);
    }

    if (host === "git.sr.ht") {
      return parseSourcehutTarget(url);
    }

    return null;
  } catch {
    return null;
  }
}

export function buildSoftwareHeritageVisitUrl(originUrl: string): string {
  return `https://archive.softwareheritage.org/api/1/origin/${originUrl}/visit/latest/?require_snapshot=true`;
}

function isRelevant(context: ArchivePriorityContext): boolean {
  return deriveSoftwareHeritageTarget(context.rawUrl) !== null;
}

async function lookup(
  candidate: SearchCandidate,
  fetchImpl: typeof fetch,
  _hostSettings?: never,
  onProgress?: (phase: "querying" | "verifying") => void
): Promise<ArchiveProviderLookupResult> {
  const target = deriveSoftwareHeritageTarget(candidate.url);
  if (!target) return { status: "miss" };

  const response = await fetchImpl(buildSoftwareHeritageVisitUrl(target.originUrl), {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (response.status === 404) return { status: "miss" };
  if (!response.ok) {
    if (response.status === 429) throw new ProviderLookupError("Software Heritage rate-limited this request", "rate-limited");
    if (response.status >= 500) throw new ProviderLookupError(`Software Heritage returned ${response.status}`, "server-error");
    throw new ProviderLookupError(`Software Heritage returned ${response.status}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const snapshot = typeof payload.snapshot === "string" ? payload.snapshot : null;
  const date = typeof payload.date === "string" ? payload.date : undefined;
  if (!snapshot) return { status: "miss" };

  return {
    status: "confirmed",
    snapshot: {
      originalUrl: candidate.url,
      matchedUrl: target.originUrl,
      archiveUrl: target.browseUrl,
      openUrl: target.browseUrl,
      timestamp: timestampFromIso(date),
      statusCode: "200",
      mimeType: "text/html",
      strategy: candidate.strategy,
      providerId: "software-heritage",
      verification: "confirmed"
    }
  };
}

export const softwareHeritageProvider: AutomaticArchiveProvider = {
  id: "software-heritage",
  displayName: "Software Heritage",
  shortDescription: "Source code repository archive",
  kind: "automatic",
  purpose: "automatic-snapshot",
  isRelevant,
  lookup,
  buildDirectLinkUrl(originalUrl: string): string | null {
    return deriveSoftwareHeritageTarget(originalUrl)?.browseUrl ?? null;
  }
};
