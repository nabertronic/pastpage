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
  "mc_cid",
  "mc_eid",
  "igshid",
  "si",
  "feature",
  "ref",
  "ref_src",
  "spm",
  "cmpid"
]);

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  const normalizedIpv6 = normalized.replace(/^\[|\]$/g, "");

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

  if (
    normalizedIpv6 === "::1" ||
    normalizedIpv6.startsWith("fc") ||
    normalizedIpv6.startsWith("fd") ||
    normalizedIpv6.startsWith("fe80:") ||
    normalizedIpv6.startsWith("::ffff:7f")
  ) {
    return true;
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
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      parsed.searchParams.delete(key);
    }
  }

  parsed.hash = "";
  return parsed.toString();
}

export type SearchCandidate = {
  strategy: "exact" | "cleaned";
  url: string;
};

export function buildSearchCandidates(rawUrl: string, mode: UrlMatchingMode): SearchCandidate[] {
  const cleaned = cleanUrl(rawUrl);
  const hasCleanedVariant = cleaned !== rawUrl;

  if (mode === "exact-only" || !hasCleanedVariant) {
    return [{ strategy: "exact", url: rawUrl }];
  }

  if (mode === "cleaned-first") {
    return [
      { strategy: "cleaned", url: cleaned },
      { strategy: "exact", url: rawUrl }
    ];
  }

  return [
    { strategy: "exact", url: rawUrl },
    { strategy: "cleaned", url: cleaned }
  ];
}
