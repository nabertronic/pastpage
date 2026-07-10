import { getUrlEligibility } from "../urlPolicy";
import type { ArchivePriorityContext, ProviderId } from "./types";

const GENERAL_AUTOMATIC_ORDER: ProviderId[] = [
  "wayback",
  "archive-today",
  "ghostarchive",
  "perma-cc",
  "web-gyotaku",
  "webcite"
];

const PORTUGAL_AUTOMATIC_ORDER: ProviderId[] = [
  "wayback",
  "archive-today",
  "arquivo-pt",
  "ghostarchive",
  "perma-cc",
  "web-gyotaku",
  "webcite"
];

const JAPAN_AUTOMATIC_ORDER: ProviderId[] = [
  "wayback",
  "archive-today",
  "web-gyotaku",
  "ghostarchive",
  "perma-cc",
  "webcite"
];

function isExactHostOrSubdomain(hostname: string, suffix: string): boolean {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

function promoteProvider(order: ProviderId[], providerId: ProviderId): void {
  if (order.includes(providerId)) return;
  order.splice(2, 0, providerId);
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
    isCanadaGov:
      hostname === "canada.ca" ||
      hostname.endsWith(".canada.ca") ||
      hostname === "gc.ca" ||
      hostname.endsWith(".gc.ca"),
    isIcelandTld: hostname === "is" || hostname.endsWith(".is"),
    isTaiwanTld:
      hostname === "tw" ||
      hostname.endsWith(".tw") ||
      isExactHostOrSubdomain(hostname, "gov.tw") ||
      isExactHostOrSubdomain(hostname, "edu.tw"),
    isCataloniaTld: hostname === "cat" || hostname.endsWith(".cat"),
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
  let order = [...GENERAL_AUTOMATIC_ORDER];

  if (context.isPortugalTld) {
    order = [...PORTUGAL_AUTOMATIC_ORDER];
  } else if (context.isJapanTld) {
    order = [...JAPAN_AUTOMATIC_ORDER];
  }

  if (context.isUkGov) {
    promoteProvider(order, "uk-gov-web-archive");
  }

  if (context.isCanadaGov) {
    promoteProvider(order, "canada-gov-web-archive");
  }

  if (context.isIcelandTld) {
    promoteProvider(order, "vefsafn");
  }

  if (context.isTaiwanTld) {
    promoteProvider(order, "ntuwas");
  }

  if (context.isCataloniaTld) {
    promoteProvider(order, "padicat");
  }

  if (context.isUsGov) {
    const insertAt = Math.max(order.indexOf("ghostarchive") + 1, 0);
    order.splice(insertAt, 0, "loc-web-archives");
  }

  if (context.isRepositoryUrl) {
    const insertAt = Math.max(order.indexOf("perma-cc") + 1, 0);
    order.splice(insertAt, 0, "software-heritage");
  }

  return order;
}

export function buildManualDirectLinkProviders(context: ArchivePriorityContext): ProviderId[] {
  const providers: ProviderId[] = ["yandex-cache"];

  return providers;
}
