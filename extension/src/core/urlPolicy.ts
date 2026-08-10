import type { UrlMatchingMode } from "./settings";
import { WAYBACK_HOSTS } from "./constants";

export type UrlEligibility =
  | { eligible: true; url: URL }
  | {
      eligible: false;
      reasonKey:
        | "eligibility.invalidUrl"
        | "eligibility.httpOnly"
        | "eligibility.privateUrl"
        | "eligibility.archiveLoop";
    };

const TRACKING_PARAMS = new Set([
  "__hsfp",
  "__hssc",
  "__hstc",
  "_hsenc",
  "_hsmi",
  "ck_subscriber_id",
  "cmp",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_name",
  "fbclid",
  "gclid",
  "dclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "twclid",
  "li_fat_id",
  "srsltid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "si",
  "feature",
  "ref",
  "ref_src",
  "referer",
  "referrer",
  "source",
  "spm",
  "cmpid",
  "ncid",
  "scid"
]);

const SENSITIVE_PARAMS = new Set([
  "access_token",
  "auth",
  "auth_token",
  "authorization",
  "code",
  "id_token",
  "key",
  "nonce",
  "otp",
  "password",
  "refresh_token",
  "secret",
  "session",
  "session_id",
  "sessionid",
  "sig",
  "signature",
  "state",
  "ticket",
  "token"
]);

function shouldRemoveFromCleanedUrl(key: string): boolean {
  const normalizedKey = key.toLowerCase();
  return (
    TRACKING_PARAMS.has(normalizedKey) ||
    SENSITIVE_PARAMS.has(normalizedKey) ||
    normalizedKey.startsWith("utm_") ||
    normalizedKey.startsWith("pk_") ||
    normalizedKey.startsWith("mtm_") ||
    normalizedKey.endsWith("clid")
  );
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".onion")
  ) {
    return true;
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalized)) {
    const [firstRaw, secondRaw] = normalized.split(".");
    const first = Number(firstRaw);
    const second = Number(secondRaw);

    return (
      first === 10 ||
      first === 127 ||
      first === 0 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  // IPv6 literals only reach here in bracketed form (e.g. "[::1]"); plain
  // hostnames must never be matched against IPv6 prefixes, otherwise real
  // domains like "fda.gov" or "fcc.gov" get misread as fc00::/fd00:: ULAs.
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    const ipv6 = normalized.slice(1, -1);
    return (
      ipv6 === "::1" ||
      ipv6.startsWith("fc") ||
      ipv6.startsWith("fd") ||
      ipv6.startsWith("fe80:") ||
      ipv6.startsWith("::ffff:7f")
    );
  }

  return false;
}

export function getUrlEligibility(rawUrl: string): UrlEligibility {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    return { eligible: false, reasonKey: "eligibility.invalidUrl" };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { eligible: false, reasonKey: "eligibility.httpOnly" };
  }

  if (isPrivateHostname(parsed.hostname)) {
    return { eligible: false, reasonKey: "eligibility.privateUrl" };
  }

  if (WAYBACK_HOSTS.has(parsed.hostname.toLowerCase())) {
    return { eligible: false, reasonKey: "eligibility.archiveLoop" };
  }

  return { eligible: true, url: parsed };
}

export function cleanUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);

  for (const key of Array.from(parsed.searchParams.keys())) {
    if (shouldRemoveFromCleanedUrl(key)) {
      parsed.searchParams.delete(key);
    }
  }

  parsed.hash = "";
  return parsed.toString();
}

function stripSearchAndHash(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

export type SearchCandidate = {
  strategy: "exact" | "cleaned" | "variant";
  url: string;
};

export function buildSearchCandidates(rawUrl: string, mode: UrlMatchingMode): SearchCandidate[] {
  const cleanedCandidates = [cleanUrl(rawUrl), stripSearchAndHash(rawUrl)].filter(
    (candidate) => candidate !== rawUrl
  );
  const uniqueCleanedCandidates = Array.from(new Set(cleanedCandidates));

  if (mode === "exact-only" || uniqueCleanedCandidates.length === 0) {
    return [{ strategy: "exact", url: rawUrl }];
  }

  const cleaned = uniqueCleanedCandidates.map((url) => ({ strategy: "cleaned" as const, url }));

  if (mode === "cleaned-first") {
    return [...cleaned, { strategy: "exact", url: rawUrl }];
  }

  return [{ strategy: "exact", url: rawUrl }, ...cleaned];
}

function canToggleWww(hostname: string): boolean {
  return hostname.includes(".") && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) && !hostname.includes(":");
}

function toggleVariant(url: URL, toggle: "protocol" | "www" | "slash"): boolean {
  if (toggle === "protocol") {
    url.protocol = url.protocol === "https:" ? "http:" : "https:";
    return true;
  }

  if (toggle === "www") {
    if (!canToggleWww(url.hostname)) return false;
    url.hostname = url.hostname.toLowerCase().startsWith("www.")
      ? url.hostname.slice(4)
      : `www.${url.hostname}`;
    return true;
  }

  if (url.pathname === "/") return false;
  url.pathname = url.pathname.endsWith("/")
    ? url.pathname.replace(/\/+$/, "") || "/"
    : `${url.pathname}/`;
  return true;
}

export function buildUrlVariantCandidates(
  rawUrl: string,
  mode: UrlMatchingMode
): SearchCandidate[] {
  if (mode === "exact-only") return [];

  const primaryCandidates = buildSearchCandidates(rawUrl, mode);
  const baseUrl = [...primaryCandidates].reverse().find((candidate) => candidate.strategy === "cleaned")?.url
    ?? primaryCandidates[0]?.url
    ?? rawUrl;
  const primaryUrls = new Set(primaryCandidates.map((candidate) => candidate.url));
  const seen = new Set(primaryUrls);
  const variants: SearchCandidate[] = [];
  const toggles = ["protocol", "www", "slash"] as const;

  // Try one changed URL component before combinations of two or three. Using
  // the final cleaned candidate as the base keeps this stage query-free and
  // caps it at seven additional requests per provider.
  for (let changedComponents = 1; changedComponents <= toggles.length; changedComponents += 1) {
    for (let mask = 1; mask < 1 << toggles.length; mask += 1) {
      const enabledToggles = toggles.filter((_, index) => (mask & (1 << index)) !== 0);
      if (enabledToggles.length !== changedComponents) continue;

      const url = new URL(baseUrl);
      const changed = enabledToggles.every((toggle) => toggleVariant(url, toggle));
      if (!changed) continue;

      url.hash = "";
      const candidateUrl = url.toString();
      if (seen.has(candidateUrl)) continue;
      seen.add(candidateUrl);
      variants.push({ strategy: "variant", url: candidateUrl });
    }
  }

  return variants;
}
