import { getUrlEligibility } from "../urlPolicy";
import type { ArchivePriorityContext, ProviderId } from "./types";

const GENERAL_AUTOMATIC_ORDER: ProviderId[] = [
  "wayback",
  "archive-today",
  "ghostarchive",
  "perma-cc",
  "arquivo-pt",
  "web-gyotaku"
];

const PORTUGAL_AUTOMATIC_ORDER: ProviderId[] = [
  "wayback",
  "archive-today",
  "arquivo-pt",
  "ghostarchive",
  "perma-cc",
  "web-gyotaku"
];

const JAPAN_AUTOMATIC_ORDER: ProviderId[] = [
  "wayback",
  "archive-today",
  "web-gyotaku",
  "ghostarchive",
  "perma-cc",
  "arquivo-pt"
];

function isExactHostOrSubdomain(hostname: string, suffix: string): boolean {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

function isRepositoryUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  const pathParts = url.pathname.split("/").filter(Boolean);

  if (host === "github.com" || host === "gitlab.com" || host === "codeberg.org") {
    return pathParts.length >= 2;
  }

  if (host === "bitbucket.org") {
    return pathParts.length >= 2;
  }

  if (host === "git.sr.ht") {
    return pathParts.length >= 1;
  }

  return false;
}

export function classifyArchivePriority(rawUrl: string): ArchivePriorityContext {
  const eligibility = getUrlEligibility(rawUrl);
  if (!eligibility.eligible) {
    throw new Error(`Cannot classify ineligible URL: ${eligibility.reasonKey}`);
  }

  const url = eligibility.url;
  const hostname = url.hostname.toLowerCase();

  return {
    rawUrl,
    hostname,
    isUkGov: isExactHostOrSubdomain(hostname, "gov.uk"),
    isUsGov:
      hostname === "loc.gov" ||
      hostname.endsWith(".loc.gov") ||
      hostname === "congress.gov" ||
      hostname.endsWith(".congress.gov") ||
      hostname.endsWith(".gov") ||
      hostname.endsWith(".mil"),
    isPortugalTld:
      hostname.endsWith(".pt") ||
      hostname === "pt" ||
      isExactHostOrSubdomain(hostname, "gov.pt") ||
      isExactHostOrSubdomain(hostname, "edu.pt") ||
      isExactHostOrSubdomain(hostname, "org.pt"),
    isJapanTld: hostname === "jp" || hostname.endsWith(".jp"),
    isRepositoryUrl: isRepositoryUrl(url)
  };
}

export function buildAutomaticProviderOrder(context: ArchivePriorityContext): ProviderId[] {
  if (context.isPortugalTld) {
    return PORTUGAL_AUTOMATIC_ORDER;
  }

  if (context.isJapanTld) {
    return JAPAN_AUTOMATIC_ORDER;
  }

  const order = [...GENERAL_AUTOMATIC_ORDER];

  if (context.isUkGov) {
    order.splice(2, 0, "uk-gov-web-archive");
  }

  if (context.isUsGov) {
    order.splice(3, 0, "loc-web-archives");
  }

  return order;
}

export function buildManualDirectLinkProviders(context: ArchivePriorityContext): ProviderId[] {
  const providers: ProviderId[] = ["yandex-cache", "archive-it", "webcite"];

  if (context.isRepositoryUrl) {
    providers.push("software-heritage");
  }

  return providers;
}
